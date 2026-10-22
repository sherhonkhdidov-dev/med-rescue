/* MED RESCUE · savol-javob oynasi (Gemini). Barcha sahifalarga <script src="ask.js"></script> bilan ulanadi. */
(function () {
  // Cloudflare Worker manzili (worker/README.md ga qarang). Bo'sh bo'lsa, oyna "sozlanmagan" deb xabar beradi.
  var ENDPOINT = '';

  var MAXH = 10, COOLDOWN = 2000, TIMEOUT = 45000;
  var hist = [], busy = false, last = 0;

  var css = document.createElement('style');
  css.textContent =
    '#mrq-fab{position:fixed;left:10px;z-index:1100;width:48px;height:48px;border-radius:50%;border:0;font-size:22px;cursor:pointer;color:#fff;' +
    'background:linear-gradient(145deg,#ef4150,#b4232c);box-shadow:0 6px 24px #0b1f3340;display:grid;place-items:center;' +
    'bottom:calc(var(--shh,0px) + 14px + env(safe-area-inset-bottom))}' +
    '#mrq{position:fixed;inset:0;z-index:2000;display:none;flex-direction:column;background:#f4f6f9;color:#0b1f33;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif}' +
    '#mrq.on{display:flex}' +
    '#mrq header{display:flex;align-items:center;gap:10px;padding:max(12px,env(safe-area-inset-top)) 14px 12px;background:linear-gradient(150deg,#0b1f33,#17385c);color:#fff}' +
    '#mrq header b{flex:1;font-size:16px}' +
    '#mrq header button{border:0;background:#ffffff26;color:#fff;border-radius:10px;width:36px;height:36px;font-size:18px;cursor:pointer}' +
    '#mrq .nt{margin:0;padding:8px 14px;font-size:12px;color:#7a1d25;background:#fdecee;border-bottom:1px solid #f3c9ce}' +
    '#mrq .ms{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}' +
    '#mrq .m{max-width:88%;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}' +
    '#mrq .u{align-self:flex-end;background:#17385c;color:#fff;border-bottom-right-radius:4px}' +
    '#mrq .a{align-self:flex-start;background:#fff;border:1px solid #e3e8ef;border-bottom-left-radius:4px}' +
    '#mrq .e{align-self:flex-start;background:#fdecee;border:1px solid #f3c9ce;color:#7a1d25}' +
    '#mrq form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e3e8ef}' +
    '#mrq textarea{flex:1;resize:none;border:1px solid #cfd7e2;border-radius:12px;padding:10px 12px;font:inherit;max-height:120px;color:inherit}' +
    '#mrq form button{border:0;border-radius:12px;padding:0 16px;font-weight:700;color:#fff;background:linear-gradient(145deg,#ef4150,#b4232c);cursor:pointer}' +
    '#mrq form button:disabled{opacity:.5;cursor:default}';
  document.head.appendChild(css);

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  var fab = el('button', null, '💬');
  fab.id = 'mrq-fab';
  fab.type = 'button';
  fab.title = 'Савол додан';
  fab.setAttribute('aria-label', 'Савол додан');

  var box = el('div');
  box.id = 'mrq';
  var head = el('header');
  var ttl = el('b', null, 'Саволҳо · ёрдамчии сунъӣ');
  var close = el('button', null, '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Пӯшидан');
  head.appendChild(ttl);
  head.appendChild(close);
  var note = el('p', 'nt', 'Ин ёрдамчии сунъӣ аст ва духтур нест. Дар ҳолати таъҷилӣ фавран ба хадамоти ёрии таъҷилӣ занг занед. Маълумоти шахсии беморро инҷо нанависед.');
  var ms = el('div', 'ms');
  var form = el('form');
  var ta = el('textarea');
  ta.rows = 1;
  ta.placeholder = 'Саволатонро нависед…';
  ta.maxLength = 1000;
  var send = el('button', null, '➤');
  send.type = 'submit';
  send.setAttribute('aria-label', 'Фиристодан');
  form.appendChild(ta);
  form.appendChild(send);
  box.appendChild(head);
  box.appendChild(note);
  box.appendChild(ms);
  box.appendChild(form);

  function add(cls, text) {
    var m = el('div', 'm ' + cls, text);
    ms.appendChild(m);
    ms.scrollTop = ms.scrollHeight;
    return m;
  }

  function open() {
    box.classList.add('on');
    if (!ms.children.length) {
      add('a', 'Салом! Ман ёрдамчии MED RESCUE. Дар бораи кори сайт ё масъалаҳои умумии тиббӣ пурсед.');
    }
    setTimeout(function () { ta.focus(); }, 50);
  }
  function shut() { box.classList.remove('on'); }

  fab.onclick = open;
  close.onclick = shut;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });

  ta.addEventListener('input', function () {
    ta.style.height = 'auto';
    ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
  });
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : send.click(); }
  });

  var ERR = {
    429: 'Дархостҳо аз ҳад зиёд шуданд. Як дақиқа интизор шавед.',
    403: 'Ин сайт барои ёрдамчӣ иҷозат надорад.',
    500: 'Ёрдамчӣ ҳоло танзим нашудааст.',
    502: 'Ёрдамчӣ ҳоло ҷавоб дода наметавонад. Баъдтар кӯшиш кунед.'
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = ta.value.trim();
    if (!text || busy) return;
    if (!ENDPOINT) { add('e', 'Ёрдамчӣ ҳоло танзим нашудааст (ENDPOINT холӣ аст).'); return; }
    if (Date.now() - last < COOLDOWN) return;
    last = Date.now();
    add('u', text);
    hist.push({ role: 'user', text: text });
    hist = hist.slice(-MAXH);
    ta.value = '';
    ta.style.height = 'auto';
    busy = true;
    send.disabled = true;
    var wait = add('a', '…');

    var ac = new AbortController();
    var tm = setTimeout(function () { ac.abort(); }, TIMEOUT);
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: hist }),
      signal: ac.signal
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
    }).then(function (x) {
      if (x.ok && x.d.answer) {
        wait.textContent = x.d.answer;
        hist.push({ role: 'model', text: x.d.answer });
        hist = hist.slice(-MAXH);
      } else {
        wait.className = 'm e';
        wait.textContent = ERR[x.status] || 'Хатогӣ рух дод. Баъдтар кӯшиш кунед.';
        hist.pop();
      }
    }).catch(function () {
      wait.className = 'm e';
      wait.textContent = 'Алоқа нест. Интернетро санҷед ва аз нав кӯшиш кунед.';
      hist.pop();
    }).then(function () {
      clearTimeout(tm);
      busy = false;
      send.disabled = false;
      ms.scrollTop = ms.scrollHeight;
    });
  });

  document.body.appendChild(fab);
  document.body.appendChild(box);
})();
