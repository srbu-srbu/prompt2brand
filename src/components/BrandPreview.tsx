import type { CSSProperties } from "react";
import type { BrandKit, PageDraft } from "@/lib/types";

type BrandPreviewProps = {
  brandKit: BrandKit;
  pages: PageDraft[];
  activeSlug?: string;
};

export function BrandPreview({ brandKit, pages, activeSlug = "home" }: BrandPreviewProps) {
  const page = pages.find((p) => p.slug === activeSlug) ?? pages[0];

  if (!page) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500">
        Your brand preview will appear here
      </div>
    );
  }

  return (
    <div
      className="h-full min-h-[420px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
      style={
        {
          "--brand-primary": brandKit.primaryColor,
          "--brand-accent": brandKit.accentColor,
          fontFamily: brandKit.fontFamily,
        } as CSSProperties
      }
    >
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs text-zinc-500">
        Preview / {page.title}
      </div>
      <div
        className="preview-content p-6 [&_a]:inline-block [&_a]:rounded-md [&_a]:bg-[var(--brand-primary)] [&_a]:px-4 [&_a]:py-2 [&_a]:text-white [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-[var(--brand-primary)] [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_header]:mb-6 [&_p]:mt-2 [&_p]:text-zinc-600"
        dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
      />
    </div>
  );
}
