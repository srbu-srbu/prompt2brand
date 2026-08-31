import type { BrandConflict, BrandKit, DomainSuggestion, PageDraft, PublishedSite, SummaryLines } from "./types";

export async function apiDomainConflicts(fqdn: string, brandName?: string) {
  const params = new URLSearchParams({ fqdn });
  if (brandName?.trim()) params.set("brandName", brandName.trim());
  const res = await fetch(`/api/domains/conflicts?${params}`);
  if (!res.ok) throw new Error("Conflict check failed");
  return res.json() as Promise<{ conflicts: BrandConflict[]; source: "mock" | "serpapi" }>;
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
    summary: SummaryLines;
    source?: "llm" | "mock";
  }>;
}

export async function apiDomainSuggest(
  prompt: string,
  options?: { brandName?: string; tagline?: string; pageTitles?: string[] },
) {
  const res = await fetch("/api/domains/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      brandName: options?.brandName,
      tagline: options?.tagline,
      pageTitles: options?.pageTitles,
    }),
  });
  if (!res.ok) throw new Error("Domain suggest failed");
  return res.json() as Promise<{
    domains: DomainSuggestion[];
    summary: SummaryLines;
  }>;
}

export async function apiDomainSuggestMore(input: {
  exclude: string[];
  prompt?: string;
  brandName?: string;
  tagline?: string;
  pageTitles?: string[];
}) {
  const res = await fetch("/api/domains/suggest/more", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("More suggestions failed");
  return res.json() as Promise<{ domains: DomainSuggestion[]; summary: SummaryLines }>;
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
        "Try again in a moment if the AI gateway was rate-limited.",
      ] satisfies SummaryLines,
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
      "Try again in a moment if the AI gateway was rate-limited.",
    ] satisfies SummaryLines,
    source: "mock" as const,
  };
}

export async function mockDomainSuggest(prompt: string) {
  await delay(400);
  return {
    domains: [],
    summary: [
      "No domain suggestions available.",
      `Keywords: ${prompt.slice(0, 60)}`,
      "Try different keywords or a shorter brand name.",
    ] satisfies SummaryLines,
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

export async function safeDomainSuggest(
  prompt: string,
  options?: { brandName?: string; tagline?: string; pageTitles?: string[] },
) {
  try {
    return await apiDomainSuggest(prompt, options);
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
