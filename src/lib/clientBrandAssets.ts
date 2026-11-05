import { FAVICON_SIZE_PX, LOGO_SIZE_PX, LOGO_SRC } from "../../shared/brandAssetPaths";
import type { BrandAssets, BrandKit } from "./types";

function parseHex(color: string, fallback: string): string {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

/** Browser-only placeholder when the API (sharp) is unavailable — matches server placeholder style. */
export function createClientPlaceholderBrandAssets(brandKit: BrandKit, revision = 1): BrandAssets {
  const size = LOGO_SIZE_PX;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { logoPngBase64: "", faviconPngBase64: "", revision };
  }

  const primary = parseHex(brandKit.primaryColor, "#2563eb");
  const accent = parseHex(brandKit.accentColor, "#f59e0b");
  const initial = (brandKit.name.trim().slice(0, 1) || "B").toUpperCase();

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, primary);
  gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, size, size, 28);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 96px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initial, size / 2, size * 0.54);

  const logoPngBase64 = canvas.toDataURL("image/png").split(",")[1] ?? "";

  const faviconCanvas = document.createElement("canvas");
  faviconCanvas.width = FAVICON_SIZE_PX;
  faviconCanvas.height = FAVICON_SIZE_PX;
  const fctx = faviconCanvas.getContext("2d");
  if (fctx) {
    fctx.drawImage(canvas, 0, 0, FAVICON_SIZE_PX, FAVICON_SIZE_PX);
  }
  const faviconPngBase64 = faviconCanvas.toDataURL("image/png").split(",")[1] ?? "";

  return { logoPngBase64, faviconPngBase64, revision };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildClientMockHomePage(brandKit: BrandKit): string {
  const name = escapeHtml(brandKit.name);
  const tagline = escapeHtml(brandKit.tagline);
  return `<style>
.p2b { font-family: ${brandKit.fontFamily}; color: #18181b; margin: 0; }
.p2b header { display: flex; align-items: center; gap: 1rem; padding: 1.25rem 2rem; border-bottom: 1px solid #e4e4e7; }
.p2b main { padding: 2rem; max-width: 48rem; }
.p2b h1 { color: ${brandKit.primaryColor}; margin: 0 0 0.5rem; }
.p2b p { line-height: 1.6; color: #52525b; }
</style>
<header class="p2b">
  <img src="${LOGO_SRC}" alt="${name} logo" width="200" height="200" style="height:40px;width:auto" />
  <strong>${name}</strong>
</header>
<main class="p2b">
  <h1>${name}</h1>
  <p>${tagline}</p>
  <p><em>Offline preview — run <code>vercel dev</code> for full AI site generation.</em></p>
</main>`;
}

export function brandKitFromPrompt(prompt: string, existing?: BrandKit): BrandKit {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  const name =
    existing?.name?.trim() ||
    (words.slice(0, 3).join(" ") || "My Brand").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80);
  const tagline =
    existing?.tagline?.trim() ||
    (words.length > 3 ? words.slice(3).join(" ").slice(0, 200) : "Your brand, one prompt away.");

  return {
    name,
    tagline,
    primaryColor: existing?.primaryColor ?? "#2563eb",
    accentColor: existing?.accentColor ?? "#f59e0b",
    fontFamily: existing?.fontFamily ?? "system-ui, sans-serif",
  };
}
