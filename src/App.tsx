import { useEffect, useState } from "react";
import { BrandPreview } from "@/components/BrandPreview";
import { DomainCard } from "@/components/DomainCard";
import { PromptBar } from "@/components/PromptBar";
import { PromptPanel, type PromptMode } from "@/components/PromptPanel";
import { SummaryLines } from "@/components/SummaryLines";
import {
  safeDomainSuggest,
  safeGenerate,
  safePublish,
} from "@/lib/api";
import {
  appendPromptHistory,
  hasSite,
  loadDraft,
  mergeDraft,
  saveDraft,
} from "@/lib/draft";
import type { AppPhase, DomainSuggestion, Draft, PublishedSite } from "@/lib/types";

const domainCardProps = (
  domains: DomainSuggestion[],
  setDomains: (domains: DomainSuggestion[]) => void,
  selectedDomain: string | null,
  setSelectedDomain: (fqdn: string | null) => void,
  confirmed: boolean,
  setConfirmed: (confirmed: boolean) => void,
  handleLaunch: () => void,
  launching: boolean,
  brandName: string,
  hasWebsite: boolean,
  published: (PublishedSite & { siteId: string }) | null,
) => ({
  domains,
  onDomainsChange: setDomains,
  selectedDomain,
  onSelectDomain: setSelectedDomain,
  confirmed,
  onConfirmChange: setConfirmed,
  onLaunch: handleLaunch,
  launching,
  brandName,
  hasWebsite,
  published,
});

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("build");
  const [draft, setDraft] = useState<Draft>(() => loadDraft());
  const [promptInput, setPromptInput] = useState("");
  const [promptMode, setPromptMode] = useState<PromptMode>("site");
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<DomainSuggestion[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [published, setPublished] = useState<(PublishedSite & { siteId: string }) | null>(null);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (!hasSite(draft)) return;
    const keyword = draft.prompt || draft.brandKit.name || "brand";
    void safeDomainSuggest(keyword, draft.brandKit.name).then((result) => {
      setDomains((current) => (current.length > 0 ? current : result.domains));
    });
  }, [draft.pages.length, draft.prompt, draft.brandKit.name]);

  function handlePromptModeChange(mode: PromptMode) {
    setPromptMode(mode);
  }

  async function handlePromptSubmit() {
    const prompt = promptInput.trim();
    if (!prompt || loading) return;

    setLoading(true);
    setPromptInput("");

    try {
      if (promptMode === "domain") {
        const result = await safeDomainSuggest(prompt, draft.brandKit.name);
        setDomains(result.domains);
        setDraft((current) =>
          mergeDraft(current, {
            prompt,
            promptHistory: appendPromptHistory(current.promptHistory, prompt),
            summary: result.summary,
            status: "ready",
          }),
        );
      } else {
        const result = await safeGenerate(prompt, draft);
        const rebrand = draft.brandKit.name !== result.brandKit.name;
        setDraft((current) =>
          mergeDraft(current, {
            prompt,
            promptHistory: appendPromptHistory(current.promptHistory, prompt),
            brandKit: result.brandKit,
            pages: result.pages,
            summary: result.summary,
            status: "ready",
          }),
        );
        if (domains.length === 0 || rebrand) {
          const domainResult = await safeDomainSuggest(prompt, result.brandKit.name);
          setDomains(domainResult.domains);
          if (rebrand) {
            setSelectedDomain(null);
            setConfirmed(false);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!selectedDomain || !confirmed || launching || !hasSite(draft)) return;
    setLaunching(true);
    try {
      const result = await safePublish({
        draft: { pages: draft.pages, brandKit: draft.brandKit },
        domainFqdn: selectedDomain,
      });
      setPublished(result);
      setPhase("done");
      setPromptMode("domain");
      setDraft((current) =>
        mergeDraft(current, {
          summary: ["Your brand is launching.", `Domain: ${selectedDomain}`],
          status: "ready",
        }),
      );
    } finally {
      setLaunching(false);
    }
  }

  const launched = phase === "done" && published;
  const showDomainCard = Boolean(launched || promptMode === "domain");

  const cardProps = domainCardProps(
    domains,
    setDomains,
    selectedDomain,
    setSelectedDomain,
    confirmed,
    setConfirmed,
    handleLaunch,
    launching,
    draft.brandKit.name,
    hasSite(draft),
    published,
  );

  return (
    <div className="relative flex h-dvh flex-col gap-1 overflow-hidden bg-zinc-50">
      <div className="preview-canvas pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="app-header relative shrink-0 pt-3">
          <div className="app-shell flex items-center justify-between pb-3">
            <div>
              <p className="app-header-title">prompt2brand</p>
              <p className="app-header-tagline">Prompt your brand. Pick a domain. Launch.</p>
            </div>
            {hasSite(draft) ? (
              <p className="app-header-brand">{draft.brandKit.name}</p>
            ) : null}
          </div>
          <div className="app-shell" aria-hidden="true">
            <div className="shell-divider" />
          </div>
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col">
          <div className="app-shell flex h-full min-h-0 flex-col pt-3 pb-0">
            <div className="relative min-h-0 flex-1">
              <BrandPreview brandKit={draft.brandKit} pages={draft.pages} />
              {showDomainCard ? (
                <div className="pointer-events-none absolute bottom-0 left-0 z-30 w-full max-w-2xl">
                  <div className="pointer-events-auto">
                    <DomainCard {...cardProps} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>

      <footer className="relative z-20 shrink-0 pb-3">
        <div className="app-shell">
          <PromptPanel
            mode={promptMode}
            onModeChange={handlePromptModeChange}
            disabled={Boolean(launched) || launching}
            summary={<SummaryLines lines={draft.summary} />}
          >
            <PromptBar
              value={promptInput}
              onChange={setPromptInput}
              onSubmit={handlePromptSubmit}
              mode={promptMode}
              loading={loading}
              disabled={Boolean(launched) || launching}
              embedded
            />
          </PromptPanel>
        </div>
      </footer>
    </div>
  );
}
