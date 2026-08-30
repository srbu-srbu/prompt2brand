import { useEffect, useMemo, useState } from "react";
import { buildPreviewSrcDoc } from "@/lib/previewFrame";
import type { BrandKit, PageDraft } from "@/lib/types";

type BrandPreviewProps = {
  brandKit: BrandKit;
  pages: PageDraft[];
  activeSlug?: string;
};

export function BrandPreview({ pages, activeSlug: initialSlug = "home" }: BrandPreviewProps) {
  const slugs = useMemo(() => pages.map((page) => page.slug), [pages]);
  const [activeSlug, setActiveSlug] = useState(initialSlug);

  useEffect(() => {
    if (!pages.some((page) => page.slug === activeSlug)) {
      setActiveSlug(pages[0]?.slug ?? "home");
    }
  }, [pages, activeSlug]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "p2b-preview-nav") return;
      const slug = event.data.slug;
      if (typeof slug === "string" && pages.some((page) => page.slug === slug)) {
        setActiveSlug(slug);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pages]);

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
      <iframe
        key={activeSlug}
        title="Brand preview"
        className="min-h-0 w-full flex-1 border-0 bg-white"
        sandbox="allow-scripts"
        srcDoc={buildPreviewSrcDoc(page.bodyHtml, slugs)}
      />
    </div>
  );
}
