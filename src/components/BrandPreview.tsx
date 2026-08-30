import type { BrandKit, PageDraft } from "@/lib/types";

type BrandPreviewProps = {
  brandKit: BrandKit;
  pages: PageDraft[];
  activeSlug?: string;
};

export function BrandPreview({ pages, activeSlug = "home" }: BrandPreviewProps) {
  const page = pages.find((p) => p.slug === activeSlug) ?? pages[0];

  if (!page) {
    return (
      <div className="relative z-0 flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500">
        Your brand preview will appear here
      </div>
    );
  }

  return (
    <div className="relative z-0 flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div
        className="preview-content min-h-0 flex-1 overflow-auto bg-white"
        dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
      />
    </div>
  );
}
