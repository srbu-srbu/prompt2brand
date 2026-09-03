import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLaunchStatus } from "@/lib/launchStatus";
import {
  domainSteps,
  hostingSteps,
  LAUNCH_STEP_SLOTS,
  overallLaunchStatus,
  type LaunchStep,
} from "@/lib/launchSteps";
import { ConflictHighlight } from "@/components/ConflictHighlight";
import { apiDomainConflicts, apiDomainSuggestMore } from "@/lib/api";
import type { BrandConflict, DomainSuggestion, PublishedSite, SummaryLines } from "@/lib/types";
import { cn } from "@/lib/utils";
import { conflictKeyword } from "../../shared/conflictMatch";

type LaunchPreview = {
  domainFqdn: string;
};

export type LaunchUiPhase = "idle" | "spinner" | "status";

type DomainCardProps = {
  domains: DomainSuggestion[];
  onDomainsChange: (domains: DomainSuggestion[]) => void;
  selectedDomain: string | null;
  onSelectDomain: (fqdn: string) => void;
  confirmed: boolean;
  onConfirmChange: (confirmed: boolean) => void;
  onLaunch: () => void;
  launching?: boolean;
  launchUiPhase?: LaunchUiPhase;
  launchPreview?: LaunchPreview | null;
  brandName: string;
  domainCue?: string;
  brandTagline?: string;
  pageTitles?: string[];
  onMoreSummary?: (summary: SummaryLines) => void;
  hasWebsite?: boolean;
  published?: (PublishedSite & { siteId: string }) | null;
};

function StatusDot({ status }: { status: "pending" | "live" | "failed" }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        status === "live" && "bg-emerald-500",
        status === "pending" && "bg-amber-400",
        status === "failed" && "bg-red-500",
      )}
      aria-hidden
    />
  );
}

function LaunchStepLine({ step }: { step: LaunchStep }) {
  const hasContent = step.text.trim().length > 0;
  if (!hasContent) {
    return <p className="h-[1.125rem]" aria-hidden />;
  }

  return (
    <p
      className={cn(
        "h-[1.125rem] overflow-hidden text-xs leading-[1.125rem]",
        step.phase === "waiting" && "invisible",
        step.phase === "active" && "launch-step-active text-zinc-500",
        step.phase === "done" && "launch-step-done text-zinc-600",
        step.phase === "failed" && "text-red-600",
      )}
      aria-hidden={step.phase === "waiting"}
    >
      {step.text}
      {step.phase === "active" ? "…" : null}
    </p>
  );
}

function LaunchSpinnerPanel({ domainFqdn }: { domainFqdn: string }) {
  return (
    <div className="launch-spinner-enter flex min-h-[220px] flex-col items-center justify-center p-8">
      <Loader2 className="h-7 w-7 animate-spin text-zinc-400" aria-hidden />
      <p className="mt-4 text-sm font-medium text-zinc-900">Launching your brand</p>
      <p className="mt-1 text-xs text-zinc-500">{domainFqdn}</p>
    </div>
  );
}

function ColumnHeader({ title, poweredBy }: { title: string; poweredBy: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-xs font-medium text-zinc-800">{title}</p>
      <p className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
        {poweredBy}
      </p>
    </div>
  );
}

function conflictRiskLabel(conflicts: BrandConflict[]): "none" | "low" | "medium" | "high" {
  const count = conflicts.filter((item) => item.found).length;
  if (count === 0) return "none";
  if (count === 1) return "low";
  if (count === 2) return "medium";
  return "high";
}

function conflictSectionTitle(
  conflicts: BrandConflict[],
  loading: boolean,
  hasSelection: boolean,
): string {
  if (!hasSelection || loading) return "Brand conflicts";
  return `Brand conflicts: ${conflictRiskLabel(conflicts)}`;
}

function conflictUrlLabel(
  platform: BrandConflict["platform"],
  url: string,
): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (platform === "facebook") {
      const profileId = parsed.searchParams.get("id");
      if (profileId) return `${host}/profile (${profileId})`;
      const slug = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
      if (slug && !["pages", "people", "profile.php"].includes(slug)) {
        return `${host}/${slug}`;
      }
    }

    if (platform === "instagram" || platform === "x") {
      const handle = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
      if (handle) return `${host}/${handle}`;
    }

    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${host}${path}`;
  } catch {
    return url;
  }
}

function LaunchStatusRow({
  status,
  url,
  urlLabel,
  steps,
}: {
  status: "pending" | "live" | "failed";
  url: string | null;
  urlLabel: string;
  steps: LaunchStep[];
}) {
  const href = url?.startsWith("http") ? url : url ? `https://${url}` : null;

  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5">
        <StatusDot status={status} />
      </span>
      <div className="min-w-0 flex-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
          >
            {urlLabel}
          </a>
        ) : (
          <p className="truncate text-sm font-medium text-zinc-500">{urlLabel}</p>
        )}
        <div
          className="mt-1 space-y-0.5"
          style={{ minHeight: `${LAUNCH_STEP_SLOTS * 1.125 + (LAUNCH_STEP_SLOTS - 1) * 0.125}rem` }}
        >
          {steps.map((step, index) => (
            <LaunchStepLine key={`${step.text}-${index}`} step={step} />
          ))}
        </div>
      </div>
    </li>
  );
}

function LaunchStatusPanel({
  domainFqdn,
  hostedUrl,
  siteId,
  launching,
}: {
  domainFqdn: string;
  hostedUrl: string | null;
  siteId: string | null;
  launching: boolean;
}) {
  const polled = useLaunchStatus(siteId);
  const hostingStatus = siteId ? polled.hostingStatus : "pending";
  const domainStatus = siteId ? (polled.domainStatus ?? "pending") : "pending";
  const resolvedHostedUrl = hostedUrl ?? polled.hostedUrl;
  const overall = overallLaunchStatus(hostingStatus, domainStatus);
  const allLive = overall === "live";

  return (
    <div className="launch-status-enter p-4">
      <div className="flex items-center gap-2">
        <StatusDot status={overall} />
        <h2 className="text-base font-semibold text-zinc-900">
          {allLive ? "Your brand is live" : "Your brand is launching"}
        </h2>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {allLive
          ? "Both links are ready — open them in a new tab."
          : "Status updates below as hosting and DNS finish."}
      </p>

      <ul className="mt-4 space-y-4">
        <LaunchStatusRow
          status={hostingStatus}
          url={resolvedHostedUrl}
          urlLabel={resolvedHostedUrl ?? "Preparing your Vercel URL…"}
          steps={hostingSteps(launching, hostingStatus)}
        />
        <LaunchStatusRow
          status={domainStatus}
          url={domainFqdn}
          urlLabel={domainFqdn}
          steps={domainSteps(launching, domainStatus)}
        />
      </ul>
    </div>
  );
}

export function DomainCard({
  domains,
  onDomainsChange,
  selectedDomain,
  onSelectDomain,
  confirmed,
  onConfirmChange,
  onLaunch,
  launching,
  launchUiPhase = "idle",
  launchPreview,
  brandName,
  domainCue,
  brandTagline,
  pageTitles,
  onMoreSummary,
  hasWebsite = false,
  published,
}: DomainCardProps) {
  const [conflicts, setConflicts] = useState<BrandConflict[]>([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreMessage, setMoreMessage] = useState<string | null>(null);
  const [liveIntegrationsMode, setLiveIntegrationsMode] = useState<0 | 1 | 2 | null>(null);
  const showLaunchStatus =
    Boolean(published) || (launchUiPhase === "status" && Boolean(launchPreview));
  const showLaunchSpinner = launchUiPhase === "spinner" && Boolean(launchPreview);
  const conflictMatchKeyword = selectedDomain ? conflictKeyword(selectedDomain) : "";

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { liveIntegrationsMode?: number } | null) => {
        if (!cancelled && data && typeof data.liveIntegrationsMode === "number") {
          const mode = data.liveIntegrationsMode;
          if (mode === 0 || mode === 1 || mode === 2) setLiveIntegrationsMode(mode);
        }
      })
      .catch(() => {
        if (!cancelled) setLiveIntegrationsMode(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedDomain) {
      setConflicts([]);
      setConflictsLoading(false);
      return;
    }

    let cancelled = false;
    setConflictsLoading(true);

    void apiDomainConflicts(selectedDomain, brandName)
      .then((result) => {
        if (!cancelled) setConflicts(result.conflicts);
      })
      .catch(() => {
        if (!cancelled) setConflicts([]);
      })
      .finally(() => {
        if (!cancelled) setConflictsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDomain, brandName]);

  async function loadMore() {
    setLoadingMore(true);
    setMoreMessage(null);
    try {
      const data = await apiDomainSuggestMore({
        exclude: domains.map((d) => d.fqdn),
        domainCue,
        brandName,
        tagline: brandTagline,
        pageTitles,
      });
      if (data.domains.length === 0) {
        setMoreMessage("No additional domains found — try a domain prompt with new keywords.");
        return;
      }
      onDomainsChange([...domains, ...data.domains]);
      onMoreSummary?.(data.summary);
    } catch {
      setMoreMessage("More suggestions failed — try again in a moment.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <div
        className={cn(
          "flex max-h-[min(420px,42vh)] w-full flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-50 shadow-lg shadow-zinc-950/10",
          (showLaunchSpinner || showLaunchStatus) && "min-h-[300px]",
        )}
      >
        {showLaunchSpinner ? (
          <LaunchSpinnerPanel
            domainFqdn={launchPreview?.domainFqdn ?? selectedDomain ?? ""}
          />
        ) : showLaunchStatus ? (
          <LaunchStatusPanel
            domainFqdn={published?.domainFqdn ?? launchPreview?.domainFqdn ?? ""}
            hostedUrl={published?.hostedUrl ?? null}
            siteId={published?.siteId ?? null}
            launching={Boolean(launching && !published)}
          />
        ) : (
          <>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
              <section className="min-h-0 overflow-y-auto border-b border-zinc-200 bg-white p-3 md:border-b-0 md:border-r">
                <ColumnHeader title="Domain suggestions" poweredBy="Powered by name.com" />
                <ul className="space-y-1.5">
                  {domains.map((domain) => (
                    <li key={domain.fqdn}>
                      <button
                        type="button"
                        onClick={() => onSelectDomain(domain.fqdn)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          selectedDomain === domain.fqdn
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-zinc-50 hover:border-zinc-400 hover:bg-white",
                        )}
                      >
                        <span>{domain.fqdn}</span>
                        <span className="text-xs opacity-80">{domain.priceLabel ?? "Available"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {domains.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No suggestions yet. Describe your brand idea in the prompt below.
                  </p>
                ) : null}
                {domains.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Searching…" : "More suggestions"}
                    </Button>
                    {moreMessage ? (
                      <p className="text-xs text-zinc-500">{moreMessage}</p>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="min-h-0 overflow-y-auto bg-zinc-50 p-3">
                <ColumnHeader
                  title={conflictSectionTitle(conflicts, conflictsLoading, Boolean(selectedDomain))}
                  poweredBy="Powered by SerpApi"
                />
                {selectedDomain ? (
                  conflictsLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-4 text-sm text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Checking brand conflicts…
                    </div>
                  ) : (
                  <ul className="space-y-1.5">
                    {conflicts.map((item) => (
                      <li
                        key={item.platform}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.label}</span>
                          <span className={item.found ? "text-amber-700" : "text-emerald-700"}>
                            {item.found ? "Conflict" : "Clear"}
                          </span>
                        </div>
                        {item.found && item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block truncate text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
                            title={item.url}
                          >
                            <ConflictHighlight
                              text={conflictUrlLabel(item.platform, item.url)}
                              keyword={conflictMatchKeyword}
                            />
                          </a>
                        ) : null}
                        {item.snippet ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            <ConflictHighlight text={item.snippet} keyword={conflictMatchKeyword} />
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  )
                ) : (
                  <p className="text-sm text-zinc-600">Select a domain to check brand conflicts.</p>
                )}
              </section>
            </div>

            <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3">
              <p className="mb-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">{brandName || "Your brand"}</span>
                {selectedDomain ? <> · {selectedDomain}</> : null}
              </p>
              <label className="mb-2 flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => onConfirmChange(e.target.checked)}
                  disabled={!selectedDomain || !hasWebsite}
                />
                I confirm this website and domain
              </label>
              <div className="flex w-full items-center justify-between gap-y-2">
                <Button
                  size="default"
                  className="h-9 shrink-0 px-4 text-base"
                  disabled={!selectedDomain || !confirmed || launching || !hasWebsite}
                  onClick={onLaunch}
                >
                  {launching ? "Launching..." : "Launch brand"}
                </Button>
                {liveIntegrationsMode !== null ? (
                  <p className="shrink-0 text-sm text-zinc-600">
                    Live Integration:{" "}
                    <span
                      className={
                        liveIntegrationsMode === 0
                          ? "font-medium text-zinc-500"
                          : "font-medium text-emerald-700"
                      }
                    >
                      {liveIntegrationsMode === 0 ? "Off (0)" : `On (${liveIntegrationsMode})`}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
