import type { BrandConflict } from "./types";
import { isSerpApiEnabled } from "./integrations";

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

/** Conflict checks use the selected domain stem (e.g. miliojen from miliojen.org). */
function conflictKeyword(fqdn: string): string {
  return fqdn.split(".")[0]?.replace(/-/g, " ").trim().toLowerCase() ?? fqdn.toLowerCase();
}

function quoteForSearch(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) return trimmed;
  return trimmed.includes(" ") ? `"${trimmed}"` : `"${trimmed}"`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedAlphaNum(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length] ?? 0;
}

function resultHaystack(result: SerpResult): string {
  return [result.title, result.snippet, result.link].filter(Boolean).join(" ");
}

function hasWholeWordMatch(part: string, haystack: string): boolean {
  if (part.length < 3) return false;
  const re = new RegExp(`\\b${escapeRegex(part)}\\b`, "i");
  return re.test(haystack);
}

function hasCloseTokenMatch(part: string, haystack: string): boolean {
  const target = normalizedAlphaNum(part);
  if (target.length < 4) return false;

  const tokens = haystack
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(normalizedAlphaNum)
    .filter((token) => token.length > 0);

  for (const token of tokens) {
    if (Math.abs(token.length - target.length) > 1) continue;
    if (levenshtein(target, token) <= 1) return true;
  }

  return false;
}

function resultMatchesKeyword(result: SerpResult, keyword: string): boolean {
  const haystack = resultHaystack(result);
  const parts = keyword.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;

  return parts.every(
    (part) => hasWholeWordMatch(part, haystack) || hasCloseTokenMatch(part, haystack),
  );
}

function findMatchingResult(
  results: SerpApiResponse["organic_results"],
  keyword: string,
): SerpResult | null {
  for (const result of results ?? []) {
    if (resultMatchesKeyword(result, keyword)) return result;
  }
  return null;
}

function cacheKey(fqdn: string): string {
  return fqdn.toLowerCase();
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
        snippet: match?.snippet ?? match?.title,
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
