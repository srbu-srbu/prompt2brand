import type { BrandAssets } from "./types";
import { FAVICON_SRC, LOGO_SRC } from "./brandAssetPaths";

function logoDataUrl(assets: BrandAssets): string {
  return `data:image/png;base64,${assets.logoPngBase64}`;
}

function faviconDataUrl(assets: BrandAssets): string {
  return `data:image/png;base64,${assets.faviconPngBase64}`;
}

/** Replace /logo.png and /favicon.png references for in-app preview and publish prep. */
export function injectBrandAssetUrls(html: string, assets: BrandAssets): string {
  const logo = logoDataUrl(assets);
  const favicon = faviconDataUrl(assets);

  return html
    .replaceAll(LOGO_SRC, logo)
    .replaceAll(FAVICON_SRC, favicon)
    .replace(/\bsrc=(["'])\/logo\.png\1/gi, `src=$1${logo}$1`)
    .replace(/\bhref=(["'])\/favicon\.png\1/gi, `href=$1${favicon}$1`);
}
