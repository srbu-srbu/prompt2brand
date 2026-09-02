# prompt2brand — Devpost project story

> Paste sections below into the Devpost **About the project** field. Markdown is supported.

## Inspiration

Starting a brand today usually means juggling too many tools: one app to draft a website, another to search domains, another to check whether the name is already taken on social, and more steps to deploy and connect DNS.

**prompt2brand** is our answer: describe your business once, see a multi-page site build in the browser, pick from **name.com-verified available domains**, review **SerpApi-powered brand conflict signals**, and launch hosting plus registration from a single screen.

The long-term product vision goes further than this PoC — subscribe once, come back anytime, prompt changes, redeploy unlimited times. This demo focuses on the **first launch**: prompt → preview → domain → go live.

## What it does

1. **Prompt** — The user describes their brand; Gemini (via Vercel AI Gateway) generates up to five static HTML pages.
2. **Preview** — The site renders live in-app while the user keeps prompting (website tab or domain tab).
3. **Domain search** — An LLM brainstorms search **stems** and **preferred TLDs**; **name.com Search** returns only purchasable, non-premium registration domains.
4. **Brand risk check** — When a domain is selected, **SerpApi** searches the web, Instagram, LinkedIn, X, and Facebook for conflicting names.
5. **Launch** — One **Launch brand** action saves HTML to **Neon Postgres**, deploys a static site via the **Vercel Deploy API**, registers the domain through **name.com**, and creates a `www` CNAME to the hosted URL.

**Live demo:** [prompt2brand.vercel.app](https://prompt2brand.vercel.app)

## How we built it

We kept scope tight for a solo hackathon PoC:

| Layer | Choice |
|-------|--------|
| Frontend | React 19 + Vite SPA, Tailwind CSS v4 |
| Backend | Vercel Serverless Functions (`/api/*`) |
| AI | Vercel AI Gateway → `google/gemini-2.5-flash-lite` |
| Storage | Neon Postgres (wrapped HTML per page) |
| Hosting | One Vercel static deployment per launch (`p2b-{siteId}.vercel.app`) |

**Architecture highlights:**

- **Dual-write on launch** — Postgres for persistence plus Vercel deploy for CDN hosting, with a DB fallback route if deploy is still pending.
- **LLM does not pick final domain names** — it outputs stems and TLD preferences; **name.com** is the source of truth for availability.
- **Preview vs publish link handling** — LLM output may use hash links (`#about`); preview rewrites them for the iframe, and publish rewrites them to clean paths (`/about`) before deploy.
- **Live Integrations flag** — Off by default: developement name.com API and mock SerpApi for safe demos without incurring costs. On switches to production name.com API and live SerpApi.

The UI stays minimal on purpose: prompt panel at the bottom, preview canvas in the center, domain card as a bottom overlay with equal **name.com** and **SerpApi** columns, and an in-card launch status panel with step-by-step progress.

## Challenges we ran into

1. **Multi-page preview in an iframe** — Generated HTML fragments needed consistent navigation between preview and deployed site. Central link-rewrite logic solved that without changing the LLM contract.

2. **Domain brainstorm quality** — Getting useful stems and TLD filters from short prompts took several iterations: structured LLM output (stems + preferred TLDs), a script fallback parser, and a **More suggestions** flow that excludes already-shown domains.

3. **Registry rules in sandbox** — name.com sandbox still enforces real TLD rules. Some extensions require a longer minimum registration term than others; requesting the wrong term returned `Invalid years` until we matched term length per TLD.

4. **SerpApi conflict matching** — A result could look like a false alarm: the brand name matched a Facebook page URL (for example, `facebook.com/JoeTheElectrician`) but did not appear anywhere in the snippet. We started showing the full result URL plus the snippet, with the matching word highlighted, so users can judge for themselves whether it is a real conflict.

5. **End-to-end launch is async and multi-step** — Hosting (Vercel deploy), domain registration (name.com), and DNS (CNAME) can succeed or fail independently. We added status polling and per-row step indicators so users see what is happening instead of a single spinner.

6. **Solo timeline** — With a Sep 3 deadline, we chose React + Vite over SSR, kept customer sites as static HTML only (no backend on hosted pages), and documented the as-built architecture as we went.

## Accomplishments that we're proud of

- **One-screen flow** from prompt to live brand — no separate tools for site, domain, conflicts, or launch.
- **Real sponsor API integration** — name.com for search, registration, and DNS; SerpApi for multi-platform brand conflict checks.
- **Honest domain pipeline** — the LLM suggests search keywords; name.com verifies availability before anything is shown to the user.
- **Production-shaped launch** — dual-write to Neon + Vercel Deploy API, status polling, fallback URL serving from Postgres, and custom domain registration with DNS pointing.
- **Demo-safe defaults** — sandbox name.com and mock SerpApi when the Live Integrations flag is off, with a clear Live Integration On/Off indicator in the UI.
- **Shipped as a solo PoC** — full stack, documented in the repo, live on Vercel, ready for judges to try.

## What we learned

- **APIs compose better than monoliths** — name.com handles availability, registration, and DNS; SerpApi handles brand discovery; Vercel handles compute and hosting. prompt2brand is mostly orchestration glue.
- **An iframe cannot render a multi-page website with hash links seamlessly** — LLM-generated pages often use `#about`-style references, which do not map cleanly to real paths in a preview iframe. We learned to rewrite links differently for in-app preview versus the published site so navigation feels natural in both places.
- **PoC scope discipline** — skipping auth, billing, and post-subscribe editing let us ship a complete first-launch story end-to-end in time for the deadline.
- **Status UX matters** — when launch touches three external systems, users need row-level progress, not just success or failure.

## What's next for prompt2brand

- **Accounts and billing** — Sign-in, subscription, and saved sites so returning customers can extend what they launched in the demo.
- **Analytics and SEO** — Basic traffic insights, meta tags, and sitemap generation for launched sites.
- **Image uploads** — Let users add their own photos and logos instead of relying on external URLs or placeholders, with sensible defaults from the brand kit.
- **Simple forms** — Contact, lead capture, and newsletter blocks generated from the prompt and wired to a lightweight backend or email integration.
- **RSVP and event modules** — Turn-up pages for openings, workshops, or launches with headcount collection and confirmation messaging.

---

**Repo:** [github.com/srbu-srbu/prompt2brand](https://github.com/srbu-srbu/prompt2brand)

**Note for judges:** Demo runs on name.com sandbox by default (Live Integrations flag **Off**). Turn it **On** for live SerpApi and production name.com evidence.
