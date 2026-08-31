import type { BrandConflict } from "./types";
import { isSerpApiEnabled } from "./integrations";

type SerpApiResponse = {
  organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  error?: string;
};

const MOCK_CONFLICTS: BrandConflict[] = [
  { platform: "web", label: "Web", found: false },
  { platform: "instagram", label: "Instagram", found: false },
  { platform: "linkedin", label: "LinkedIn", found: false },
  { platform: "x", label: "X", found: false },
  { platform: "facebook", label: "Facebook", found: false },
];

const PLATFORM_QUERIES: Array<{
  platform: BrandConflict["platform"];
  label: string;
  query: (keyword: string) => string;
}> = [
  { platform: "web", label: "Web", query: (keyword) => keyword },
  { platform: "instagram", label: "Instagram", query: (keyword) => `site:instagram.com ${keyword}` },
  { platform: "linkedin", label: "LinkedIn", query: (keyword) => `site:linkedin.com ${keyword}` },
  { platform: "x", label: "X", query: (keyword) => `site:x.com ${keyword}` },
  { platform: "facebook", label: "Facebook", query: (keyword) => `site:facebook.com ${keyword}` },
];

const CACHE_TTL_MS = 60 * 60 * 1000;
const conflictCache = new Map<string, { expires: number; conflicts: BrandConflict[] }>();

function brandKeyword(fqdn: string, brandName?: string): string {
  const fromName = brandName?.trim();
  if (fromName) return fromName;
  return fqdn.split(".")[0]?.replace(/-/g, " ") ?? fqdn;
}

function cacheKey(fqdn: string, brandName?: string): string {
  return `${fqdn.toLowerCase()}::${brandName?.trim().toLowerCase() ?? ""}`;
}

async function serpApiSearch(query: string, apiKey: string): Promise<SerpApiResponse> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", "3");

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`SerpApi ${response.status}: ${text || response.statusText}`);
  }

  const data = (await response.json()) as SerpApiResponse;
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

async function fetchLiveConflicts(fqdn: string, brandName?: string): Promise<BrandConflict[]> {
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) return MOCK_CONFLICTS;

  const keyword = brandKeyword(fqdn, brandName);
  const conflicts: BrandConflict[] = [];

  for (const platform of PLATFORM_QUERIES) {
    try {
      const data = await serpApiSearch(platform.query(keyword), apiKey);
      const top = data.organic_results?.[0];
      conflicts.push({
        platform: platform.platform,
        label: platform.label,
        found: Boolean(top),
        snippet: top?.snippet ?? top?.title,
      });
    } catch (error) {
      console.error(`SerpApi ${platform.platform} lookup failed`, error);
      conflicts.push({
        platform: platform.platform,
        label: platform.label,
        found: false,
      });
    }
  }

  return conflicts;
}

export async function getBrandConflicts(
  fqdn: string,
  brandName?: string,
): Promise<{ conflicts: BrandConflict[]; source: "mock" | "serpapi" }> {
  if (!isSerpApiEnabled()) {
    return { conflicts: MOCK_CONFLICTS, source: "mock" };
  }

  const key = cacheKey(fqdn, brandName);
  const cached = conflictCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return { conflicts: cached.conflicts, source: "serpapi" };
  }

  const conflicts = await fetchLiveConflicts(fqdn, brandName);
  conflictCache.set(key, { conflicts, expires: Date.now() + CACHE_TTL_MS });
  return { conflicts, source: "serpapi" };
}
