import type { BrandKit } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function wrapPage(title: string, bodyHtml: string, brandKit: BrandKit, faviconHref?: string): string {
  const faviconTag =
    faviconHref?.trim() ?
      `<link rel="icon" type="image/png" href="${escapeHtml(faviconHref.trim())}">`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${faviconTag}
</head>
<body style="margin:0; font-family:${brandKit.fontFamily};">
${bodyHtml}
</body>
</html>`;
}
