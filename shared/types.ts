export interface BrandKit {
  name: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
}

/** PNG bytes as base64 — logo.png (200×200) and favicon.png (32×32), same artwork. */
export interface BrandAssets {
  logoPngBase64: string;
  faviconPngBase64: string;
  revision: number;
}

export interface PageDraft {
  slug: string;
  title: string;
  bodyHtml: string;
}

export type SummaryLines = [string, string, string];

export interface Draft {
  prompt: string;
  promptHistory: string[];
  brandKit: BrandKit;
  brandAssets?: BrandAssets;
  pages: PageDraft[];
  summary: SummaryLines;
  status: "idle" | "generating" | "ready" | "publishing";
}

export interface DomainSuggestion {
  fqdn: string;
  priceLabel?: string;
}

export interface BrandConflict {
  platform: "web" | "instagram" | "linkedin" | "x" | "facebook";
  label: string;
  found: boolean;
  snippet?: string;
  /** SerpApi result URL — e.g. facebook.com/JoeTheElectrician when the slug matches. */
  url?: string;
}

export interface PublishedSite {
  siteId: string;
  hostedUrl: string;
  domainFqdn: string;
  hostingStatus: "pending" | "live" | "failed";
  domainStatus: "pending" | "live" | "failed";
}

export type AppPhase = "build" | "done";

export type PromptIntent = "site" | "domain";
