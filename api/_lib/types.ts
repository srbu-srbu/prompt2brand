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

export interface DomainSuggestion {
  fqdn: string;
  priceLabel?: string;
}
