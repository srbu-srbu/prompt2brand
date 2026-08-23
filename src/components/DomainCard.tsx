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

  if (collapsed) {
    return (
      <div className="absolute inset-x-4 top-4 z-20 flex justify-center">
        <Button variant="outline" size="sm" onClick={onToggleCollapse} className="gap-1 bg-white shadow">
          <ChevronDown className="h-4 w-4" />
          Choose your domain
        </Button>
      </div>
    );
  }

  const conflicts = selectedDomain ? conflictsForDomain(selectedDomain) : [];

  async function loadMore() {
    try {
      const data = await apiDomainSuggestMore(domains.map((d) => d.fqdn));
      onDomainsChange([...domains, ...data.domains]);
    } catch {
      onDomainsChange([
        ...domains,
        { fqdn: "pawfuel.io", priceLabel: "Available" },
        { fqdn: "pawfuel.pet", priceLabel: "Available" },
      ]);
    }
  }

  return (
    <div className="absolute inset-4 z-20 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Choose your domain</h2>
          <p className="text-sm text-zinc-500">Website editor + domain - prompt to edit anytime</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleCollapse} aria-label="Collapse domain card">
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-2">
        <section className="border-b border-zinc-100 p-4 md:border-b-0 md:border-r">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Powered by name.com
          </p>
          <ul className="space-y-2">
            {domains.map((domain) => (
              <li key={domain.fqdn}>
                <button
                  type="button"
                  onClick={() => onSelectDomain(domain.fqdn)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selectedDomain === domain.fqdn
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 hover:border-zinc-400",
                  )}
                >
                  <span>{domain.fqdn}</span>
                  <span className="text-xs opacity-80">{domain.priceLabel ?? "Available"}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-3" onClick={loadMore}>
            More suggestions
          </Button>
        </section>

        <section className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Powered by SerpApi
          </p>
          {selectedDomain ? (
            <ul className="space-y-2">
              {conflicts.map((item) => (
                <li
                  key={item.platform}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
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
            <p className="text-sm text-zinc-500">Select a domain to check brand conflicts.</p>
          )}
        </section>
      </div>

      <div className="border-t border-zinc-100 px-5 py-4">
        <p className="mb-3 text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">{brandName || "Your brand"}</span>
          {selectedDomain ? <> · {selectedDomain}</> : null}
        </p>
        <label className="mb-3 flex items-center gap-2 text-sm text-zinc-700">
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
          className="w-full md:w-auto"
          disabled={!selectedDomain || !confirmed || launching}
          onClick={onLaunch}
        >
          {launching ? "Launching..." : "Launch brand"}
        </Button>
        <p className="mt-2 text-xs text-zinc-500">
          Includes hosted website and domain registration · Sandbox - no charge
        </p>
      </div>
    </div>
  );
}
