# prompt2brand

**Meta Global AI Developer Hackathon** · Theme: **Build for Your World**

**Prompt your brand. Pick a domain. Launch.**

One prompt turns into a multi-page brand site using the **[Meta Model API](https://dev.meta.ai/docs)** (default chat model **`muse-wonder-1.0`**, overridable via `META_MODEL`) — HTML pages, brand kit, and domain search keywords. From one screen you also pick **name.com**-verified domains, run **SerpApi** conflict checks, and **Launch brand** to Vercel hosting with DNS.

**Live demo:** [prompt2brand.vercel.app](https://prompt2brand.vercel.app)  
**Repo:** [github.com/srbu-srbu/prompt2brand](https://github.com/srbu-srbu/prompt2brand)

### Hackathon scope

UI and launch pipeline existed before the event (tag [`v0.1.0-pre-meta`](https://github.com/srbu-srbu/prompt2brand/releases/tag/v0.1.0-pre-meta)). **Built during Oct 26 – Nov 4, 2026:** Meta Model API integration for multi-page site generation and domain keyword brainstorm (`api/_lib/metaModelApi.ts` and callers). See commit history after that tag.

---

## Quick start

```bash
npm install
vercel link
vercel dev           # full stack — loads .env.local, serves /api + frontend
```

Do **not** use `npm run dev` alone for generate/domain AI: Vite proxies `/api` to `http://localhost:3000`, which only exists when **`vercel dev`** is running.

Copy `.env.example` to `.env.local`. Required for AI features:

| Variable | Purpose |
|----------|---------|
| `MODEL_API_KEY` | [Meta Model API](https://dev.meta.ai/) key |
| `META_MODEL` | Optional chat model id (default `muse-wonder-1.0`; must be listed by `GET /v1/models`) |

Other vars (Postgres, name.com, SerpApi, Vercel deploy) enable the full launch flow — see `.env.example` and **[SPEC.md](./SPEC.md)**.

### Verify Meta Model API

After `vercel dev` or deploy:

```text
GET /api/health/ai
```

Expect `"ok": true` and `"provider": "meta-model-api"` when `MODEL_API_KEY` is set.

---

## Environment (summary)

| Variable | Purpose |
|----------|---------|
| `MODEL_API_KEY` | Meta Model API — site + domain brainstorm |
| `META_MODEL` | Chat model id (default `muse-wonder-1.0`) |
| `POSTGRES_URL` | Neon Postgres (site HTML storage) |
| `P2B_LIVE_INTEGRATIONS` | `0`–`3` — sandbox/production integrations (see SPEC) |
| `NAMECOM_SANDBOX_*` / `NAMECOM_PRODUCTION_*` | name.com API |
| `SERPAPI_KEY` | SerpApi conflicts (modes `2` or `3`) |
| `VERCEL_TOKEN` | Vercel Deploy API (one static project per launch) |

---

## Scripts

```bash
npm run dev      # local Vite dev server
npm run build    # production build
npm run preview  # preview production build
```

---

## Documentation

| Doc | Contents |
|-----|----------|
| **[SPEC.md](./SPEC.md)** | Product vision, architecture, APIs, integrations, data model |
| **`.env.example`** | All env vars with comments |

---

## Repo layout

```
api/           Vercel serverless routes + _lib (incl. metaModelApi.ts)
src/           React SPA (preview, domain card, prompt panel)
shared/        Types and logic shared between app and API
```

---

## License

Copyright © 2026 Miliojen LLC. All rights reserved.
