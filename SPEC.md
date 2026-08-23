# prompt2brand - Product Specification

> **Version:** 1.3 (draft)
> **Last updated:** 2026-08-23
> **Status:** Pre-build
> **Team:** Solo - deadline Sep 3, 2026
> **Build mode:** Hackathon proof-of-concept

---

## Internal context (not for product surfaces)

Built for **[DevNetwork [API + Cloud + AI] Hackathon 2026](https://api-cloud-ai-hackathon-2026.devpost.com/)** on Devpost.

**Hard rule:** Hackathon references - this spec and Devpost submission only. Never in product UI or demo narration.

---

## What the user is buying (product vision)

Bundle - not domain-only:

| Included | Detail |
|----------|--------|
| **Prompt-based website editor** | AI site (up to 5 static pages) |
| **Domain name** | Registration + DNS (name.com) |
| **Hosting** | Vercel CDN |
| **Unlimited edits (subscribed)** | Return anytime, prompt changes, redeploy |

Real product: subscribe once, then unlimited prompt edits. Billing not built in PoC.

### Hackathon PoC vs demo narrative

| Built in PoC | Not built - explain in demo video / Devpost only |
|--------------|---------------------------------------------------|
| First launch: prompt -> preview -> confirm -> domain card -> Launch brand | Return visit after subscribe |
| **Edit website** before launch (pre-purchase tweaks) | Post-subscribe unlimited edit flow |
| Publish + domain + hosting + done screen | Auth, subscription billing, edit history UI |
| DB stores HTML (groundwork for future redeploy) | Redeploy on subsequent visits |

**Demo narration:** "After you subscribe, you come back anytime, prompt changes, we redeploy - unlimited edits. This demo shows the first launch."

Card copy ("prompt to edit anytime") = product promise. PoC demo **ends at done screen**. Do not build post-subscribe editing in the app.

---

## Product limits (hosted brand site)

Up to **5 self-contained HTML pages** (Pico CSS + inline CSS/JS). No backend on hosted site.

Allowed: HTML with inline CSS/JS, Pico CSS embedded, external image URLs, internal page links.
Not allowed on hosted site: serverless functions, database, form POST to APIs.

Example pages (max 5): home (required), about, privacy, terms, gallery, contact.

---

## Page format

Each page is one self-contained `.html` file: Pico CSS minified in `<style>`, brand CSS variables, semantic body HTML, optional inline `<script>`. No separate .css or .js files.

Generation: pinned Pico string in repo (`lib/pico.min.css.ts`), AI generates body + brand vars, `wrapPage()` builds full document for preview and publish.

---

## Hosting and storage (dual-write)

On confirm:
1. **Always** save HTML to DB (Turso or Vercel Postgres)
2. **Kick off** Vercel Deploy API (non-blocking)

DB = source of truth for future edits/redeploy. Not exercised beyond first publish in PoC.

### Vercel Deploy API

- `createDeployment` with inline base64 HTML files, `framework: null`
- Returns deploymentId + URL immediately (do not block on READY in publish handler)
- Requires `VERCEL_TOKEN` server-side

### DB fallback serve

`GET /api/sites/[siteId]/[[...path]]` serves HTML from DB if deploy fails or as backup.

### Public URLs

- Primary (deploy success): `https://p2b-{siteId}.vercel.app/`
- Fallback: `https://prompt2brand.vercel.app/sites/{siteId}/about`

---

## Non-blocking publish and register

No server-side polling during main flow.

**Publish** - fast return: DB save, start deploy, return `{ siteId, hostedUrl, hostingStatus: 'pending' }`.

**Register** - fast return: mock pay, name.com sandbox register + DNS, return `{ fqdn, domainStatus: 'pending' }`.

---

## Client status SDK (`lib/launchStatus.ts`)

On **done screen only**: `useLaunchStatus(siteId)` polls `GET /api/sites/{siteId}/status` every ~3s.

Returns `hosting` and `domain` as `pending` | `live` | `failed`. Server checks Vercel deployment state and HTTP/DNS reachability.

---

## UI - prompting phase

While user types and preview updates in background:

- **2-line summary** above prompt (max 2 lines, factual - NOT chatbot/agent UI)
- **Confirm website** button
- Small hint: *Confirm website when done.*
- **Prompt box** at bottom

Example summary: "Built home and about pages. / Applied green palette from your prompt."

---

## UI - post-confirm: final selection mode

On **Confirm website**:
1. **Prompt box hidden**
2. **Edit website** button replaces prompt (pre-launch tweaks only; collapses card, restores prompt)
3. 2-line summary expands to **domain card overlay** on dimmed preview
4. Backend: `POST /api/sites/publish` + `POST /api/domains/suggest` (domains may load async on card)

### Domain card layout

- Title: **Launch your brand**
- Subline: *Website editor + domain - prompt to edit anytime*
- **50/50 columns** with equal visual weight:
  - Left header: **Powered by name.com** - available domains, click to select, **More suggestions**
  - Right header: **Powered by SerpApi** - brand conflicts for selected domain (web, Instagram, LinkedIn, X, Facebook)
- Selecting domain on left updates right column
- **Launch brand** button (no price shown)
- Muted under button: *Includes hosted website and domain registration*
- Optional PoC: *Sandbox - no charge*
- **Collapse chevron** on card: hide card to review full preview; re-expand chip to finalize

**Edit website** = pre-launch only. Not the post-subscribe unlimited edit flow.

---

## Mock purchase (hackathon)

No price displayed. Button: **Launch brand**. Enabled when domain selected.

User is buying editor + domain + hosting, not a bare domain.

---

## UI - done screen

Blank minimal page after Launch brand:
- Clickable hosted URL + domain URL links
- Two status indicators beside links (hosting + domain) via `useLaunchStatus`
- No post-subscribe edit UI

---

## User flow (PoC)

```
Prompt -> preview builds (localStorage draft)
       -> Confirm website
       -> prompt hidden, Edit website shown, domain card expands
       -> optional: collapse card, review preview, re-expand
       -> select domain, review SerpApi conflicts
       -> Launch brand (mock)
       -> done screen: links + status indicators (client poll)
```

Post-subscribe unlimited edits: demo narration only, not in app.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App frontend | React 19 + Vite SPA on Vercel |
| App styling | Tailwind CSS v4 + selective shadcn/ui |
| App backend | Vercel Serverless Functions (`/api/*`) |
| Hosted pages | Self-contained HTML + embedded Pico CSS |
| HTML storage | Turso or Vercel Postgres (always) |
| Live hosting | Vercel Deploy API (primary) + DB serve (fallback) |
| Draft | React state + localStorage |
| External APIs | name.com sandbox, SerpApi, LLM |

---

## Data model

```typescript
interface Draft {
  prompt: string;
  brandKit: BrandKit;
  pages: PageDraft[];
  status: 'idle' | 'generating' | 'ready' | 'publishing';
}

interface PageDraft {
  slug: string;
  title: string;
  bodyHtml: string;
}

interface PublishedSite {
  siteId: string;
  status: 'live' | 'fallback' | 'publishing';
  hostedUrl: string;
  vercelDeploymentId?: string;
  domainFqdn?: string;
  hostingStatus: 'pending' | 'live' | 'failed';
  domainStatus?: 'pending' | 'live' | 'failed';
}
```

DB tables: `sites` (metadata), `site_pages` (slug, title, html).

---

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/generate` | Prompt -> BrandKit + pages + 2-line summary |
| POST | `/api/sites/publish` | DB save + start deploy -> fast response |
| POST | `/api/domains/suggest` | Available domains + SerpApi conflicts map |
| POST | `/api/domains/suggest/more` | Next domain batch |
| POST | `/api/domains/register` | Mock register + DNS |
| GET | `/api/sites/[siteId]/status` | Hosting + domain status for client poll |
| GET | `/api/sites/[siteId]/[[...path]]` | DB fallback HTML serve |
| GET | `/api/health` | Deploy check |

---

## AI constraints

- Summary: max 2 lines, factual
- Pages: max 5, Pico semantic HTML
- Domains: only name.com-verified available names

---

## Success criteria

- [ ] Prompting UI: 2-line summary, Confirm, no chatbot UX
- [ ] Post-confirm card: equal sponsor columns, collapse/expand
- [ ] Launch brand button, no price
- [ ] Dual-write DB + Vercel deploy; fallback serve works
- [ ] Done screen status poll
- [ ] Demo video 2-4 min (mention unlimited future edits in narration)

---

## Devpost submission checklist (internal)

Submit sandbox-first. Optional: re-record with one real domain if time remains after Aug 28.

### Devpost page

- [ ] Project name: **prompt2brand**
- [ ] One-line pitch (editor + domain + hosting; prompt to build your brand)
- [ ] Link to public GitHub repo with setup instructions
- [ ] Link to live demo URL (Vercel)
- [ ] Tag **name.com** and **SerpApi** sponsor challenges in submission text
- [ ] 2-4 min demo video (YouTube/Vimeo embed)
- [ ] Built during hackathon window (Aug 17 - Sep 3, 2026)

### Demo video script (keep user-facing; no hackathon mentions in app)

1. Land on minimal prompt UI - explain product in voiceover (unlimited future edits after subscribe)
2. Type prompt - preview builds; show 2-line summary (not chatbot UI)
3. Confirm website - domain card expands; highlight **Powered by name.com** | **Powered by SerpApi**
4. Select domain - SerpApi conflicts update on right column
5. Optional: collapse card, review preview, re-expand
6. Launch brand (mock) - done screen with links
7. Status indicators turn live (or explain sandbox propagation timing in voiceover)

### name.com evidence (sandbox - attach to Devpost or `docs/demo-evidence/`)

Redact API keys, tokens, account IDs, and personal contact info before commit or upload.

- [ ] Screenshot or sanitized JSON: **availability check** (only available domains shown)
- [ ] Screenshot or sanitized JSON: **sandbox registration** success response
- [ ] Screenshot or sanitized JSON: **DNS configuration** (records pointing at hostedUrl)
- [ ] One sentence per screenshot in Devpost: *"Registered and DNS configured via name.com API (sandbox)."*

### SerpApi evidence

- [ ] Screenshot of brand-risk column with platform labels (web, Instagram, LinkedIn, X, Facebook)
- [ ] One sentence: *"Live web data via SerpApi for brand conflict checks."*

### Repo

- [ ] README: local dev setup, env vars list (no secret values)
- [ ] `.env.example` with placeholder keys
- [ ] `docs/demo-evidence/` for redacted API logs (optional but recommended for name.com judges)

### Optional stretch (only if sandbox submission is done early)

- [ ] Add name.com account credits; switch to production credentials via env var
- [ ] Register **one** domain; wait until DNS resolves before re-recording
- [ ] Keep sandbox video as backup if production registration fails mid-shoot
- [ ] Update Devpost video only if real domain is live and clickable in recording

### Pre-submit smoke test (run once, same day as video)

- [ ] Prompt -> preview -> confirm -> domain card -> launch -> done screen (full path)
- [ ] Fallback URL works if Vercel deploy is still pending
- [ ] name.com sandbox register + DNS logged server-side
- [ ] SerpApi returns results for selected domain

---

## Open questions

1. Turso vs Vercel Postgres
2. Preview trigger: debounced pause vs submit
3. LLM provider

---

*PoC = first launch only. Unlimited post-subscribe edits = product vision, explained in demo - not built.*