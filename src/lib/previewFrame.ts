/**
 * Preview-only iframe helpers. Stored draft HTML and published pages are never
 * modified here — we only wrap fragments for the in-app sandboxed iframe.
 */

export const PREVIEW_SLUG_STORAGE_KEY = "prompt2brand:previewSlug";

const P2B_PREFIX = "#p2b:";

export type PreviewPageMeta = {
  slug: string;
  title: string;
};

function escapeSrcDocHtml(html: string): string {
  return html.replace(/<\/script/gi, "<\\/script");
}

function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSlugIndex(pages: PreviewPageMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const page of pages) {
    map.set(page.slug.toLowerCase(), page.slug);
    map.set(slugifyLabel(page.title), page.slug);
    map.set(page.title.toLowerCase().trim(), page.slug);
  }
  return map;
}

function normalizeLinkTarget(raw: string): string {
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

function canonicalSlug(raw: string, slugIndex: Map<string, string>, slugs: string[]): string | null {
  const normalized = normalizeLinkTarget(raw);
  if (!normalized || normalized === "index" || normalized === "home") {
    return slugs.includes("home") ? "home" : null;
  }
  return slugIndex.get(normalized) ?? null;
}

/** Preview-only HTML adjustments. The returned string is never saved to draft or publish. */
export function preparePreviewHtml(bodyHtml: string, pages: PreviewPageMeta[]): string {
  const slugs = pages.map((page) => page.slug);
  const slugIndex = buildSlugIndex(pages);

  const rewriteHref = (href: string): string | null => {
    const slug = canonicalSlug(href, slugIndex, slugs);
    return slug ? `${P2B_PREFIX}${slug}` : null;
  };

  let html = bodyHtml;

  html = html.replace(/\shref=(["'])([^"']+)\1/gi, (match, quote: string, href: string) => {
    const trimmed = href.trim();
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(trimmed)) return match;

    const previewHref = rewriteHref(trimmed);
    if (!previewHref) return match;

    return ` href=${quote}${previewHref}${quote} data-p2b-slug=${quote}${previewHref.slice(P2B_PREFIX.length)}${quote}`;
  });

  html = html.replace(/\shref=([^\s>]+)/gi, (match, href: string) => {
    const trimmed = href.trim();
    if (/^(https?:|mailto:|tel:|javascript:|#p2b:|["'])/i.test(trimmed)) return match;

    const previewHref = rewriteHref(trimmed);
    if (!previewHref) return match;

    return ` href="${previewHref}" data-p2b-slug="${previewHref.slice(P2B_PREFIX.length)}"`;
  });

  return html;
}

export function slugFromPreviewHref(href: string, pages: PreviewPageMeta[]): string | null {
  const slugs = pages.map((page) => page.slug);
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#" || trimmed === "/") {
    return slugs.includes("home") ? "home" : null;
  }
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(trimmed)) return null;

  return canonicalSlug(trimmed, buildSlugIndex(pages), slugs);
}

export function readStoredPreviewSlug(pages: PreviewPageMeta[], fallback = "home"): string {
  try {
    const stored = sessionStorage.getItem(PREVIEW_SLUG_STORAGE_KEY);
    if (stored && pages.some((page) => page.slug === stored)) return stored;
  } catch {
    // sessionStorage may be unavailable
  }

  if (pages.some((page) => page.slug === fallback)) return fallback;
  return pages[0]?.slug ?? "home";
}

export function writeStoredPreviewSlug(slug: string) {
  try {
    sessionStorage.setItem(PREVIEW_SLUG_STORAGE_KEY, slug);
  } catch {
    // sessionStorage may be unavailable
  }
}

export function buildPreviewSrcDoc(bodyHtml: string, pages: PreviewPageMeta[]): string {
  const previewBody = escapeSrcDocHtml(preparePreviewHtml(bodyHtml, pages));
  const pagesJson = JSON.stringify(pages);
  const prefixJson = JSON.stringify(P2B_PREFIX);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; min-height: 100%; }
  </style>
  <script>
(function () {
  var pages = ${pagesJson};
  var P2B_PREFIX = ${prefixJson};
  var slugs = pages.map(function (page) { return page.slug; });
  var slugSet = {};
  var slugIndex = {};

  for (var i = 0; i < pages.length; i++) {
    var page = pages[i];
    slugSet[page.slug] = true;
    slugIndex[page.slug.toLowerCase()] = page.slug;
    slugIndex[page.title.toLowerCase().trim()] = page.slug;
    slugIndex[page.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")] = page.slug;
  }

  function normalizeTarget(raw) {
    var path = (raw || "").trim();
    if (path.indexOf(P2B_PREFIX) === 0) path = path.slice(P2B_PREFIX.length);
    if (path.charAt(0) === "#") path = path.slice(1);
    path = path.split("?")[0].split("#")[0];
    path = path.replace(/^(\\.\\/)+/, "").replace(/\\\\/g, "/");
    path = path.replace(/^\\/+/, "").replace(/\\/+$/, "");
    var segments = path.split("/").filter(Boolean);
    path = (segments[segments.length - 1] || path).replace(/\\.html$/i, "");
    return path.toLowerCase();
  }

  function resolveSlug(href, label) {
    var tagged = (href || "").trim();
    if (tagged.indexOf(P2B_PREFIX) === 0) {
      var slug = tagged.slice(P2B_PREFIX.length);
      return slugSet[slug] ? slug : null;
    }

    if (!tagged || tagged === "#" || tagged === "/") return slugSet.home ? "home" : null;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(tagged)) return null;

    var normalized = normalizeTarget(tagged);
    if (!normalized || normalized === "index" || normalized === "home") {
      return slugSet.home ? "home" : null;
    }
    if (slugIndex[normalized]) return slugIndex[normalized];

    var fromLabel = (label || "").trim().toLowerCase();
    if (fromLabel && slugIndex[fromLabel]) return slugIndex[fromLabel];
    var slugified = fromLabel.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (slugified && slugIndex[slugified]) return slugIndex[slugified];

    return null;
  }

  function navigate(slug) {
    try {
      parent.postMessage({ type: "p2b-preview-nav", slug: slug }, "*");
    } catch (err) {
      // Ignore postMessage failures in restrictive embed contexts.
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var link = target.closest("a[href], [data-p2b-slug]");
    if (!link) return;

    var dataSlug = link.getAttribute("data-p2b-slug");
    if (dataSlug && slugSet[dataSlug]) {
      event.preventDefault();
      navigate(dataSlug);
      return;
    }

    var href = link.getAttribute("href") || "";
    var slug = resolveSlug(href, link.textContent || "");
    if (slug) {
      event.preventDefault();
      navigate(slug);
      return;
    }

    var trimmed = href.trim();
    if (trimmed && !/^(https?:|mailto:|tel:|javascript:|#)/i.test(trimmed)) {
      event.preventDefault();
    }
  }, true);
})();
  </script>
</head>
<body>${previewBody}</body>
</html>`;
}
