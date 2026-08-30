import { extractBrandName } from "./brandPrompt";

export function brandNameFromPrompt(prompt: string): string {
  const extracted = extractBrandName(prompt);
  if (extracted) return extracted;

  const words = prompt
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ")
    .trim();

  return words.length >= 2 ? words.slice(0, 48) : "New Brand";
}

export function taglineForBrand(name: string, prompt?: string): string {
  const lower = `${name} ${prompt ?? ""}`.toLowerCase();
  if (lower.includes("electric")) return "Licensed electrical services you can trust.";
  if (lower.includes("vet") || lower.includes("pet") || lower.includes("dog"))
    return "Care for the pets who matter most.";
  if (lower.includes("coffee") || lower.includes("cafe")) return "Craft coffee, crafted with care.";
  if (lower.includes("law") || lower.includes("legal")) return "Trusted counsel when it matters.";
  return `${name} — built for customers who expect more.`;
}

export function detectDomainIntent(prompt: string): "site" | "domain" {
  const lower = prompt.toLowerCase();
  if (/\b(domain|dns|fqdn|subdomain|tld)\b/.test(lower)) return "domain";
  if (/\.(com|io|co|net|org|app|dev|ai)\b/.test(lower)) return "domain";
  if (/\b(domain name|domain names|suggest domains|domain suggestions|available domains|pick a domain|buy a domain)\b/.test(lower))
    return "domain";
  if (/\b(shorter|playful|catchy)\b/.test(lower) && /\b(domain|url)\b/.test(lower)) return "domain";
  return "site";
}

export function buildMockHomePageHtml(name: string, tagline: string, primary = "#2563eb", accent = "#f59e0b"): string {
  return `<style>
  .p2b-page { font-family: system-ui, sans-serif; color: #18181b; line-height: 1.55; }
  .p2b-hero { padding: 2.5rem 1.75rem; border-radius: 16px; background: linear-gradient(135deg, ${primary}, ${accent}); color: #fff; }
  .p2b-hero h1 { margin: 0 0 0.5rem; font-size: 2rem; letter-spacing: -0.02em; }
  .p2b-hero p { margin: 0; opacity: 0.95; font-size: 1.05rem; }
  .p2b-main { padding: 1.75rem 0.25rem; }
  .p2b-card { border: 1px solid #e4e4e7; border-radius: 12px; padding: 1.25rem 1.5rem; background: #fafafa; }
  .p2b-card h2 { margin: 0 0 0.5rem; font-size: 1.25rem; color: ${primary}; }
  .p2b-card p { margin: 0 0 1rem; color: #52525b; }
  .p2b-btn { display: inline-block; padding: 0.65rem 1.1rem; border-radius: 8px; background: ${primary}; color: #fff; text-decoration: none; font-weight: 600; }
</style>
<div class="p2b-page">
  <header class="p2b-hero">
    <h1>${name}</h1>
    <p>${tagline}</p>
  </header>
  <main class="p2b-main">
    <section class="p2b-card">
      <h2>Welcome</h2>
      <p>${tagline}</p>
      <a class="p2b-btn" href="#">Get started</a>
    </section>
  </main>
</div>`;
}
