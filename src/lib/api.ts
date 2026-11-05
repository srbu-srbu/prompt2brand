import {
  brandKitFromPrompt,
  buildClientMockHomePage,
  createClientPlaceholderBrandAssets,
} from "./clientBrandAssets";
import type {
  BrandAssets,
  BrandConflict,
  BrandKit,
  DomainSuggestion,
  PageDraft,
  PublishedSite,
  SummaryLines,
} from "./types";

export async function apiDomainConflicts(fqdn: string, brandName?: string) {
  const params = new URLSearchParams({ fqdn });
  if (brandName?.trim()) params.set("brandName", brandName.trim());
  const res = await fetch(`/api/domains/conflicts?${params}`);
  if (!res.ok) throw new Error("Conflict check failed");
  return res.json() as Promise<{ conflicts: BrandConflict[]; source: "mock" | "serpapi" }>;
}

export async function apiGenerate(
  prompt: string,
  draft: { pages: PageDraft[]; brandKit?: BrandKit; brandAssets?: BrandAssets; promptHistory?: string[] },
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
    brandAssets?: BrandAssets;
    pages: PageDraft[];
    summary: SummaryLines;
    source?: "llm" | "mock";
    error?: string;
  }>;
}

export async function apiLogoGenerate(input: {
  prompt: string;
  brandKit: BrandKit;
  brandAssets?: BrandAssets;
}) {
  const res = await fetch("/api/logo/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Logo generate failed");
  }
  return res.json() as Promise<{
    brandAssets?: BrandAssets;
    summary: SummaryLines;
    source?: "llm" | "mock";
    error?: string;
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
    source?: "namecom" | "mock";
    brainstormSource?: "llm" | "mock";
  }>;
}

export async function apiDomainSuggestMore(input: {
  exclude: string[];
  domainCue?: string;
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
  return res.json() as Promise<{
    domains: DomainSuggestion[];
    summary: SummaryLines;
    source?: "namecom" | "mock";
    brainstormSource?: "llm" | "mock";
  }>;
}

export async function apiPublish(payload: {
  draft: { pages: PageDraft[]; brandKit: BrandKit; brandAssets?: BrandAssets };
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
  draft: { pages: PageDraft[]; brandKit?: BrandKit; brandAssets?: BrandAssets },
) {
  await delay(600);

  if (draft.pages.length > 0 && draft.brandKit) {
    const brandAssets =
      draft.brandAssets ?? createClientPlaceholderBrandAssets(draft.brandKit, 1);
    return {
      brandKit: draft.brandKit,
      brandAssets,
      pages: draft.pages,
      summary: [
        "AI unavailable — kept your current preview.",
        `Latest cue: ${prompt.slice(0, 60)}`,
        "Try again in a moment if the Meta Model API was rate-limited.",
      ] satisfies SummaryLines,
      source: "mock" as const,
    };
  }

  const brandKit = brandKitFromPrompt(prompt, draft.brandKit);
  const brandAssets = draft.brandAssets ?? createClientPlaceholderBrandAssets(brandKit);
  const pages: PageDraft[] = [
    {
      slug: "home",
      title: "Home",
      bodyHtml: buildClientMockHomePage(brandKit),
    },
  ];

  return {
    brandKit,
    brandAssets,
    pages,
    summary: [
      "Offline preview — run vercel dev for full AI site generation.",
      `Latest cue: ${prompt.slice(0, 60)}`,
      "Logo tab is available; Muse image generation still needs the API.",
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

export async function safeLogoGenerate(input: {
  prompt: string;
  brandKit: BrandKit;
  brandAssets?: BrandAssets;
}) {
  try {
    const result = await apiLogoGenerate(input);
    if (result.source === "mock" && result.error) {
      return {
        ...result,
        summary: [result.summary[0], result.summary[1], result.error.slice(0, 120)] satisfies SummaryLines,
      };
    }
    return result;
  } catch (error) {
    console.warn("Logo API failed", error);
    return {
      brandAssets: input.brandAssets,
      source: "mock" as const,
      summary: [
        "Logo update failed — try again in a moment.",
        `Latest cue: ${input.prompt.slice(0, 60)}`,
        "Start vercel dev for API routes — npm run dev alone has no backend.",
      ] satisfies SummaryLines,
    };
  }
}

export async function safeGenerate(
  prompt: string,
  draft: { pages: PageDraft[]; brandKit?: BrandKit; brandAssets?: BrandAssets; promptHistory?: string[] },
) {
  try {
    const result = await apiGenerate(prompt, draft);
    if (result.source === "mock") {
      console.warn("Generate used server mock fallback — check MODEL_API_KEY / logs");
      if (result.error) {
        return {
          ...result,
          summary: [
            result.summary[0],
            result.summary[1],
            result.error.slice(0, 120),
          ] satisfies SummaryLines,
        };
      }
    }
    return result;
  } catch (error) {
    console.warn("Generate API failed, using client mock fallback", error);
    const fallback = await mockGenerate(prompt, draft);
    return {
      ...fallback,
      summary: [
        fallback.summary[0],
        fallback.summary[1],
        "Start vercel dev for API routes — npm run dev alone proxies /api to :3000 with no backend.",
      ] satisfies SummaryLines,
    };
  }
}

export async function safeDomainSuggest(
  prompt: string,
  options?: { brandName?: string; tagline?: string; pageTitles?: string[] },
) {
  const result = await apiDomainSuggest(prompt, options);
  if (result.brainstormSource === "mock") {
    console.warn("Domain brainstorm used script fallback — check MODEL_API_KEY / logs");
  }
  return result;
}

export async function safePublish(payload: {
  draft: { pages: PageDraft[]; brandKit: BrandKit; brandAssets?: BrandAssets };
  domainFqdn: string;
}) {
  try {
    return await apiPublish(payload);
  } catch {
    return mockPublish(payload.domainFqdn);
  }
}
