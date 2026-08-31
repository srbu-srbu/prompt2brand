import type { DomainSuggestion } from "./types";
import {
  brainstormDomainKeywords,
  type DomainBrainstormInput,
  type DomainBrainstormResult,
} from "./domainBrainstorm";
import { extractStemsFromContext } from "./domainPromptParse";
import { hasNamecomConfig, searchDomains, type NamecomSearchResult } from "./namecom";

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
  if (input.stems.length === 0 || input.preferredTlds.length === 0) return [];

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

function resolveStems(
  brainstorm: DomainBrainstormResult,
  input: DomainBrainstormInput,
): string[] {
  if (brainstorm.stems.length > 0) return brainstorm.stems;
  return extractStemsFromContext(input);
}

export async function suggestDomainsFromPrompt(
  prompt: string,
  options?: DomainContext,
): Promise<{
  domains: DomainSuggestion[];
  summary: [string, string, string];
  source: "namecom" | "mock";
  brainstormSource: DomainBrainstormResult["source"];
}> {
  const brainstormInput = buildBrainstormInput(prompt, { ...options, mode: "initial" });
  const brainstorm = await brainstormDomainKeywords(brainstormInput);
  const stems = resolveStems(brainstorm, brainstormInput);

  if (!hasNamecomConfig()) {
    return {
      domains: [],
      summary: brainstorm.summary,
      source: "mock",
      brainstormSource: brainstorm.source,
    };
  }

  try {
    const domains = await searchForStems({
      stems,
      preferredTlds: brainstorm.preferredTlds,
      limit: 8,
    });

    if (domains.length === 0) {
      return {
        domains: [],
        summary: brainstorm.summary,
        source: "mock",
        brainstormSource: brainstorm.source,
      };
    }

    return {
      domains,
      summary: brainstorm.summary,
      source: "namecom",
      brainstormSource: brainstorm.source,
    };
  } catch (error) {
    console.error("name.com suggest failed", error);
    return {
      domains: [],
      summary: brainstorm.summary,
      source: "mock",
      brainstormSource: brainstorm.source,
    };
  }
}

export async function suggestMoreDomains(input: {
  exclude: string[];
  domainCue?: string;
  brandName?: string;
  tagline?: string;
  pageTitles?: string[];
}): Promise<{
  domains: DomainSuggestion[];
  summary: [string, string, string];
  source: "namecom" | "mock";
  brainstormSource: DomainBrainstormResult["source"];
}> {
  const prompt =
    input.domainCue?.trim() ||
    input.brandName?.trim() ||
    input.exclude[0]?.split(".")[0]?.trim() ||
    "brand";

  const brainstormInput = buildBrainstormInput(prompt, {
    brandName: input.brandName,
    tagline: input.tagline,
    pageTitles: input.pageTitles,
    mode: "more",
    excludeFqdns: input.exclude,
  });
  const brainstorm = await brainstormDomainKeywords(brainstormInput);
  const stems = resolveStems(brainstorm, brainstormInput);

  if (!hasNamecomConfig()) {
    return {
      domains: [],
      summary: brainstorm.summary,
      source: "mock",
      brainstormSource: brainstorm.source,
    };
  }

  try {
    const exclude = new Set(input.exclude.map((fqdn) => fqdn.toLowerCase()));
    const domains = await searchForStems({
      stems,
      preferredTlds: brainstorm.preferredTlds,
      exclude,
      limit: 5,
    });

    return {
      domains,
      summary: brainstorm.summary,
      source: "namecom",
      brainstormSource: brainstorm.source,
    };
  } catch (error) {
    console.error("name.com suggest-more failed", error);
    return {
      domains: [],
      summary: brainstorm.summary,
      source: "mock",
      brainstormSource: brainstorm.source,
    };
  }
}
