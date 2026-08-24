import type { BrandKit, DomainSuggestion, PageDraft } from "./types";
import { extractBrandName } from "../../shared/brandPrompt";

export const MOCK_BRAND: BrandKit = {
  name: "PawFuel",
  tagline: "Clean energy for active dogs",
  primaryColor: "#2563eb",
  accentColor: "#f59e0b",
  fontFamily: "system-ui, sans-serif",
};

export const MOCK_PAGES: PageDraft[] = [
  {
    slug: "home",
    title: "Home",
    bodyHtml: `
      <header>
        <h1>PawFuel</h1>
        <p>Clean energy for active dogs</p>
      </header>
      <main>
        <section>
          <h2>Fuel their adventure</h2>
          <p>Human-grade ingredients. Vet-approved formulas. Delivered monthly.</p>
          <a href="#" role="button">Shop starter kit</a>
        </section>
      </main>
    `,
  },
  {
    slug: "about",
    title: "About",
    bodyHtml: `
      <main>
        <h1>About PawFuel</h1>
        <p>We make nutrition simple for dogs who never slow down.</p>
      </main>
    `,
  },
];

export const MOCK_DOMAINS: DomainSuggestion[] = [
  { fqdn: "pawfuel.com", priceLabel: "Available" },
  { fqdn: "pawfuel.co", priceLabel: "Available" },
  { fqdn: "getpawfuel.com", priceLabel: "Available" },
  { fqdn: "pawfuel.dog", priceLabel: "Available" },
  { fqdn: "pawfuelhub.com", priceLabel: "Available" },
];

export function detectIntent(prompt: string): "site" | "domain" {
  const lower = prompt.toLowerCase();
  const domainHints = [
    "domain",
    "name",
    ".com",
    "shorter",
    "playful",
    "prefix",
    "suffix",
    "available",
    "url",
  ];
  return domainHints.some((hint) => lower.includes(hint)) ? "domain" : "site";
}

export function buildSummary(intent: "site" | "domain", prompt: string): [string, string] {
  if (intent === "domain") {
    return ["Searching domains from your cues.", `Keywords: ${prompt.slice(0, 60)}`];
  }
  return ["Updated site from your prompt.", `Latest cue: ${prompt.slice(0, 60)}`];
}

function taglineForBrand(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("electric")) return "Licensed electrical services you can trust.";
  if (lower.includes("vet") || lower.includes("pet")) return "Care for the pets who matter most.";
  return `Professional services from ${name}.`;
}

export function mockSiteFromPrompt(prompt: string): { brandKit: BrandKit; pages: PageDraft[] } {
  const name = extractBrandName(prompt) ?? MOCK_BRAND.name;
  const tagline = name === MOCK_BRAND.name ? MOCK_BRAND.tagline : taglineForBrand(name);

  return {
    brandKit: { ...MOCK_BRAND, name, tagline },
    pages: MOCK_PAGES.map((page, index) =>
      index === 0
        ? {
            ...page,
            bodyHtml: page.bodyHtml.replace(/PawFuel/g, name).replace(MOCK_BRAND.tagline, tagline),
          }
        : {
            ...page,
            bodyHtml: page.bodyHtml.replace(/PawFuel/g, name),
          },
    ),
  };
}
