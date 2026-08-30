/** Patterns for "create a website for JoeTheElectrician", etc. */
const BRAND_NAME_PATTERNS: RegExp[] = [
  /(?:create|build|make|start|design)\s+(?:a\s+)?(?:website|site|brand|business)\s+for\s+([A-Za-z0-9][A-Za-z0-9\s'-]{0,40})/i,
  /(?:website|site|brand|business)\s+for\s+([A-Za-z0-9][A-Za-z0-9\s'-]{0,40})/i,
  /(?:called|named)\s+([A-Za-z0-9][A-Za-z0-9\s'-]{0,40})/i,
  /\bfor\s+([A-Z][A-Za-z0-9]+(?:[A-Z][a-z0-9]+)*)\b/,
];

const REPLACE_BRAND_RE =
  /\b(create|build|make|start|design|rebrand|switch\s+to)\b[\s\S]{0,40}\b(website|site|brand|business)\b/i;

export function extractBrandName(prompt: string): string | null {
  for (const pattern of BRAND_NAME_PATTERNS) {
    const match = prompt.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim().replace(/[.!?,;:]+$/, "");
      if (name.length >= 2) return name;
    }
  }
  return null;
}

export function shouldReplaceBrand(prompt: string): boolean {
  if (/\b(rebrand|start over|from scratch|new brand|switch to a new)\b/i.test(prompt)) return true;
  return REPLACE_BRAND_RE.test(prompt);
}
