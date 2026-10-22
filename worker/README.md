# MED RESCUE · Gemini serveri (Cloudflare Worker)

Sayt savollarini Gemini ga yuboradi. API kalit saytda emas, faqat shu serverda secret sifatida saqlanadi.

Model: avval `gemini-2.5-flash` sinaladi. Google 2.5 modellarini yangi foydalanuvchilar uchun yopib qo'ygan bo'lishi mumkin (404 qaytaradi), shunda server o'zi `gemini-3.8-flash` ga o'tadi. Tartibni `wrangler.toml` dagi `GEMINI_MODELS` bilan o'zgartirasiz.

## Joylash (bir marta)

1. Kalit oling: https://aistudio.google.com/apikey (kalitni hech kimga yubormang, GitHub'ga yozmang).
2. Kompyuterda (Node.js kerak) shu papkada:
   ```
   cd worker
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY    # so'raganda kalitni qo'ying
   npx wrangler deploy
   ```
3. `deploy` oxirida manzil chiqadi, masalan `https://med-rescue-ask.NOM.workers.dev`.
4. Shu manzilni `../ask.js` faylining boshidagi `ENDPOINT` ga yozing va GitHub'ga yuklang.

## Sozlamalar

- `wrangler.toml` dagi `ALLOWED_ORIGINS`: saytingiz manzili. Sayt boshqa manzilga ko'chsa, shuni yangilang.
- Cheklovlar `worker.js` boshida: daqiqasiga 12 so'rov (bir IP), xabar 1000 belgi, oxirgi 10 xabar.

## Xarajatni nazorat qilish

Model pullik. Albatta:
- Google AI Studio / Cloud Billing'da oylik byudjet va ogohlantirish qo'ying.
- Cloudflare Dashboard → Security → WAF → Rate limiting bilan qo'shimcha cheklov qo'shing (worker ichidagi cheklov faqat yordamchi).
