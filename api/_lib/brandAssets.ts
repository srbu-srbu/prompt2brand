import sharp from "sharp";
import type { BrandAssets, BrandKit } from "../../shared/types";
import { FAVICON_SIZE_PX, LOGO_SIZE_PX } from "../../shared/brandAssetPaths";
import { generateBrandLogoImage } from "./metaImageApi";

function escapeSvgText(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return char;
    }
  });
}

export async function packLogoAndFavicon(masterPng: Buffer, revision: number): Promise<BrandAssets> {
  const logoPng = await sharp(masterPng).resize(LOGO_SIZE_PX, LOGO_SIZE_PX, { fit: "cover" }).png().toBuffer();
  const faviconPng = await sharp(logoPng).resize(FAVICON_SIZE_PX, FAVICON_SIZE_PX, { fit: "cover" }).png().toBuffer();

  return {
    logoPngBase64: logoPng.toString("base64"),
    faviconPngBase64: faviconPng.toString("base64"),
    revision,
  };
}

export async function createPlaceholderBrandAssets(brandKit: BrandKit, revision = 1): Promise<BrandAssets> {
  const initial = escapeSvgText(brandKit.name.trim().slice(0, 1).toUpperCase() || "B");
  const primary = brandKit.primaryColor.match(/^#[0-9a-fA-F]{6}$/) ? brandKit.primaryColor : "#2563eb";
  const accent = brandKit.accentColor.match(/^#[0-9a-fA-F]{6}$/) ? brandKit.accentColor : "#f59e0b";

  const svg = `<svg width="${LOGO_SIZE_PX}" height="${LOGO_SIZE_PX}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect width="${LOGO_SIZE_PX}" height="${LOGO_SIZE_PX}" rx="28" fill="url(#g)"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="96" font-family="Arial,Helvetica,sans-serif" font-weight="700" fill="#ffffff">${initial}</text>
</svg>`;

  const master = await sharp(Buffer.from(svg)).png().toBuffer();
  return packLogoAndFavicon(master, revision);
}

export async function generateBrandAssetsFromPrompt(input: {
  prompt: string;
  brandKit: BrandKit;
  previousRevision?: number;
}): Promise<BrandAssets> {
  const masterPng = await generateBrandLogoImage(input.prompt, input.brandKit);
  const revision = (input.previousRevision ?? 0) + 1;
  return packLogoAndFavicon(masterPng, revision);
}

export function decodeBrandAssetFiles(assets: BrandAssets): { logoPng: Buffer; faviconPng: Buffer } {
  return {
    logoPng: Buffer.from(assets.logoPngBase64, "base64"),
    faviconPng: Buffer.from(assets.faviconPngBase64, "base64"),
  };
}
