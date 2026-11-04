# prompt2brand - Product Specification

> **Version:** 2.1 (as-built)
> **Last updated:** 2026-11-04
> **Submission:** [Meta Global AI Developer Hackathon](https://dev.meta.ai/events/global-hackathon) — theme *Build for Your World*
> **Live demo:** [prompt2brand.vercel.app](https://prompt2brand.vercel.app)
> **Repo:** [github.com/srbu-srbu/prompt2brand](https://github.com/srbu-srbu/prompt2brand)

---

## Hackathon context (not for product UI)

**Pre-event baseline:** tag `v0.1.0-pre-meta` — React/Vite UI, name.com, SerpApi, Vercel launch pipeline (prior PoC).

**Built during the event (Oct 26 – Nov 4, 2026):** Meta Model API integration for site generation and domain brainstorm via `api/_lib/metaModelApi.ts` (default model `muse-spark-1.3`, env `META_MODEL`). Commits after `v0.1.0-pre-meta` document that scope.

**Hard rule:** Hackathon and sponsor references stay in README/SPEC and demo narration — not in generated customer site HTML.

---

## What the user is buying (product vision)

Bundle — not domain-only:

| Included | Detail |
|----------|--------|
| **Prompt-based website editor** | AI site (up to 5 static pages) |
| **Domain name** | Registration + DNS (name.com) |
| **Hosting** | Vercel CDN |
| **Unlimited edits (subscribed)** | Return anytime, prompt changes, redeploy |

Real product: subscribe once, then unlimited prompt edits. Billing not built in PoC.

### PoC scope vs product vision

| Built in PoC | Not built — explain in demo narration only |
|--------------|--------------------------------------------------|
| First launch: prompt → preview → domain card → confirm site + domain → Launch brand | Return visit after subscribe |
| Prompt during domain pick (site tab + domain tab) | Post-subscribe unlimited edit flow |
| Publish + register on Launch brand; in-card status panel | Auth, subscription billing, edit history UI |
| DB stores HTML (groundwork for future redeploy) | Redeploy on subsequent visits |

**Demo narration:** *"After you subscribe, you come back anytime, prompt changes, we redeploy — unlimited edits. This demo shows the first launch."*

PoC demo **ends at the launch status panel** (links + step indicators). Do not build post-subscribe editing in the app.

---

## Product limits (hosted brand site)

Up to **5 self-contained HTML pages** (inline CSS/JS in fragments; wrapped at publish). No backend on hosted site.

Allowed: HTML fragments with inline CSS/JS, external image URLs, internal page links (`/about`, not `#hash`).
Not allowed on hosted site: serverless functions, database, form POST to APIs.

---

## Page format and internal links

Each page is an HTML **fragment** in draft (`bodyHtml`). At publish, `wrapPage()` builds a full document for Vercel deploy; Neon stores the same wrapped HTML.

**Preview vs publish link handling** (`shared/internalLinks.ts`):

| Context | Nav links |
|---------|-----------|
| **Preview iframe** | LLM may emit `#about` hash links → rewritten to `#p2b:slug` at render time |
| **Published site (Vercel)** | `preparePublishedHtml()` rewrites hash/slug links to clean paths `/about` before deploy |
| **Postgres fallback serve** | `prepareFallbackHtml()` rewrites those links to `/api/sites/{siteId}/{slug}` at request time |

This avoids broken multi-page nav when the LLM generates hash links but the deployed site uses path-based routing.

---

## Hosting and storage (dual-write)

On **Launch brand** (website + domain confirmed):

1. **Save** wrapped HTML to **Neon Postgres**
2. **Kick off** Vercel Deploy API (non-blocking in handler; status polled client-side)
3. **Register** domain via name.com + DNS (modes 0–3: `www` CNAME to hosted URL; mode `4`: Vercel custom domain + apex A + `www` CNAME from Vercel config)

Until Launch brand, everything stays in **client draft** (React state + `sessionStorage`). No backend write while prompting or picking a domain.

### Vercel Deploy API

- One static deployment per launch (`p2b-{siteId}.vercel.app`)
- Inline base64 HTML files, `framework: null`
- Requires `VERCEL_TOKEN` (+ optional `VERCEL_TEAM_ID`) server-side
- `GET /api/sites/status/[siteId]` polls Vercel deployment state

### DB fallback serve

`GET /api/sites/[siteId]/[slug]` serves HTML from Neon if needed.

### Public URLs

- **Primary:** `https://p2b-{siteId}.vercel.app/`
- **Fallback (app origin):** `https://prompt2brand.vercel.app/api/sites/{siteId}/home`
- **Custom domain:** registered FQDN (sandbox or production per integration flag)

---

## Integration flag (`P2B_LIVE_INTEGRATIONS`)

Controlled in `api/_lib/integrations.ts`:

| `P2B_LIVE_INTEGRATIONS` | Hosting | name.com | SerpApi |
|-------------------------|---------|----------|---------|
| `0` (default, demo-safe) | Postgres fallback URL | Sandbox | Mock (all Clear) |
| `1` | Vercel (`p2b-*.vercel.app`) | Sandbox | Mock (all Clear) |
| `2` | Vercel | Sandbox | Live (if `SERPAPI_KEY` set) |
| `3` | Vercel + custom domain DNS | Production (`api.name.com`) | Live (if `SERPAPI_KEY` set) |

Env var sets are dual-configured in `.env.example`:

- `NAMECOM_SANDBOX_*` — used when flag = 0, 1, or 2
- `NAMECOM_PRODUCTION_*` — used when flag = 3

**name.com billing:** Search and Check Availability are free API calls. **Create Domain** (on Launch) charges account credit or default payment method. With $0 balance and no card, registration returns `402 Payment Required`; hosting may still succeed.

**SerpApi:** Free tier ~250 searches/month. Results cached 1 hour per domain (`v4:` cache key). Conflict matching uses domain stem (e.g. `miliojen` from `miliojen.org`) against title + snippet + URL; UI shows result URL and highlights matched tokens (`shared/conflictMatch.ts`).

---

## Domain search pipeline

LLM brainstorms **search stems** and **preferred TLDs**; name.com verifies availability. The LLM does **not** pick final domain names.

```
User prompt (+ brand name, tagline, page titles)
        ↓
POST /api/domains/suggest  OR  /api/domains/suggest/more
        ↓
domainBrainstorm.ts  →  Meta Model API (META_MODEL / muse-spark-1.3)
   returns: { stems: ["miliojen"], preferredTlds: ["dev", "xyz"], summary }
   fallback: domainPromptParse.ts (extract brand stem + TLDs from prompt — never whole sentence)
        ↓
name.com POST /core/v1/domains:search  (per stem, tldFilter = preferredTlds)
        ↓
Filter: purchasable, non-premium, purchaseType = registration
        ↓
Domain picker list
```

**Domain tab prompt** (e.g. *"Please provide .dev and .xyz extensions for miliojen"*) replaces the suggestion list and clears domain selection.

**More suggestions** calls LLM in `mode: "more"` with excluded FQDNs, then name.com search again. Route: `POST /api/domains/suggest/more`.

---

## SerpApi conflict pipeline

Separate from domain suggest — loaded when user **selects** a domain:

```
GET /api/domains/conflicts?fqdn=&brandName=
        ↓
serpapi.ts — site-scoped searches (web, instagram, linkedin, x, facebook)
        ↓
Match domain stem in title + snippet + URL (shared/conflictMatch.ts)
        ↓
UI: Conflict/Clear, clickable URL, highlighted match spans
```

---

## UI — build and domain phase

User keeps the **prompt panel throughout** build and domain selection.

### Layout

- **Header:** product title + current brand name (when site exists)
- **Preview canvas:** iframe preview of generated pages
- **Domain card overlay:** bottom-left, fades in/out (not slide)
- **Prompt panel:** fixed bottom — tabs + 3-line summary + input

### Prompt panel tabs

| Tab | Mode | Effect |
|-----|------|--------|
| **Create / Edit website** | `site` | `/api/generate` — updates brand kit + pages |
| **Choose your domain** | `domain` | Opens/toggles domain card; domain-tab submits go to `/api/domains/suggest` |

Clicking **Choose your domain** again toggles the card (chevron ▲/▼). Prompt submit is **on Enter/send**, not debounced.

### Summary lines

**3 lines** above the prompt (factual, not chatbot UI). Updated after generate, domain suggest, or More suggestions.

Default empty state mentions tabs **above** the prompt.

### Domain card layout

- **50/50 columns** (stacked on mobile):
  - Left — **Powered by name.com:** domain list, prices, **More suggestions**
  - Right — **Powered by SerpApi:** async conflict check with spinner per domain select
- Selecting a domain updates the conflict column
- Footer: brand name · selected domain, combined confirm checkbox, **Launch brand**

### Combined confirm

1. User selects a domain
2. Checkbox: *I confirm this website and domain*
3. **Launch brand** enabled when: site exists + domain selected + confirmed
4. Footer: *Includes hosted website and domain registration · Sandbox - no charge*

No price displayed on domains (premium domains filtered out of suggestions).

### Launch UX (in domain card)

Replaces domain picker content after Launch:

1. **Spinner** (~650ms): "Launching your brand"
2. **Status panel:** hosting row + domain row, each with:
   - Status dot (pending / live / failed)
   - Clickable URL
   - 3 step lines (pulse while active, solid when done)
3. Client polls `GET /api/sites/status/[siteId]` via `useLaunchStatus`

`DoneScreen.tsx` exists but is **not used** — status lives in the domain card.

---

## User flow (PoC, as-built)

```
Prompt (site tab) → preview builds (sessionStorage draft)
                 → switch to domain tab → card opens
                 → domain tab prompt OR More suggestions → name.com list refreshes
                 → optional: site tab prompt to tweak copy/colors while card open
                 → select domain → SerpApi conflicts load (right column)
                 → confirm website + domain → Launch brand
                 → spinner → status panel (poll until live/failed)
```

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App frontend | React 19 + Vite SPA on Vercel |
| App styling | Tailwind CSS v4 + selective shadcn/ui |
| App backend | Vercel Serverless Functions (`/api/*`) |
| Hosted pages | Static HTML per page, one Vercel project per launch |
| HTML storage | Neon Postgres via Vercel Marketplace |
| Live hosting | Vercel Deploy API (primary) + DB serve (fallback) |
| Draft | React state + `sessionStorage` |
| Site generation LLM | Meta Model API → `META_MODEL` (default `muse-spark-1.3`) |
| Domain brainstorm LLM | Same Meta model |
| Domains | name.com Core API (sandbox or production) |
| Brand conflicts | SerpApi Google search (live or mock) |

---

## Key modules

| Path | Role |
|------|------|
| `src/App.tsx` | Orchestration, tabs, launch flow |
| `src/components/DomainCard.tsx` | Domain picker, conflicts, launch status |
| `src/components/PromptPanel.tsx` | Tab bar with chevron toggle |
| `src/lib/draft.ts` | sessionStorage draft persistence |
| `src/lib/launchStatus.ts` | Status polling hook |
| `src/lib/launchSteps.ts` | Step line text/phases for hosting + domain |
| `src/lib/previewFrame.ts` | Preview iframe + `#p2b:` link rewrite |
| `api/_lib/generateSite.ts` | LLM site generation |
| `api/_lib/domainBrainstorm.ts` | LLM stems + preferredTlds |
| `api/_lib/domainPromptParse.ts` | Script fallback stem/TLD extraction |
| `api/_lib/domains.ts` | name.com search orchestration |
| `api/_lib/namecom.ts` | name.com API client (dual env) |
| `api/_lib/serpapi.ts` | SerpApi conflict checks + cache |
| `api/_lib/integrations.ts` | `P2B_LIVE_INTEGRATIONS` flag |
| `api/_lib/vercelDeploy.ts` | Deploy + `preparePublishedHtml` |
| `api/sites/publish.ts` | Launch handler (DB + deploy + register) |
| `shared/internalLinks.ts` | Preview vs publish link rewriting |
| `shared/conflictMatch.ts` | SerpApi match + UI highlight ranges |
| `shared/types.ts` | Shared TypeScript interfaces |

---

## Data model

```typescript
interface Draft {
  prompt: string;
  promptHistory: string[];   // last 5, sent to generate LLM
  brandKit: BrandKit;
  pages: PageDraft[];
  summary: [string, string, string];  // 3 lines
  status: "idle" | "generating" | "ready" | "publishing";
}

interface BrandConflict {
  platform: "web" | "instagram" | "linkedin" | "x" | "facebook";
  label: string;
  found: boolean;
  snippet?: string;
  url?: string;   // SerpApi result link (e.g. facebook.com/JoeTheElectrician)
}

interface PublishedSite {
  siteId: string;
  hostedUrl: string;
  domainFqdn: string;
  hostingStatus: "pending" | "live" | "failed";
  domainStatus: "pending" | "live" | "failed";
}
```

Client also tracks `latestDomainCue` (most recent domain-tab prompt) for More suggestions.

### Database (Neon)

```sql
CREATE TABLE sites (
  site_id TEXT PRIMARY KEY,
  hosted_url TEXT NOT NULL,
  vercel_deployment_id TEXT,
  domain_fqdn TEXT,
  hosting_status TEXT NOT NULL DEFAULT 'pending',
  domain_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_pages (
  site_id TEXT NOT NULL REFERENCES sites(site_id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  html TEXT NOT NULL,
  PRIMARY KEY (site_id, slug)
);
```

Provision via [Vercel Marketplace → Neon](https://vercel.com/marketplace/neon) (Free plan). Vercel injects `POSTGRES_URL`.

---

## API endpoints (as-built)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/generate` | Site prompt → brandKit + pages + 3-line summary |
| POST | `/api/domains/suggest` | Domain prompt → LLM brainstorm → name.com search |
| POST | `/api/domains/suggest/more` | More domains (LLM `mode: more` + exclude list) |
| GET | `/api/domains/conflicts` | SerpApi conflicts for selected FQDN |
| POST | `/api/sites/publish` | Launch: DB save + Vercel deploy + name.com register + DNS |
| GET | `/api/sites/status/[siteId]` | Hosting + domain status for client poll |
| GET | `/api/sites/[siteId]/[slug]` | DB HTML serve |
| GET | `/api/health` | Liveness |
| GET | `/api/health/db` | Postgres connectivity |
| GET | `/api/health/ai` | Meta Model API connectivity |

**Removed / never built:** separate `POST /api/domains/register` (register is inside publish).

---

## AI constraints

- Summary: **3 lines**, factual
- Pages: max 5; LLM nudged toward `/slug` nav links (hash links rewritten at preview/publish)
- Domains: only name.com-verified available names; premium filtered out
- Domain stems: lowercase alphanumeric, never full instruction sentences

---

## Success criteria (implementation)

- [x] Prompt visible during domain selection; site + domain tab intents work
- [x] Domain card: equal sponsor columns, tab toggle (fade in/out)
- [x] Combined website+domain confirm before Launch brand; no price shown
- [x] Dual-write DB + Vercel deploy; fallback serve works
- [x] Launch status poll with step lines in domain card
- [x] Meta Model API wired for site + domain brainstorm (`MODEL_API_KEY`)

---

## Known limitations (PoC)

- No auth, billing, or return-visit editing
- `safePublish` client fallback on API failure returns mock pending site (edge case)
- SerpApi 1-hour cache may show stale conflicts during rapid retesting
- Vercel Deployment Protection on new `p2b-*` projects is cleared via `ssoProtection: null` after Deploy API launch
- Meta Model API rate limits → generate may fall back to preserving current draft

---

## Resolved decisions (was open questions)

1. **Preview trigger:** submit on Enter/send (not debounced pause)
2. **LLM provider:** Meta Model API + `META_MODEL` (`MODEL_API_KEY`)
3. **Domain conflicts:** async on select, not bundled in suggest response
4. **Launch UI:** in-card status panel, not separate done page

---

*PoC = first launch only. Unlimited post-subscribe edits = product vision, explained in demo — not built.*
