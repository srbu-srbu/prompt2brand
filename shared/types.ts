export interface BrandKit {
  name: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
}

export interface PageDraft {
  slug: string;
  title: string;
  bodyHtml: string;
}

export interface Draft {
  prompt: string;
  brandKit: BrandKit;
  pages: PageDraft[];
  summary: [string, string];
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
