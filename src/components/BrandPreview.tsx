import type { BrandKit, PageDraft } from "@/lib/types";

type BrandPreviewProps = {
  brandKit: BrandKit;
  pages: PageDraft[];
  activeSlug?: string;
};

function previewDocument(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; min-height: 100%; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

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
      <iframe
        title="Brand preview"
        className="min-h-0 w-full flex-1 border-0 bg-white"
        sandbox=""
        srcDoc={previewDocument(page.bodyHtml)}
      />
    </div>
  );
}
