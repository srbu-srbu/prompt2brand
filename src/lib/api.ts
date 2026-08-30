import type { BrandConflict, BrandKit, DomainSuggestion, PageDraft, PublishedSite } from "./types";

const DEFAULT_CONFLICTS: BrandConflict[] = [
  { platform: "web", label: "Web", found: false },
  { platform: "instagram", label: "Instagram", found: false },
  { platform: "linkedin", label: "LinkedIn", found: false },
  { platform: "x", label: "X", found: false },
  { platform: "facebook", label: "Facebook", found: false },
];

export function conflictsForDomain(_fqdn: string): BrandConflict[] {
  return DEFAULT_CONFLICTS;
}

export async function apiGenerate(
  prompt: string,
  draft: { pages: PageDraft[]; brandKit?: BrandKit; promptHistory?: string[] },
) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, draft }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Generate failed");
  }
  return res.json() as Promise<{
    brandKit: BrandKit;
    pages: PageDraft[];
    summary: [string, string];
    source?: "llm" | "mock";
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

export async function apiDomainSuggestMore(exclude: string[], keyword?: string) {
  const res = await fetch("/api/domains/suggest/more", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exclude, keyword }),
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Publish failed");
  }
  return res.json() as Promise<PublishedSite & { siteId: string }>;
}

export async function apiSiteStatus(siteId: string) {
  const res = await fetch(`/api/sites/status/${siteId}`);
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

export async function mockGenerate(
  prompt: string,
  draft: { pages: PageDraft[]; brandKit?: BrandKit },
) {
  await delay(600);

  if (draft.pages.length > 0 && draft.brandKit) {
    return {
      brandKit: draft.brandKit,
      pages: draft.pages,
      summary: [
        "AI unavailable — kept your current preview.",
        `Latest cue: ${prompt.slice(0, 60)}`,
      ] as [string, string],
      source: "mock" as const,
    };
  }

  return {
    brandKit: draft.brandKit ?? {
      name: "",
      tagline: "",
      primaryColor: "#2563eb",
      accentColor: "#f59e0b",
      fontFamily: "system-ui, sans-serif",
    },
    pages: [],
    summary: [
      "AI unavailable — no preview generated.",
      `Latest cue: ${prompt.slice(0, 60)}`,
    ] as [string, string],
    source: "mock" as const,
  };
}

export async function mockDomainSuggest(prompt: string) {
  await delay(400);
  return {
    domains: [],
    summary: ["No domain suggestions available.", `Keywords: ${prompt.slice(0, 60)}`] as [string, string],
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

export async function safeGenerate(
  prompt: string,
  draft: { pages: PageDraft[]; brandKit?: BrandKit; promptHistory?: string[] },
) {
  try {
    const result = await apiGenerate(prompt, draft);
    if ("source" in result && result.source === "mock") {
      console.warn("Generate used server mock fallback — check AI gateway / logs");
    }
    return result;
  } catch {
    console.warn("Generate API failed, using client mock fallback");
    return mockGenerate(prompt, draft);
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
