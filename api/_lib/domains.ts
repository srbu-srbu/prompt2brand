import type { DomainSuggestion } from "./types";
import {
  brainstormDomainKeywords,
  sanitizeStem,
  type DomainBrainstormInput,
} from "./domainBrainstorm";
import { hasNamecomConfig, searchDomains, type NamecomSearchResult } from "./namecom";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "with",
  "from",
  "your",
  "my",
  "our",
  "brand",
  "website",
  "domain",
  "name",
  "called",
  "named",
  "short",
  "playful",
  "try",
  "prefix",
  "suffix",
]);

type DomainContext = {
  brandName?: string;
  tagline?: string;
  pageTitles?: string[];
};

function formatPriceLabel(result: NamecomSearchResult): string {
  if (result.purchasePrice != null) {
    return `$${result.purchasePrice.toFixed(2)}/yr`;
  }
  return "Available";
}

function toSuggestion(result: NamecomSearchResult): DomainSuggestion | null {
  if (!result.purchasable) return null;
  if (result.premium) return null;
  if (result.purchaseType && result.purchaseType !== "registration") return null;

  return {
    fqdn: result.domainName,
    priceLabel: formatPriceLabel(result),
  };
}

export function keywordFromPrompt(prompt: string): string {
  const cleaned = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim();

  const words = cleaned
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  const compact = words.join("").replace(/[^a-z0-9]/g, "");
  if (compact.length >= 3) return compact.slice(0, 40);

  const fallback = cleaned.replace(/\s+/g, "").slice(0, 40);
  return fallback || "brand";
}

function dedupeDomains(domains: DomainSuggestion[]): DomainSuggestion[] {
  const seen = new Set<string>();
  const output: DomainSuggestion[] = [];

  for (const domain of domains) {
    const key = domain.fqdn.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(domain);
  }

  return output;
}

async function searchForStems(input: {
  stems: string[];
  preferredTlds: string[];
  exclude?: Set<string>;
  limit: number;
}): Promise<DomainSuggestion[]> {
  const batches = await Promise.all(
    input.stems.map((stem) =>
      searchDomains({
        keyword: stem,
        tldFilter: input.preferredTlds,
      }),
    ),
  );

  return dedupeDomains(
    batches
      .flat()
      .map(toSuggestion)
      .filter((domain): domain is DomainSuggestion => domain !== null)
      .filter((domain) => !input.exclude?.has(domain.fqdn.toLowerCase())),
  ).slice(0, input.limit);
}

function buildBrainstormInput(
  prompt: string,
  options: DomainContext & { mode?: DomainBrainstormInput["mode"]; excludeFqdns?: string[] },
): DomainBrainstormInput {
  return {
    prompt,
    brandName: options.brandName,
    tagline: options.tagline,
    pageTitles: options.pageTitles,
    mode: options.mode,
    excludeFqdns: options.excludeFqdns,
  };
}

export async function suggestDomainsFromPrompt(
  prompt: string,
  options?: DomainContext,
): Promise<{
  domains: DomainSuggestion[];
  summary: [string, string, string];
  source: "namecom" | "mock";
}> {
  const brainstorm = await brainstormDomainKeywords(
    buildBrainstormInput(prompt, { ...options, mode: "initial" }),
  );

  if (!hasNamecomConfig()) {
    return { domains: [], summary: brainstorm.summary, source: "mock" };
  }

  try {
    const stems =
      brainstorm.stems.length > 0 ? brainstorm.stems : [keywordFromPrompt(prompt)];

    const domains = await searchForStems({
      stems,
      preferredTlds: brainstorm.preferredTlds,
      limit: 8,
    });

    if (domains.length === 0) {
      return { domains: [], summary: brainstorm.summary, source: "mock" };
    }

    return { domains, summary: brainstorm.summary, source: "namecom" };
  } catch (error) {
    console.error("name.com suggest failed", error);
    return { domains: [], summary: brainstorm.summary, source: "mock" };
  }
}

export async function suggestMoreDomains(input: {
  exclude: string[];
  prompt?: string;
  brandName?: string;
  tagline?: string;
  pageTitles?: string[];
}): Promise<{
  domains: DomainSuggestion[];
  summary: [string, string, string];
  source: "namecom" | "mock";
}> {
  const prompt =
    input.prompt?.trim() ||
    input.brandName?.trim() ||
    sanitizeStem(input.exclude[0]?.split(".")[0] ?? "") ||
    "brand";

  const brainstorm = await brainstormDomainKeywords(
    buildBrainstormInput(prompt, {
      brandName: input.brandName,
      tagline: input.tagline,
      pageTitles: input.pageTitles,
      mode: "more",
      excludeFqdns: input.exclude,
    }),
  );

  if (!hasNamecomConfig()) {
    return { domains: [], summary: brainstorm.summary, source: "mock" };
  }

  try {
    const exclude = new Set(input.exclude.map((fqdn) => fqdn.toLowerCase()));
    const stems =
      brainstorm.stems.length > 0 ? brainstorm.stems : [keywordFromPrompt(prompt)];

    const domains = await searchForStems({
      stems,
      preferredTlds: brainstorm.preferredTlds,
      exclude,
      limit: 5,
    });

    return { domains, summary: brainstorm.summary, source: "namecom" };
  } catch (error) {
    console.error("name.com suggest-more failed", error);
    return { domains: [], summary: brainstorm.summary, source: "mock" };
  }
}
