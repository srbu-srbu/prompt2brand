import type { BrandAssets, BrandKit } from "@/lib/types";
import { FAVICON_SIZE_PX, LOGO_SIZE_PX } from "../../shared/brandAssetPaths";

type LogoCardProps = {
  brandKit: BrandKit;
  brandAssets?: BrandAssets;
  hasWebsite?: boolean;
  updating?: boolean;
};

function assetUrl(base64: string): string {
  return `data:image/png;base64,${base64}`;
}

export function LogoCard({ brandKit, brandAssets, hasWebsite = true, updating }: LogoCardProps) {
  const logoSrc = brandAssets ? assetUrl(brandAssets.logoPngBase64) : null;
  const faviconSrc = brandAssets ? assetUrl(brandAssets.faviconPngBase64) : null;

  return (
    <div className="border-glow-surface rounded-2xl border bg-white/95 p-4 shadow-lg shadow-sky-100/40 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Select your logo</p>
          <p className="text-xs text-zinc-500">
            Prompt to regenerate — saved as <span className="font-mono">logo.png</span> and{" "}
            <span className="font-mono">favicon.png</span>.
          </p>
        </div>
        {updating ? (
          <p className="text-xs font-medium text-sky-700" role="status">
            Generating…
          </p>
        ) : null}
      </div>

      {!hasWebsite ? (
        <p className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          Create your website on the first tab first (one prompt). If the preview stays empty, start the API with{" "}
          <span className="font-mono">vercel dev</span> — <span className="font-mono">npm run dev</span> alone cannot
          reach <span className="font-mono">/api/generate</span>.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            logo.png · {LOGO_SIZE_PX}×{LOGO_SIZE_PX}
          </p>
          <div
            className="flex h-[100px] w-[100px] items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50"
            style={{ boxShadow: `0 0 0 1px ${brandKit.primaryColor}22` }}
          >
            {logoSrc ? (
              <img src={logoSrc} alt="" className="h-full w-full object-cover" width={LOGO_SIZE_PX} height={LOGO_SIZE_PX} />
            ) : (
              <span className="text-xs text-zinc-400">No logo yet</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            favicon.png · {FAVICON_SIZE_PX}×{FAVICON_SIZE_PX}
          </p>
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
            {faviconSrc ? (
              <img
                src={faviconSrc}
                alt=""
                className="h-full w-full object-cover"
                width={FAVICON_SIZE_PX}
                height={FAVICON_SIZE_PX}
              />
            ) : (
              <span className="text-[10px] text-zinc-400">—</span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        Same artwork at both sizes. Your site preview uses these files wherever the layout references{" "}
        <span className="font-mono text-zinc-600">/logo.png</span>.
      </p>
    </div>
  );
}
