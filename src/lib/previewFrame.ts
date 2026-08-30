/**
 * Preview-only iframe helpers. Stored draft HTML and published pages are never
 * modified here — we only wrap fragments for the in-app sandboxed iframe.
 */

const P2B_PREFIX = "#p2b:";

function slugLookup(slugs: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const slug of slugs) {
    map.set(slug.toLowerCase(), slug);
  }
  return map;
}

function normalizeLinkTarget(raw: string): string {
  let path = raw.trim();
  if (path.startsWith(P2B_PREFIX)) path = path.slice(P2B_PREFIX.length);
  if (path.startsWith("#")) path = path.slice(1);
  path = path.split("?")[0]?.split("#")[0] ?? path;
  path = path.replace(/^\/+/, "").replace(/\/+$/, "");
  path = path.replace(/\.html$/i, "");
  return path.toLowerCase();
}

function canonicalSlug(raw: string, slugs: string[]): string | null {
  const normalized = normalizeLinkTarget(raw);
  if (!normalized || normalized === "index" || normalized === "home") {
    return slugs.includes("home") ? "home" : null;
  }
  return slugLookup(slugs).get(normalized) ?? null;
}

/** Preview-only HTML adjustments. The returned string is never saved to draft or publish. */
export function preparePreviewHtml(bodyHtml: string, slugs: string[]): string {
  const rewriteHref = (href: string): string | null => {
    const slug = canonicalSlug(href, slugs);
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

export function slugFromPreviewHref(href: string, slugs: string[]): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#" || trimmed === "/") {
    return slugs.includes("home") ? "home" : null;
  }
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(trimmed)) return null;

  return canonicalSlug(trimmed, slugs);
}

export function buildPreviewSrcDoc(bodyHtml: string, slugs: string[]): string {
  const previewBody = preparePreviewHtml(bodyHtml, slugs);
  const slugsJson = JSON.stringify(slugs);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; min-height: 100%; }
  </style>
</head>
<body>${previewBody}
<script>
(function () {
  var slugs = ${slugsJson};
  var slugSet = {};
  for (var i = 0; i < slugs.length; i++) slugSet[slugs[i]] = true;

  function resolveSlug(href) {
    var trimmed = (href || "").trim();
    if (!trimmed || trimmed === "#" || trimmed === "/") return slugSet.home ? "home" : null;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(trimmed)) return null;

    if (trimmed.indexOf("${P2B_PREFIX}") === 0) {
      var tagged = trimmed.slice(${P2B_PREFIX.length});
      return slugSet[tagged] ? tagged : null;
    }

    var path = trimmed;
    if (path.charAt(0) === "#") path = path.slice(1);
    path = path.split("?")[0].split("#")[0].replace(/^\\/+/, "").replace(/\\/+$/, "");
    if (!path || path === "index.html" || path === "home.html") return slugSet.home ? "home" : null;
    path = path.replace(/\\.html$/i, "").toLowerCase();

    for (var j = 0; j < slugs.length; j++) {
      if (slugs[j].toLowerCase() === path) return slugs[j];
    }
    return null;
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var link = target.closest("a[href]");
    if (!link) return;

    var href = link.getAttribute("href") || "";
    var slug = resolveSlug(href);
    if (slug) {
      event.preventDefault();
      parent.postMessage({ type: "p2b-preview-nav", slug: slug }, "*");
      return;
    }

    var trimmed = href.trim();
    if (trimmed && !/^(https?:|mailto:|tel:|javascript:|#)/i.test(trimmed)) {
      event.preventDefault();
    }
  });
})();
</script>
</body>
</html>`;
}
