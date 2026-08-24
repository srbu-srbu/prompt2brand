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
  collapsed: boolean,
  onToggleCollapse: () => void,
) => ({
  open: true as const,
  collapsed,
  onToggleCollapse,
  domains,
  onDomainsChange: setDomains,
  selectedDomain,
  onSelectDomain: setSelectedDomain,
  confirmed,
  onConfirmChange: setConfirmed,
  onLaunch: handleLaunch,
  launching,
  brandName,
});

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("build");
  const [draft, setDraft] = useState<Draft>(() => loadDraft());
  const [promptInput, setPromptInput] = useState("");
  const [loading, setLoading] = useState(false);
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
    if (!hasSite(draft)) return;
    const keyword = draft.prompt || draft.brandKit.name || "brand";
    void safeDomainSuggest(keyword).then((result) => {
      setDomains((current) => (current.length > 0 ? current : result.domains));
    });
  }, [draft.pages.length, draft.prompt, draft.brandKit.name]);

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
          const rebrand = draft.brandKit.name !== result.brandKit.name;
          setDraft((current) =>
            mergeDraft(current, {
              prompt,
              brandKit: result.brandKit,
              pages: result.pages,
              summary: result.summary,
              status: "ready",
            }),
          );
          if (domains.length === 0 || rebrand) {
            const domainResult = await safeDomainSuggest(prompt);
            setDomains(domainResult.domains);
            if (rebrand) {
              setSelectedDomain(null);
              setConfirmed(false);
            }
          }
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
    domainCardCollapsed,
    () => setDomainCardCollapsed((v) => !v),
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-50">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="preview-canvas pointer-events-none absolute inset-0" aria-hidden="true" />
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
          <div className="app-shell flex h-full min-h-0 flex-col py-3">
            <BrandPreview brandKit={draft.brandKit} pages={draft.pages} />
          </div>
        </main>
      </div>

      <footer className="relative z-20 shrink-0 bg-zinc-50/90 pb-3 backdrop-blur-sm">
        <div className="app-shell pt-3">
          <div className="shell-divider mb-3" aria-hidden="true" />
          <div className="relative">
            <SummaryLines
              lines={draft.summary}
              className={hasSite(draft) ? "max-w-[calc(100%-11.5rem)] pr-2" : undefined}
            />
            <div className="relative mt-2">
              {hasSite(draft) ? (
                <div className="absolute bottom-full right-0 z-40 mb-2 w-full max-w-2xl">
                  <DomainCard {...cardProps} />
                </div>
              ) : null}
              <PromptBar
                value={promptInput}
                onChange={setPromptInput}
                onSubmit={handlePromptSubmit}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
