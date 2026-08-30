export function detectDomainIntent(prompt: string): "site" | "domain" {
  const lower = prompt.toLowerCase();
  if (/\b(domain|dns|fqdn|subdomain|tld)\b/.test(lower)) return "domain";
  if (/\.(com|io|co|net|org|app|dev|ai)\b/.test(lower)) return "domain";
  if (
    /\b(domain name|domain names|suggest domains|domain suggestions|available domains|pick a domain|buy a domain)\b/.test(
      lower,
    )
  )
    return "domain";
  if (/\b(shorter|playful|catchy)\b/.test(lower) && /\b(domain|url)\b/.test(lower)) return "domain";
  return "site";
}
