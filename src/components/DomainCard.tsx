import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { conflictsForDomain, apiDomainSuggestMore } from "@/lib/api";
import type { DomainSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";

type DomainCardProps = {
  open: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  domains: DomainSuggestion[];
  onDomainsChange: (domains: DomainSuggestion[]) => void;
  selectedDomain: string | null;
  onSelectDomain: (fqdn: string) => void;
  confirmed: boolean;
  onConfirmChange: (confirmed: boolean) => void;
  onLaunch: () => void;
  launching?: boolean;
  brandName: string;
};

const toggleClassName =
  "gap-1 border border-zinc-300 bg-zinc-50 shadow-md hover:bg-white";

export function DomainCard({
  open,
  collapsed,
  onToggleCollapse,
  domains,
  onDomainsChange,
  selectedDomain,
  onSelectDomain,
  confirmed,
  onConfirmChange,
  onLaunch,
  launching,
  brandName,
}: DomainCardProps) {
  if (!open) return null;

  const conflicts = selectedDomain ? conflictsForDomain(selectedDomain) : [];

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
    <div className="flex w-full max-w-2xl flex-col items-end gap-2">
      {!collapsed ? (
        <div className="flex max-h-[min(420px,42vh)] w-full flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-50 shadow-lg shadow-zinc-950/10">
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
                disabled={!selectedDomain}
              />
              I confirm this website and domain
            </label>
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={!selectedDomain || !confirmed || launching}
              onClick={onLaunch}
            >
              {launching ? "Launching..." : "Launch brand"}
            </Button>
            <p className="mt-1.5 text-xs text-zinc-500">
              Includes hosted website and domain registration · Sandbox - no charge
            </p>
          </div>
        </div>
      ) : null}

      <Button variant="outline" size="sm" onClick={onToggleCollapse} className={toggleClassName}>
        {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Choose your domain
      </Button>
    </div>
  );
}
