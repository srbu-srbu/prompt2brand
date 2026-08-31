import type { BrandConflict } from "./types";
import { isSerpApiEnabled } from "./integrations";
import {
  conflictKeyword,
  keywordMatchesHaystack,
  quoteForSearch,
} from "../../shared/conflictMatch";

type SerpApiResponse = {
  organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  error?: string;
};

type SerpResult = NonNullable<SerpApiResponse["organic_results"]>[number];

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
  query: (quotedKeyword: string) => string;
}> = [
  { platform: "web", label: "Web", query: (keyword) => keyword },
  {
    platform: "instagram",
    label: "Instagram",
    query: (keyword) => `site:instagram.com ${keyword}`,
  },
  {
    platform: "linkedin",
    label: "LinkedIn",
    query: (keyword) => `site:linkedin.com ${keyword}`,
  },
  { platform: "x", label: "X", query: (keyword) => `site:x.com ${keyword}` },
  {
    platform: "facebook",
    label: "Facebook",
    query: (keyword) => `site:facebook.com ${keyword}`,
  },
];

const CACHE_TTL_MS = 60 * 60 * 1000;
const conflictCache = new Map<string, { expires: number; conflicts: BrandConflict[] }>();

function resultHaystack(result: SerpResult): string {
  return [result.title, result.snippet, result.link].filter(Boolean).join(" ");
}

function findMatchingResult(
  results: SerpApiResponse["organic_results"],
  keyword: string,
): SerpResult | null {
  for (const result of results ?? []) {
    if (keywordMatchesHaystack(resultHaystack(result), keyword)) return result;
  }
  return null;
}

function formatConflictSnippet(result: SerpResult): string | undefined {
  const title = result.title?.trim();
  const snippet = result.snippet?.trim();
  if (title && snippet && !snippet.toLowerCase().includes(title.toLowerCase())) {
    return `${title} — ${snippet}`;
  }
  return snippet ?? title;
}

function cacheKey(fqdn: string): string {
  return `v4:${fqdn.toLowerCase()}`;
}

async function serpApiSearch(query: string, apiKey: string): Promise<SerpApiResponse> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", "5");

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

async function fetchLiveConflicts(fqdn: string): Promise<BrandConflict[]> {
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) return MOCK_CONFLICTS;

  const keyword = conflictKeyword(fqdn);
  const quotedKeyword = quoteForSearch(keyword);
  const conflicts: BrandConflict[] = [];

  for (const platform of PLATFORM_QUERIES) {
    try {
      const data = await serpApiSearch(platform.query(quotedKeyword), apiKey);
      const match = findMatchingResult(data.organic_results, keyword);
      conflicts.push({
        platform: platform.platform,
        label: platform.label,
        found: Boolean(match),
        snippet: match ? formatConflictSnippet(match) : undefined,
        url: match?.link,
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
  _brandName?: string,
): Promise<{ conflicts: BrandConflict[]; source: "mock" | "serpapi" }> {
  if (!isSerpApiEnabled()) {
    return { conflicts: MOCK_CONFLICTS, source: "mock" };
  }

  const key = cacheKey(fqdn);
  const cached = conflictCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return { conflicts: cached.conflicts, source: "serpapi" };
  }

  const conflicts = await fetchLiveConflicts(fqdn);
  conflictCache.set(key, { conflicts, expires: Date.now() + CACHE_TTL_MS });
  return { conflicts, source: "serpapi" };
}
