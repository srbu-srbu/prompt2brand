import type { BrandConflict, BrandKit, DomainSuggestion, PageDraft, PublishedSite } from "./types";

const MOCK_CONFLICTS: Record<string, BrandConflict[]> = {
  "pawfuel.com": [
    { platform: "web", label: "Web", found: true, snippet: "pawfuel.com - pet nutrition retailer" },
    { platform: "instagram", label: "Instagram", found: true, snippet: "@pawfuel" },
    { platform: "linkedin", label: "LinkedIn", found: false },
    { platform: "x", label: "X", found: true, snippet: "@pawfuel" },
    { platform: "facebook", label: "Facebook", found: false },
  ],
};

export function conflictsForDomain(fqdn: string): BrandConflict[] {
  return (
    MOCK_CONFLICTS[fqdn] ?? [
      { platform: "web", label: "Web", found: false },
      { platform: "instagram", label: "Instagram", found: false },
      { platform: "linkedin", label: "LinkedIn", found: false },
      { platform: "x", label: "X", found: false },
      { platform: "facebook", label: "Facebook", found: false },
    ]
  );
}

export async function apiGenerate(prompt: string, draft: { pages: PageDraft[] }) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, draft }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.intent === "domain") {
      return apiDomainSuggest(prompt);
    }
    throw new Error(err.error ?? "Generate failed");
  }
  return res.json() as Promise<{
    brandKit: BrandKit;
    pages: PageDraft[];
    summary: [string, string];
  }>;
}

export async function apiDomainSuggest(prompt: string) {
  const res = await fetch("/api/domains/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Domain suggest failed");
  return res.json() as Promise<{
    domains: DomainSuggestion[];
    summary: [string, string];
  }>;
}

export async function apiDomainSuggestMore(exclude: string[]) {
  const res = await fetch("/api/domains/suggest/more", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exclude }),
  });
  if (!res.ok) throw new Error("More suggestions failed");
  return res.json() as Promise<{ domains: DomainSuggestion[] }>;
}

export async function apiPublish(payload: {
  draft: { pages: PageDraft[]; brandKit: BrandKit };
  domainFqdn: string;
}) {
  const res = await fetch("/api/sites/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Publish failed");
  return res.json() as Promise<PublishedSite & { siteId: string }>;
}

export async function apiSiteStatus(siteId: string, tick: number) {
  const res = await fetch(`/api/sites/${siteId}/status?tick=${tick}`);
  if (!res.ok) throw new Error("Status failed");
  return res.json() as Promise<{
    hosting: PublishedSite["hostingStatus"];
    domain: PublishedSite["domainStatus"];
    hostedUrl: string;
    domainFqdn: string;
  }>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockGenerate(prompt: string, hasSite: boolean) {
  await delay(600);
  if (hasSite) {
    const nameMatch = prompt.match(/(?:called|named|say)\s+([A-Za-z0-9]+)/i);
    const name = nameMatch?.[1] ?? "PawFuel";
    return {
      brandKit: {
        name,
        tagline: "Clean energy for active dogs",
        primaryColor: "#2563eb",
        accentColor: "#f59e0b",
        fontFamily: "system-ui, sans-serif",
      },
      pages: [
        {
          slug: "home",
          title: "Home",
          bodyHtml: `<header><h1>${name}</h1><p>Clean energy for active dogs</p></header><main><section><h2>Fuel their adventure</h2><p>Human-grade ingredients. Vet-approved formulas.</p></section></main>`,
        },
      ],
      summary: ["Updated site from your prompt.", `Latest cue: ${prompt.slice(0, 60)}`] as [string, string],
    };
  }
  return {
    brandKit: {
      name: "PawFuel",
      tagline: "Clean energy for active dogs",
      primaryColor: "#2563eb",
      accentColor: "#f59e0b",
      fontFamily: "system-ui, sans-serif",
    },
    pages: [
      {
        slug: "home",
        title: "Home",
        bodyHtml:
          "<header><h1>PawFuel</h1><p>Clean energy for active dogs</p></header><main><section><h2>Fuel their adventure</h2><p>Human-grade ingredients. Vet-approved formulas.</p></section></main>",
      },
    ],
    summary: ["Built your brand preview.", "Open domain suggestions when ready."] as [string, string],
  };
}

export async function mockDomainSuggest(prompt: string) {
  await delay(400);
  return {
    domains: [
      { fqdn: "pawfuel.com", priceLabel: "Available" },
      { fqdn: "pawfuel.co", priceLabel: "Available" },
      { fqdn: "getpawfuel.com", priceLabel: "Available" },
    ],
    summary: ["Searching domains from your cues.", `Keywords: ${prompt.slice(0, 60)}`] as [string, string],
  };
}

export async function mockPublish(domainFqdn: string) {
  await delay(500);
  const siteId = `p2b-${Date.now().toString(36)}`;
  return {
    siteId,
    hostedUrl: `https://${siteId}.vercel.app`,
    domainFqdn,
    hostingStatus: "pending" as const,
    domainStatus: "pending" as const,
  };
}

export async function safeGenerate(prompt: string, draft: { pages: PageDraft[] }) {
  try {
    return await apiGenerate(prompt, draft);
  } catch {
    return mockGenerate(prompt, draft.pages.length > 0);
  }
}

export async function safeDomainSuggest(prompt: string) {
  try {
    return await apiDomainSuggest(prompt);
  } catch {
    return mockDomainSuggest(prompt);
  }
}

export async function safePublish(payload: {
  draft: { pages: PageDraft[]; brandKit: BrandKit };
  domainFqdn: string;
}) {
  try {
    return await apiPublish(payload);
  } catch {
    return mockPublish(payload.domainFqdn);
  }
}
