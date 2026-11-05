import { useEffect, useState } from "react";
import { BrandPreview } from "@/components/BrandPreview";
import { DomainCard, type LaunchUiPhase } from "@/components/DomainCard";
import { LogoCard } from "@/components/LogoCard";
import { PromptBar } from "@/components/PromptBar";
import { PromptPanel, type PromptMode } from "@/components/PromptPanel";
import { SummaryLines } from "@/components/SummaryLines";
import {
  safeDomainSuggest,
  safeGenerate,
  safeLogoGenerate,
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
  launchUiPhase: LaunchUiPhase,
  launchPreview: { domainFqdn: string } | null,
  brandName: string,
  domainPrompt: string,
  brandTagline: string,
  pageTitles: string[],
  onMoreSummary: (summary: Draft["summary"]) => void,
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
  launchUiPhase,
  launchPreview,
  brandName,
  domainCue: domainPrompt,
  brandTagline,
  pageTitles,
  onMoreSummary,
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
  const [latestDomainCue, setLatestDomainCue] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchUiPhase, setLaunchUiPhase] = useState<LaunchUiPhase>("idle");
  const [launchPreview, setLaunchPreview] = useState<{ domainFqdn: string } | null>(null);
  const [domainCardOpen, setDomainCardOpen] = useState(false);
  const [logoCardOpen, setLogoCardOpen] = useState(false);
  const [published, setPublished] = useState<(PublishedSite & { siteId: string }) | null>(null);

  const LAUNCH_SPINNER_MS = 650;

  function launchSpinnerDelay() {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, LAUNCH_SPINNER_MS);
    });
  }

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (!hasSite(draft)) return;
    const keyword = draft.prompt || draft.brandKit.name || "brand";
    const context = {
      brandName: draft.brandKit.name,
      tagline: draft.brandKit.tagline,
      pageTitles: draft.pages.map((page) => page.title),
    };
    void safeDomainSuggest(keyword, context).then((result) => {
      setDomains((current) => (current.length > 0 ? current : result.domains));
    });
  }, [draft.pages.length, draft.prompt, draft.brandKit.name, draft.brandKit.tagline]);

  function handlePromptModeChange(mode: PromptMode) {
    if (mode === "domain") {
      if (promptMode === "domain") {
        if (!launching) {
          setDomainCardOpen((open) => !open);
        }
      } else {
        setPromptMode("domain");
        setDomainCardOpen(true);
        setLogoCardOpen(false);
      }
      return;
    }

    if (mode === "logo") {
      if (promptMode === "logo") {
        if (!launching) {
          setLogoCardOpen((open) => !open);
        }
      } else {
        setPromptMode("logo");
        setLogoCardOpen(true);
        setDomainCardOpen(false);
      }
      return;
    }

    setPromptMode("site");
    setDomainCardOpen(false);
    setLogoCardOpen(false);
  }

  async function handlePromptSubmit() {
    const prompt = promptInput.trim();
    if (!prompt || loading) return;
    if (promptMode === "logo" && !hasSite(draft)) return;

    setLoading(true);
    setPromptInput("");

    try {
      const domainContext = {
        brandName: draft.brandKit.name,
        tagline: draft.brandKit.tagline,
        pageTitles: draft.pages.map((page) => page.title),
      };

      if (promptMode === "logo") {
        try {
          const result = await safeLogoGenerate({
            prompt,
            brandKit: draft.brandKit,
            brandAssets: draft.brandAssets,
          });
          setDraft((current) =>
            mergeDraft(current, {
              prompt,
              promptHistory: appendPromptHistory(current.promptHistory, prompt),
              brandAssets: result.brandAssets ?? current.brandAssets,
              summary: result.summary,
              status: "ready",
            }),
          );
        } catch {
          setDraft((current) =>
            mergeDraft(current, {
              prompt,
              promptHistory: appendPromptHistory(current.promptHistory, prompt),
              summary: [
                "Logo update failed — try again in a moment.",
                `Latest cue: ${prompt.slice(0, 60)}`,
                "Check MODEL_API_KEY and Muse Image access.",
              ],
              status: "ready",
            }),
          );
        }
      } else if (promptMode === "domain") {
        setLatestDomainCue(prompt);
        try {
          const result = await safeDomainSuggest(prompt, domainContext);
          setDomains(result.domains);
          setSelectedDomain(null);
          setConfirmed(false);
          setDraft((current) =>
            mergeDraft(current, {
              prompt,
              promptHistory: appendPromptHistory(current.promptHistory, prompt),
              summary: result.domains.length
                ? result.summary
                : [
                    "No available domains matched that search.",
                    result.summary[1] ?? `Keywords: ${prompt.slice(0, 60)}`,
                    result.summary[2] ?? "Try different TLDs or shorter stems.",
                  ],
              status: "ready",
            }),
          );
        } catch {
          setDraft((current) =>
            mergeDraft(current, {
              prompt,
              promptHistory: appendPromptHistory(current.promptHistory, prompt),
              summary: [
                "Domain search failed — try again in a moment.",
                `Latest cue: ${prompt.slice(0, 60)}`,
                "Check MODEL_API_KEY and name.com credentials.",
              ],
              status: "ready",
            }),
          );
        }
      } else {
        const result = await safeGenerate(prompt, draft);
        const rebrand = draft.brandKit.name !== result.brandKit.name;
        setDraft((current) =>
          mergeDraft(current, {
            prompt,
            promptHistory: appendPromptHistory(current.promptHistory, prompt),
            brandKit: result.brandKit,
            brandAssets: result.brandAssets ?? current.brandAssets,
            pages: result.pages,
            summary: result.summary,
            status: "ready",
          }),
        );
        if (domains.length === 0 || rebrand) {
          const domainResult = await safeDomainSuggest(prompt, {
            brandName: result.brandKit.name,
            tagline: result.brandKit.tagline,
            pageTitles: result.pages.map((page) => page.title),
          });
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
    setLaunchUiPhase("spinner");
    setLaunchPreview({ domainFqdn: selectedDomain });
    setPromptMode("domain");
    setDomainCardOpen(true);
    setDraft((current) =>
      mergeDraft(current, {
        summary: ["Your brand is launching.", `Domain: ${selectedDomain}`, "Links will appear below as hosting finishes."],
        status: "ready",
      }),
    );

    const publishPromise = safePublish({
      draft: { pages: draft.pages, brandKit: draft.brandKit, brandAssets: draft.brandAssets },
      domainFqdn: selectedDomain,
    });

    try {
      await launchSpinnerDelay();
      setLaunchUiPhase("status");

      const result = await publishPromise;
      setPublished(result);
      setPhase("done");
      setLaunchPreview(null);
    } catch {
      setLaunchPreview(null);
      setLaunchUiPhase("idle");
      setDraft((current) =>
        mergeDraft(current, {
          summary: ["Launch failed — try again in a moment.", `Domain: ${selectedDomain}`, "Your preview is unchanged."],
          status: "ready",
        }),
      );
    } finally {
      setLaunching(false);
    }
  }

  const launched = phase === "done" && published;
  const domainCardVisible = domainCardOpen && (promptMode === "domain" || launching || launched);
  const logoCardVisible = logoCardOpen && promptMode === "logo" && !launched && !launching;

  const cardProps = domainCardProps(
    domains,
    setDomains,
    selectedDomain,
    setSelectedDomain,
    confirmed,
    setConfirmed,
    handleLaunch,
    launching,
    launchUiPhase,
    launchPreview,
    draft.brandKit.name,
    latestDomainCue || draft.prompt,
    draft.brandKit.tagline,
    draft.pages.map((page) => page.title),
    (summary) => {
      setDraft((current) => mergeDraft(current, { summary, status: "ready" }));
    },
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
              <BrandPreview
                brandKit={draft.brandKit}
                brandAssets={draft.brandAssets}
                pages={draft.pages}
                generating={loading && promptMode === "site"}
              />
              <div
                className={`domain-card-fade absolute bottom-0 left-0 z-30 w-full max-w-md ${
                  logoCardVisible ? "domain-card-fade-open" : "domain-card-fade-closed"
                }`}
              >
                <LogoCard
                  brandKit={draft.brandKit}
                  brandAssets={draft.brandAssets}
                  hasWebsite={hasSite(draft)}
                  updating={loading && promptMode === "logo"}
                />
              </div>
              <div
                className={`domain-card-fade absolute bottom-0 left-0 z-30 w-full max-w-2xl ${
                  domainCardVisible ? "domain-card-fade-open" : "domain-card-fade-closed"
                }`}
              >
                <DomainCard {...cardProps} />
              </div>
            </div>
          </div>
        </main>
      </div>

      <footer className="relative z-20 shrink-0 pb-3">
        <div className="app-shell">
          <PromptPanel
            mode={promptMode}
            onModeChange={handlePromptModeChange}
            domainCardOpen={domainCardOpen}
            logoCardOpen={logoCardOpen}
            siteTabDisabled={Boolean(launched) || launching}
            logoTabDisabled={Boolean(launched) || launching}
            promptDisabled={Boolean(launched) || launching}
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
