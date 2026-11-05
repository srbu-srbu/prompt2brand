import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  buildPreviewSrcDoc,
  readStoredPreviewSlug,
  writeStoredPreviewSlug,
  type PreviewPageMeta,
} from "@/lib/previewFrame";
import type { BrandAssets, BrandKit, PageDraft } from "@/lib/types";

type BrandPreviewProps = {
  brandKit: BrandKit;
  brandAssets?: BrandAssets;
  pages: PageDraft[];
  activeSlug?: string;
  /** True while waiting on site-generation LLM (Create / Edit website). */
  generating?: boolean;
};

function PreviewGeneratingContent() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="preview-gen-blocks" aria-hidden>
        <span className="preview-gen-block" />
        <span className="preview-gen-block" />
        <span className="preview-gen-block" />
        <span className="preview-gen-block" />
        <span className="preview-gen-block" />
      </div>
      <Loader2 className="h-9 w-9 animate-spin text-zinc-500" aria-hidden />
      <p className="text-center text-base font-medium text-zinc-600 sm:text-lg">
        Building your website…
      </p>
    </div>
  );
}

function PreviewGeneratingOverlay() {
  return (
    <div
      className="preview-gen-overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-2xl bg-white/80 px-6 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label="Generating your website"
    >
      <PreviewGeneratingContent />
    </div>
  );
}

export function BrandPreview({
  brandAssets,
  pages,
  activeSlug: initialSlug = "home",
  generating = false,
}: BrandPreviewProps) {
  const pageMeta = useMemo<PreviewPageMeta[]>(
    () => pages.map((page) => ({ slug: page.slug, title: page.title })),
    [pages],
  );
  const [activeSlug, setActiveSlug] = useState(() => readStoredPreviewSlug(pageMeta, initialSlug));

  useEffect(() => {
    if (!pages.some((page) => page.slug === activeSlug)) {
      const nextSlug = readStoredPreviewSlug(pageMeta, pages[0]?.slug ?? "home");
      setActiveSlug(nextSlug);
    }
  }, [pages, pageMeta, activeSlug]);

  useEffect(() => {
    writeStoredPreviewSlug(activeSlug);
  }, [activeSlug]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "p2b-preview-nav") return;
      const slug = event.data.slug;
      if (typeof slug === "string" && pages.some((page) => page.slug === slug)) {
        writeStoredPreviewSlug(slug);
        setActiveSlug(slug);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pages]);

  const page = pages.find((p) => p.slug === activeSlug) ?? pages[0];

  if (!page) {
    return (
      <div
        className="border-glow-surface-dashed relative z-0 flex h-full w-full min-w-0 rounded-2xl border border-dashed bg-zinc-50/90"
        {...(generating
          ? { role: "status" as const, "aria-live": "polite" as const, "aria-label": "Generating your website" }
          : {})}
      >
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12">
          {generating ? <PreviewGeneratingContent /> : null}
          <p
            className={`w-full max-w-none text-center text-xl font-medium leading-snug sm:text-2xl md:text-3xl ${
              generating ? "mt-8 text-zinc-300 sm:mt-10" : "text-zinc-400"
            }`}
          >
            Your brand preview will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-glow-surface-soft relative z-0 flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm shadow-sky-100/40">
      <iframe
        key={`${activeSlug}-${brandAssets?.revision ?? 0}`}
        title="Brand preview"
        className="min-h-0 w-full flex-1 border-0 bg-white"
        sandbox="allow-scripts"
        srcDoc={buildPreviewSrcDoc(page.bodyHtml, pageMeta, brandAssets)}
      />
      {generating ? <PreviewGeneratingOverlay /> : null}
    </div>
  );
}
