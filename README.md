# prompt2brand

**Prompt your brand. Pick a domain. Launch.**

A hackathon PoC that turns a text prompt into a multi-page brand website, searches available domains via name.com, checks brand conflicts via SerpApi, and launches to Vercel hosting with domain registration.

**Live demo:** [prompt2brand.vercel.app](https://prompt2brand.vercel.app)

## Quick start

```bash
npm install
npm run dev          # Vite frontend only (API routes need vercel dev)
vercel link && vercel dev   # full stack locally
```

Copy `.env.example` to `.env.local` and fill in credentials. See **[SPEC.md](./SPEC.md)** for architecture, API details, integration flags, and the Devpost checklist.

## Environment (summary)

| Variable | Purpose |
|----------|---------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway (Gemini) for site + domain brainstorm |
| `POSTGRES_URL` | Neon Postgres (site HTML storage) |
| `P2B_LIVE_INTEGRATIONS` | `0` = name.com sandbox + mock SerpApi; `1` = production name.com + live SerpApi |
| `NAMECOM_SANDBOX_*` / `NAMECOM_PRODUCTION_*` | name.com API credentials |
| `SERPAPI_KEY` | SerpApi (when `P2B_LIVE_INTEGRATIONS=1`) |
| `VERCEL_TOKEN` | Vercel Deploy API (one static project per launch) |

Full list and behavior: `.env.example` and [SPEC.md § Integrations](./SPEC.md).

## Scripts

```bash
npm run dev      # local Vite dev server
npm run build    # production build
npm run preview  # preview production build
```

## Documentation

| Doc | Contents |
|-----|----------|
| **[SPEC.md](./SPEC.md)** | Product vision, UI flows, architecture, APIs, data model, sponsor integration details, Devpost checklist |
| **`.env.example`** | All env vars with comments |

**README vs SPEC:** This file is the GitHub front door — what the project is and how to run it. SPEC is the full reference for how everything works.

## Repo layout (high level)

```
api/           Vercel serverless routes + _lib helpers
src/           React SPA (preview, domain card, prompt panel)
shared/        Types and logic shared between app and API
```

## License

Hackathon project — see repo owner for terms.
