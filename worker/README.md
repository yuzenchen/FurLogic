# FurLogic Vision Worker

Cloudflare Worker that proxies image-analysis requests to Google Gemini so
the front-end never sees the API key.

Endpoint:

```
POST  /analyze   { image: dataURL, catalog: [{id, name}] }   → { items: [{ id?, name, confidence }] }
GET   /health
```

## One-time setup

1. **Get a Gemini API key** at https://aistudio.google.com/apikey (free tier is generous: ~1500 req/day on Flash).
2. **Create a Cloudflare account** at https://dash.cloudflare.com/sign-up (Workers free plan: 100k req/day).
3. From this folder:

   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY    # paste the key when prompted
   npm run deploy
   ```

   The deploy URL will look like `https://furlogic-vision.<your-subdomain>.workers.dev`.

4. Tell the front-end about the URL: in the GitHub Pages workflow
   (`.github/workflows/deploy-gh-pages.yml`) add an env var on the **Build** step:

   ```yaml
   env:
     VITE_BASE: /FurLogic/
     VITE_VISION_WORKER_URL: https://furlogic-vision.<your-subdomain>.workers.dev
   ```

   For local dev, copy `.env.example` to `.env.local` and fill in the URL.

5. (Optional) Edit `wrangler.toml` `ALLOWED_ORIGINS` if you bind a custom domain.

## Local dev

```bash
echo "GEMINI_API_KEY=sk-..." > .dev.vars
npm run dev   # serves on http://127.0.0.1:8787
```

Then run the front-end with `VITE_VISION_WORKER_URL=http://127.0.0.1:8787 npm run dev`.

## Cost guard

- Image is rejected if base64 decodes to more than 4 MB.
- Origin allow-list rejects every browser that's not in `ALLOWED_ORIGINS`.
- Deploy a [Worker rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) if you expect abuse.
