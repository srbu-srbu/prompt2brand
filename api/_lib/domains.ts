import type { DomainSuggestion } from "./types";
import { MOCK_DOMAINS } from "./mock";
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

const MORE_TLD_SETS = [
  ["io", "co", "net"],
  ["org", "app", "dev"],
  ["shop", "store", "online"],
];

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

export function keywordForMore(exclude: string[], keyword?: string): string {
  const explicit = keyword?.trim();
  if (explicit) return keywordFromPrompt(explicit);

  const stem = exclude[0]?.split(".")[0];
  if (stem) return stem;

  return "brand";
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

export async function suggestDomainsFromPrompt(prompt: string): Promise<{
  domains: DomainSuggestion[];
  source: "namecom" | "mock";
}> {
  if (!hasNamecomConfig()) {
    return { domains: [...MOCK_DOMAINS], source: "mock" };
  }

  try {
    const keyword = keywordFromPrompt(prompt);
    const results = await searchDomains({ keyword });
    const domains = dedupeDomains(
      results.map(toSuggestion).filter((domain): domain is DomainSuggestion => domain !== null),
    ).slice(0, 8);

    if (domains.length === 0) {
      return { domains: [...MOCK_DOMAINS], source: "mock" };
    }

    return { domains, source: "namecom" };
  } catch (error) {
    console.error("name.com suggest failed", error);
    return { domains: [...MOCK_DOMAINS], source: "mock" };
  }
}

export async function suggestMoreDomains(input: {
  exclude: string[];
  keyword?: string;
}): Promise<{ domains: DomainSuggestion[]; source: "namecom" | "mock" }> {
  if (!hasNamecomConfig()) {
    return {
      domains: MOCK_DOMAINS.filter((domain) => !input.exclude.includes(domain.fqdn)),
      source: "mock",
    };
  }

  try {
    const keyword = keywordForMore(input.exclude, input.keyword);
    const tldFilter = MORE_TLD_SETS[input.exclude.length % MORE_TLD_SETS.length];
    const results = await searchDomains({ keyword, tldFilter });
    const exclude = new Set(input.exclude.map((fqdn) => fqdn.toLowerCase()));

    const domains = dedupeDomains(
      results
        .map(toSuggestion)
        .filter((domain): domain is DomainSuggestion => domain !== null)
        .filter((domain) => !exclude.has(domain.fqdn.toLowerCase())),
    ).slice(0, 5);

    return { domains, source: "namecom" };
  } catch (error) {
    console.error("name.com suggest-more failed", error);
    return {
      domains: MOCK_DOMAINS.filter((domain) => !input.exclude.includes(domain.fqdn)),
      source: "mock",
    };
  }
}
