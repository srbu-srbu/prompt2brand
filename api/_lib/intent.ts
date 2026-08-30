/**
 * Detect when the user is explicitly asking for domain suggestions,
 * not when they are describing a business or website to build.
 */
export function detectDomainIntent(prompt: string): "site" | "domain" {
  const lower = prompt.toLowerCase().trim();
  if (!lower) return "site";

  const explicitDomainAsk = [
    /\b(suggest|find|search|show|list|give|need|want|pick|choose|buy|register|check)\b[^.?!\n]{0,40}\b(domains?|domain names?)\b/,
    /\b(domains?|domain names?)\b[^.?!\n]{0,40}\b(suggestions?|ideas|options|names?|search|list)\b/,
    /\b(domain suggestions?|available domains?|pick a domain|buy a domain|more domains?)\b/,
    /\b(shorter|playful|catchy|alternates?|other)\b[^.?!\n]{0,30}\b(domain|domains|url)\b/,
    /\b(domain|domains|url)\b[^.?!\n]{0,30}\b(shorter|playful|catchy|alternates?|other)\b/,
    /\b(is|are)\s+[\w-]+\.(com|io|co|net|org|app|dev|ai)\b[^.?!\n]{0,20}\b(available|free|taken)\b/,
  ];
  if (explicitDomainAsk.some((pattern) => pattern.test(lower))) return "domain";

  if (/\b(dns|fqdn|subdomain|tld)\b/.test(lower)) return "domain";

  if (/^[\w-]+\.(com|io|co|net|org|app|dev|ai)$/i.test(lower)) return "domain";

  return "site";
}
