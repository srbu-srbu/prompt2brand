/**
 * Generates prompt2brand app shell logo (200×200) and favicon (32×32).
 * Run: node scripts/generate-app-brand.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");

const LOGO_SIZE = 200;
const FAVICON_SIZE = 32;

function appBrandSvg(size) {
  const rx = Math.round(size * 0.22);
  const mainSize = Math.round(size * 0.34);
  const subSize = Math.round(mainSize * 0.82);
  const y = Math.round(size * 0.52);
  const shadowDy = Math.max(1, Math.round(size * 0.025));
  const shadowBlur = Math.max(2, Math.round(size * 0.045));
  const strokeW = size >= 64 ? 1 : 0.5;

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="${shadowDy}" stdDeviation="${shadowBlur}" flood-color="#312e81" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)" filter="url(#soft)"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#sheen)"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="${strokeW}"/>
  <text x="50%" y="${y}" text-anchor="middle" dominant-baseline="middle"
    font-family="Roboto Mono, Fragment Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    font-weight="600" font-size="${mainSize}" fill="#ffffff" fill-opacity="0.94" letter-spacing="${size >= 100 ? "-1" : "0"}">
    <tspan>p</tspan><tspan baseline-shift="sub" font-size="${subSize}">2</tspan><tspan baseline-shift="baseline" font-size="${mainSize}">b</tspan>
  </text>
</svg>`;
}

async function main() {
  await mkdir(publicDir, { recursive: true });
  const masterSvg = appBrandSvg(LOGO_SIZE);
  await writeFile(path.join(publicDir, "app-brand.svg"), masterSvg, "utf8");

  const masterPng = await sharp(Buffer.from(masterSvg)).png().toBuffer();
  const logoPng = await sharp(masterPng).resize(LOGO_SIZE, LOGO_SIZE).png().toBuffer();
  const faviconPng = await sharp(logoPng).resize(FAVICON_SIZE, FAVICON_SIZE).png().toBuffer();

  await writeFile(path.join(publicDir, "logo.png"), logoPng);
  await writeFile(path.join(publicDir, "favicon.png"), faviconPng);

  console.log("Wrote public/logo.png, public/favicon.png, public/app-brand.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
