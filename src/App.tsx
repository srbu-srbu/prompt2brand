import { useEffect, useState } from "react";
import { BrandPreview } from "@/components/BrandPreview";
import { DomainCard } from "@/components/DomainCard";
import { DoneScreen } from "@/components/DoneScreen";
import { PromptBar } from "@/components/PromptBar";
import { SummaryLines } from "@/components/SummaryLines";
import {
  safeDomainSuggest,
  safeGenerate,
  safePublish,
} from "@/lib/api";
import {
  detectClientIntent,
  hasSite,
  loadDraft,
  mergeDraft,
  saveDraft,
} from "@/lib/draft";
import type { AppPhase, DomainSuggestion, Draft, PublishedSite } from "@/lib/types";

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("build");
  const [draft, setDraft] = useState<Draft>(() => loadDraft());
  const [promptInput, setPromptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [domainCardOpen, setDomainCardOpen] = useState(false);
  const [domainCardCollapsed, setDomainCardCollapsed] = useState(false);
  const [domains, setDomains] = useState<DomainSuggestion[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [published, setPublished] = useState<(PublishedSite & { siteId: string }) | null>(null);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (hasSite(draft)) {
      setDomainCardOpen(true);
    }
  }, [draft.pages.length, draft.status]);

  async function handlePromptSubmit() {
    const prompt = promptInput.trim();
    if (!prompt || loading) return;

    setLoading(true);
    setPromptInput("");

    try {
      const intent = detectClientIntent(prompt);

      if (intent === "domain" && hasSite(draft)) {
        const result = await safeDomainSuggest(prompt);
        setDomains(result.domains);
        setDomainCardOpen(true);
        setDraft((current) =>
          mergeDraft(current, { summary: result.summary, status: "ready" }),
        );
      } else {
        const result = await safeGenerate(prompt, draft);
        if ("domains" in result) {
          setDomains(result.domains);
          setDraft((current) =>
            mergeDraft(current, { summary: result.summary, status: "ready" }),
          );
        } else {
          setDraft((current) =>
            mergeDraft(current, {
              prompt,
              brandKit: result.brandKit,
              pages: result.pages,
              summary: result.summary,
              status: "ready",
            }),
          );
          if (domains.length === 0) {
            const domainResult = await safeDomainSuggest(prompt);
            setDomains(domainResult.domains);
          }
          setDomainCardOpen(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!selectedDomain || !confirmed || launching) return;
    setLaunching(true);
    try {
      const result = await safePublish({
        draft: { pages: draft.pages, brandKit: draft.brandKit },
        domainFqdn: selectedDomain,
      });
      setPublished(result);
      setPhase("done");
    } finally {
      setLaunching(false);
    }
  }

  if (phase === "done" && published) {
    return <DoneScreen published={published} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-zinc-900">prompt2brand</p>
            <p className="text-sm text-zinc-500">Prompt your brand. Pick a domain. Launch.</p>
          </div>
          {hasSite(draft) ? (
            <p className="text-sm font-medium text-zinc-700">{draft.brandKit.name}</p>
          ) : null}
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <div className="relative flex-1">
          <BrandPreview brandKit={draft.brandKit} pages={draft.pages} />
          <DomainCard
            open={domainCardOpen && hasSite(draft)}
            collapsed={domainCardCollapsed}
            onToggleCollapse={() => setDomainCardCollapsed((v) => !v)}
            domains={domains}
            onDomainsChange={setDomains}
            selectedDomain={selectedDomain}
            onSelectDomain={setSelectedDomain}
            confirmed={confirmed}
            onConfirmChange={setConfirmed}
            onLaunch={handleLaunch}
            launching={launching}
            brandName={draft.brandKit.name}
          />
        </div>
      </main>

      <div className="sticky bottom-0 space-y-3 pb-2 pt-2">
        <SummaryLines lines={draft.summary} />
        <PromptBar
          value={promptInput}
          onChange={setPromptInput}
          onSubmit={handlePromptSubmit}
          loading={loading}
        />
      </div>
    </div>
  );
}
