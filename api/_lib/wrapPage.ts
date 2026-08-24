import type { BrandKit } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function wrapPage(title: string, bodyHtml: string, brandKit: BrandKit): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --brand-primary: ${brandKit.primaryColor};
      --brand-accent: ${brandKit.accentColor};
    }
    body {
      font-family: ${brandKit.fontFamily};
      margin: 0;
      line-height: 1.5;
      color: #18181b;
    }
    a[role="button"], button, .btn {
      background: var(--brand-primary);
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      padding: 0.5rem 1rem;
      text-decoration: none;
      display: inline-block;
    }
    h1 { color: var(--brand-primary); }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
