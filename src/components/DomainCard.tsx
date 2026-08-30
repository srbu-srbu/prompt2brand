import { Button } from "@/components/ui/button";
import { useLaunchStatus } from "@/lib/launchStatus";
import { conflictsForDomain, apiDomainSuggestMore } from "@/lib/api";
import type { DomainSuggestion, PublishedSite } from "@/lib/types";
import { cn } from "@/lib/utils";

type DomainCardProps = {
  domains: DomainSuggestion[];
  onDomainsChange: (domains: DomainSuggestion[]) => void;
  selectedDomain: string | null;
  onSelectDomain: (fqdn: string) => void;
  confirmed: boolean;
  onConfirmChange: (confirmed: boolean) => void;
  onLaunch: () => void;
  launching?: boolean;
  brandName: string;
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

function LaunchStatusPanel({
  published,
}: {
  published: PublishedSite & { siteId: string };
}) {
  const status = useLaunchStatus(published.siteId);

  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-zinc-900">Your brand is launching</h2>
      <p className="mt-1 text-sm text-zinc-500">Links will become live as hosting and DNS finish.</p>

      <ul className="mt-4 space-y-3">
        <li className="flex items-center gap-3">
          <StatusDot status={status.hostingStatus} />
          <a
            href={published.hostedUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
          >
            {published.hostedUrl}
          </a>
          <span className="shrink-0 text-xs capitalize text-zinc-500">{status.hostingStatus}</span>
        </li>
        <li className="flex items-center gap-3">
          <StatusDot status={status.domainStatus ?? "pending"} />
          <a
            href={`https://${published.domainFqdn}`}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
          >
            {published.domainFqdn}
          </a>
          <span className="shrink-0 text-xs capitalize text-zinc-500">
            {status.domainStatus ?? "pending"}
          </span>
        </li>
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
  brandName,
  hasWebsite = false,
  published,
}: DomainCardProps) {
  const conflicts = selectedDomain ? conflictsForDomain(selectedDomain) : [];
  const launched = Boolean(published);

  async function loadMore() {
    try {
      const data = await apiDomainSuggestMore(
        domains.map((d) => d.fqdn),
        brandName,
      );
      onDomainsChange([...domains, ...data.domains]);
    } catch {
      // No fallback suggestions when the API is unavailable.
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex max-h-[min(420px,42vh)] w-full flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-50 shadow-lg shadow-zinc-950/10">
        {launched && published ? (
          <LaunchStatusPanel published={published} />
        ) : (
          <>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
              <section className="min-h-0 overflow-y-auto border-b border-zinc-200 bg-white p-3 md:border-b-0 md:border-r">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Powered by name.com
                </p>
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
                  <Button variant="outline" size="sm" className="mt-2 bg-white" onClick={loadMore}>
                    More suggestions
                  </Button>
                ) : null}
              </section>

              <section className="min-h-0 overflow-y-auto bg-zinc-50 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Powered by SerpApi
                </p>
                {selectedDomain ? (
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
                        {item.snippet ? (
                          <p className="mt-1 text-xs text-zinc-500">{item.snippet}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
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
              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={!selectedDomain || !confirmed || launching || !hasWebsite}
                onClick={onLaunch}
              >
                {launching ? "Launching..." : "Launch brand"}
              </Button>
              <p className="mt-1.5 text-xs text-zinc-500">
                {hasWebsite
                  ? "Includes hosted website and domain registration · Sandbox - no charge"
                  : "Create a website first, then return here to launch."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
