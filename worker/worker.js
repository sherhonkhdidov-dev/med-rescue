// MED RESCUE · Gemini oraliq serveri (Cloudflare Worker)
// Kalit (GEMINI_API_KEY) faqat shu yerda, Cloudflare secret sifatida saqlanadi.

// Modellar tartibi: birinchisi sinaladi, mavjud bo'lmasa (404) keyingisiga o'tadi.
// wrangler.toml dagi GEMINI_MODELS bilan o'zgartiriladi.
const DEFAULT_MODELS = 'gemini-2.5-flash,gemini-3.8-flash';
const API = m => 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent';

const MAX_MSGS = 10;      // tarixdan oxirgi nechta xabar yuboriladi
const MAX_CHARS = 1000;   // bitta xabar uzunligi
const MAX_OUT = 2048;     // javob uchun token chegarasi (fikrlash tokenlari ham kiradi)
const LIMIT = 12;         // bitta IP uchun daqiqasiga so'rovlar soni
const WINDOW_MS = 60000;

const SYSTEM = [
  'Сен «MED RESCUE» сайтидаги ёрдамчи ҳастӣ. Сайт беморхона ва мошини ёрии таъҷилиро дар Тоҷикистон пайваст мекунад.',
  'Бо забоне ҷавоб деҳ, ки корбар менависад (одатан тоҷикӣ бо хати кириллӣ, ё русӣ, ё ӯзбекӣ).',
  'Ҷавобҳо кӯтоҳ, равшан ва аз рӯи қадамҳо бошанд.',
  'Ту духтур нестӣ: ташхис намегузорӣ ва дору ё миқдори дору таъин намекунӣ. Маслиҳати умумии кӯмаки аввалия ва маълумоти умумии тиббӣ дода метавонӣ.',
  'Агар вазъ таъҷилӣ бошад (бехушӣ, нафаскашии душвор, дарди сина, хунравии сахт, сактаи мағзӣ, ҷароҳати вазнин, ҳомиладории таъҷилӣ), аввал ба корбар бигӯ, ки фавран ба хадамоти ёрии таъҷилӣ занг занад ё ба наздиктарин беморхона равад.',
  'Агар намедонӣ, ростқавлона бигӯ. Маълумоти муассисаҳо (суроға, телефон, соатҳои корӣ)-ро аз худат наиндеш.',
  'Дар бораи кори сайт савол диҳанд: мошини ёрии таъҷилӣ мавқеи GPS-ро ба беморхона мефиристад, беморхона мошинро дар харита мебинад ва маълумоти беморро мегирад.',
].join('\n');

const hits = new Map(); // IP -> [vaqtlar]; har isolate uchun alohida, shuning uchun faqat qo'shimcha himoya

function origins(env) {
  return (env.ALLOWED_ORIGINS || 'https://sherhonkhdidov-dev.github.io').split(',').map(s => s.trim()).filter(Boolean);
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(origin ? cors(origin) : {}) },
  });
}

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= LIMIT) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

let good = ''; // oxirgi ishlagan model (shu isolate ichida)

async function gemini(env, contents) {
  const list = (env.GEMINI_MODELS || DEFAULT_MODELS).split(',').map(s => s.trim()).filter(Boolean);
  const order = good && list.includes(good) ? [good, ...list.filter(m => m !== good)] : list;
  let status = 0;
  for (const m of order) {
    let res;
    try {
      res = await fetch(API(m), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { maxOutputTokens: MAX_OUT },
        }),
      });
    } catch {
      return { error: true, status: 0 };
    }
    if (res.ok) { good = m; return { res, model: m }; }
    status = res.status;
    const txt = await res.text().catch(() => '');
    // Model yo'q yoki bu kalit uchun yopilgan: keyingisini sinaymiz. Boshqa xatolarda (429, 5xx) to'xtaymiz.
    const gone = status === 404 || ((status === 400 || status === 403) && /no longer available/i.test(txt));
    if (!gone) return { error: true, status };
    if (good === m) good = '';
  }
  return { error: true, status };
}

function clean(messages) {
  if (!Array.isArray(messages)) return null;
  const out = [];
  for (const m of messages.slice(-MAX_MSGS)) {
    if (!m || typeof m.text !== 'string') return null;
    const text = m.text.trim().slice(0, MAX_CHARS);
    if (!text) continue;
    out.push({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text }] });
  }
  // Gemini tarixi "user" bilan boshlanishi va "user" bilan tugashi kerak
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = origins(env).includes(origin);

    if (request.method === 'OPTIONS') {
      return allowed ? new Response(null, { status: 204, headers: cors(origin) }) : new Response(null, { status: 403 });
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405, allowed ? origin : '');
    if (!allowed) return json({ error: 'origin' }, 403, '');
    if (!env.GEMINI_API_KEY) return json({ error: 'not_configured' }, 500, origin);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (limited(ip)) return json({ error: 'rate_limited' }, 429, origin);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400, origin); }
    const contents = clean(body && body.messages);
    if (!contents) return json({ error: 'bad_messages' }, 400, origin);

    const g = await gemini(env, contents);
    if (g.error) return json({ error: 'upstream', status: g.status }, 502, origin);

    let data;
    try { data = await g.res.json(); } catch { return json({ error: 'upstream' }, 502, origin); }
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const answer = parts.filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('').trim();
    if (!answer) return json({ error: 'empty' }, 502, origin);
    return json({ answer, model: g.model }, 200, origin);
  },
};
