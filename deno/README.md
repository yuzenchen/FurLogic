# FurLogic Vision — Deno Deploy

Tiny HTTP service that proxies image-analysis requests to Google Gemini
so the front-end never sees the API key. Hosted on
[Deno Deploy](https://deno.com/deploy) (free tier, no credit card).

Endpoint:

```
POST  /analyze   { image: dataURL, catalog: [{id, name}] }   → { items: [{ id?, name, confidence }] }
GET   /health
```

## One-time setup

1. **Get a Gemini API key** at https://aistudio.google.com/apikey (free tier ≈ 1500 req/day).
2. **Sign in to Deno Deploy** at https://dash.deno.com — use your GitHub account.
3. **New Project → Deploy from GitHub** and select `yuzenchen/FurLogic`.
   - **Production branch**: `main`
   - **Entry point**: `deno/main.ts`
   - **Install step**: leave blank
   - **Build step**: leave blank
4. After the project is created, open **Settings → Environment Variables**:
   - `GEMINI_API_KEY` = the key from step 1
   - (optional) `ALLOWED_ORIGINS` = `https://yuzenchen.github.io,http://localhost:3000`
   - (optional) `GEMINI_MODEL` = `gemini-2.5-flash`
5. The deploy URL looks like `https://furlogic-vision.deno.dev` (or `https://<project>-<id>.deno.dev`).
6. Tell the front-end about it — repo **Settings → Secrets and variables → Actions → Variables** tab:
   - Name: `VISION_WORKER_URL`
   - Value: the URL from step 5

   Re-run the GitHub Pages workflow once so the variable is baked into the build.

## Local dev

Deno only — no npm install needed:

```bash
deno run --allow-net --allow-env --watch deno/main.ts
# then in another terminal:
GEMINI_API_KEY=... deno task dev
```

For the front-end:

```bash
echo "VITE_VISION_WORKER_URL=http://localhost:8000" > .env.local
npm run dev
```

## Cost guard

- Image rejected if base64 decodes to more than 4 MB.
- Origin allow-list rejects every browser that's not in `ALLOWED_ORIGINS`.
- Deno Deploy free tier currently allows ~1M requests/month — generous for a
  hobby project; switch to a different host or add a Worker rate-limit if you
  expect abuse.
