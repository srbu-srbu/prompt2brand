export const P2B_PREFIX = "#p2b:";

export type PageLinkMeta = {
  slug: string;
  title: string;
};

function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildSlugIndex(pages: PageLinkMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const page of pages) {
    map.set(page.slug.toLowerCase(), page.slug);
    map.set(slugifyLabel(page.title), page.slug);
    map.set(page.title.toLowerCase().trim(), page.slug);
  }
  return map;
}

export function normalizeLinkTarget(raw: string): string {
  let path = raw.trim();
  if (path.startsWith(P2B_PREFIX)) path = path.slice(P2B_PREFIX.length);
  if (path.startsWith("#")) path = path.slice(1);
  path = path.split("?")[0]?.split("#")[0] ?? path;
  path = path.replace(/^(\.\/)+/, "").replace(/\\/g, "/");
  path = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  path = (segments[segments.length - 1] ?? path).replace(/\.html$/i, "");
  return path.toLowerCase();
}

export function resolvePageSlug(href: string, pages: PageLinkMeta[]): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") return null;
  if (/^(mailto:|tel:|javascript:)/i.test(trimmed)) return null;

  let candidate = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.hash) {
        candidate = url.hash;
      } else if (url.pathname && url.pathname !== "/") {
        candidate = url.pathname;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  const slugs = pages.map((page) => page.slug);
  const slugIndex = buildSlugIndex(pages);
  const normalized = normalizeLinkTarget(candidate);
  if (!normalized || normalized === "index" || normalized === "home") {
    return slugs.includes("home") ? "home" : null;
  }
  return slugIndex.get(normalized) ?? null;
}

export function publishedHrefForSlug(slug: string): string {
  return slug === "home" ? "/" : `/${slug}`;
}

export function fallbackHrefForSlug(siteId: string, slug: string): string {
  return `/api/sites/${siteId}/${slug}`;
}

export function rewriteInternalHrefs(
  bodyHtml: string,
  pages: PageLinkMeta[],
  toHref: (slug: string) => string,
  options?: { includeDataSlug?: boolean },
): string {
  const rewriteHref = (href: string): { href: string; slug: string } | null => {
    const slug = resolvePageSlug(href, pages);
    return slug ? { href: toHref(slug), slug } : null;
  };

  let html = bodyHtml;

  html = html.replace(/\shref=(["'])([^"']+)\1/gi, (match, quote: string, href: string) => {
    const trimmed = href.trim();
    if (/^(mailto:|tel:|javascript:)/i.test(trimmed)) return match;

    const rewritten = rewriteHref(trimmed);
    if (!rewritten) return match;

    const dataAttr = options?.includeDataSlug
      ? ` data-p2b-slug=${quote}${rewritten.slug}${quote}`
      : "";
    return ` href=${quote}${rewritten.href}${quote}${dataAttr}`;
  });

  html = html.replace(/\shref=([^\s>]+)/gi, (match, href: string) => {
    const trimmed = href.trim();
    if (/^(mailto:|tel:|javascript:|["'])/i.test(trimmed)) return match;

    const rewritten = rewriteHref(trimmed);
    if (!rewritten) return match;

    const dataAttr = options?.includeDataSlug ? ` data-p2b-slug="${rewritten.slug}"` : "";
    return ` href="${rewritten.href}"${dataAttr}`;
  });

  return html;
}

export function preparePublishedHtml(bodyHtml: string, pages: PageLinkMeta[]): string {
  const cleaned = bodyHtml.replace(/\sdata-p2b-slug=(["'])[^"']*\1/gi, "");
  return rewriteInternalHrefs(cleaned, pages, publishedHrefForSlug);
}

/** Rewrite published root paths for Postgres fallback serving under /api/sites/{siteId}/… */
export function prepareFallbackHtml(
  html: string,
  pages: PageLinkMeta[],
  siteId: string,
): string {
  return rewriteInternalHrefs(html, pages, (slug) => fallbackHrefForSlug(siteId, slug));
}

export function preparePreviewHtml(bodyHtml: string, pages: PageLinkMeta[]): string {
  return rewriteInternalHrefs(bodyHtml, pages, (slug) => `${P2B_PREFIX}${slug}`, {
    includeDataSlug: true,
  });
}
