import type { DomainBrainstormInput } from "./domainBrainstorm";
import { sanitizeStem } from "./domainBrainstorm";

export const ALLOWED_TLDS = new Set([
  "com",
  "org",
  "net",
  "io",
  "co",
  "app",
  "dev",
  "ai",
  "shop",
  "store",
  "online",
  "info",
  "biz",
]);

const TLD_STOP_WORDS = new Set([
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
  "please",
  "provide",
  "show",
  "give",
  "want",
  "need",
  "try",
  "domain",
  "domains",
  "name",
  "names",
  "extension",
  "extensions",
  "tld",
  "tlds",
  "available",
  "search",
  "find",
  "using",
  "use",
  "only",
  "just",
  "also",
  "add",
  "more",
  "some",
  "new",
  "brand",
  "website",
  "site",
]);

const SENTENCE_MARKERS =
  /\b(please|provide|extension|extensions|domain|domains|suggest|search|available|show me|give me)\b/i;

/** Pull explicit TLD requests like ".dev", ".ai", or "dev and ai extensions". */
export function extractTldsFromPrompt(prompt: string): string[] {
  const found = new Set<string>();

  for (const match of prompt.matchAll(/\.([a-z]{2,24})\b/gi)) {
    const tld = match[1].toLowerCase();
    if (ALLOWED_TLDS.has(tld)) found.add(tld);
  }

  for (const match of prompt.matchAll(
    /\b(com|org|net|io|co|app|dev|ai|shop|store|online|info|biz)\b/gi,
  )) {
    const tld = match[1].toLowerCase();
    if (ALLOWED_TLDS.has(tld)) found.add(tld);
  }

  return [...found];
}

export function looksLikeSentenceStem(stem: string): boolean {
  if (stem.length > 24) return true;
  if (SENTENCE_MARKERS.test(stem)) return true;
  if (stem.split("-").some((part) => part.length > 16)) return true;
  return false;
}

export function normalizeStems(raw: string[]): string[] {
  const stems: string[] = [];

  for (const value of raw) {
    const stem = sanitizeStem(value);
    if (stem.length < 3 || looksLikeSentenceStem(stem)) continue;
    if (ALLOWED_TLDS.has(stem)) continue;
    stems.push(stem);
  }

  return [...new Set(stems)];
}

/** Script fallback when the LLM is unavailable — never compact the whole prompt line. */
export function extractStemsFromContext(input: DomainBrainstormInput): string[] {
  const stems = new Set<string>();

  if (input.brandName) {
    const brand = sanitizeStem(input.brandName);
    if (brand.length >= 3 && !looksLikeSentenceStem(brand)) stems.add(brand);
  }

  const forMatch = input.prompt.match(
    /\bfor\s+([a-z0-9][a-z0-9-]{1,38}[a-z0-9])\b/i,
  );
  if (forMatch?.[1]) {
    const stem = sanitizeStem(forMatch[1]);
    if (stem.length >= 3 && !looksLikeSentenceStem(stem)) stems.add(stem);
  }

  for (const match of input.prompt.matchAll(/["']([a-z0-9][a-z0-9-]{1,38}[a-z0-9])["']/gi)) {
    const stem = sanitizeStem(match[1]);
    if (stem.length >= 3 && !looksLikeSentenceStem(stem)) stems.add(stem);
  }

  const tokens = input.prompt.toLowerCase().match(/\b[a-z][a-z0-9-]{2,24}\b/g) ?? [];
  for (const token of [...tokens].reverse()) {
    if (TLD_STOP_WORDS.has(token) || ALLOWED_TLDS.has(token)) continue;
    const stem = sanitizeStem(token);
    if (stem.length >= 3 && !looksLikeSentenceStem(stem)) {
      stems.add(stem);
      break;
    }
  }

  for (const fqdn of input.excludeFqdns ?? []) {
    const stem = sanitizeStem(fqdn.split(".")[0] ?? "");
    if (stem.length >= 3 && !looksLikeSentenceStem(stem)) stems.add(stem);
  }

  return [...stems].slice(0, 4);
}

export function mergePreferredTlds(
  llmTlds: string[],
  prompt: string,
  fallback: string[],
): string[] {
  const merged = [...llmTlds, ...extractTldsFromPrompt(prompt), ...fallback];
  const cleaned = merged
    .map((tld) => tld.toLowerCase().replace(/^\.+/, "").trim())
    .filter((tld) => ALLOWED_TLDS.has(tld));

  return cleaned.length > 0 ? [...new Set(cleaned)] : fallback;
}
