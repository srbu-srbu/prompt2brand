import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type PromptMode = "site" | "domain";

type PromptPanelTabsProps = {
  mode: PromptMode;
  onModeChange: (mode: PromptMode) => void;
  domainCardOpen?: boolean;
  siteTabDisabled?: boolean;
};

const tabs: { id: PromptMode; label: string }[] = [
  { id: "site", label: "Create / Edit website" },
  { id: "domain", label: "Choose your domain" },
];

export function PromptPanelTabs({
  mode,
  onModeChange,
  domainCardOpen = false,
  siteTabDisabled,
}: PromptPanelTabsProps) {
  return (
    <div className="relative pt-1.5 pl-3 pr-1.5 sm:pl-3.5">
      <div
        className="flex gap-0.5 pr-[9.5rem] sm:pr-[10.5rem]"
        role="tablist"
        aria-label="Prompt mode"
      >
      {tabs.map((tab) => {
        const isActive = mode === tab.id;
        const isDomainTab = tab.id === "domain";
        const isDisabled = isDomainTab ? false : Boolean(siteTabDisabled);

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-expanded={isDomainTab ? domainCardOpen : undefined}
            disabled={isDisabled}
            onClick={() => onModeChange(tab.id)}
            className={cn(
              "relative inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium leading-snug transition-colors sm:px-3.5 sm:py-2",
              isActive
                ? cn(
                    "z-10 bg-white text-zinc-900 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-white",
                    isDomainTab ? "rounded-tl-lg rounded-tr-2xl" : "rounded-tl-2xl rounded-tr-lg",
                  )
                : "rounded-t-lg bg-transparent text-zinc-500 hover:bg-zinc-300/45 hover:text-zinc-700",
              isDisabled && "cursor-not-allowed opacity-45",
            )}
          >
            <span>{tab.label}</span>
            {isDomainTab ? (
              domainCardOpen && isActive ? (
                <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              ) : isActive ? (
                <ChevronUp className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              ) : null
            ) : null}
          </button>
        );
      })}
      </div>
      <p className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide text-zinc-500 sm:right-3">
        Powered by Meta Model API
      </p>
    </div>
  );
}

type PromptPanelProps = {
  mode: PromptMode;
  onModeChange: (mode: PromptMode) => void;
  domainCardOpen?: boolean;
  siteTabDisabled?: boolean;
  promptDisabled?: boolean;
  summary: ReactNode;
  children: ReactNode;
};

export function PromptPanel({
  mode,
  onModeChange,
  domainCardOpen,
  siteTabDisabled,
  promptDisabled,
  summary,
  children,
}: PromptPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-300/70 bg-zinc-200/55 shadow-sm">
      <PromptPanelTabs
        mode={mode}
        onModeChange={onModeChange}
        domainCardOpen={domainCardOpen}
        siteTabDisabled={siteTabDisabled}
      />

      <div
        className="relative rounded-b-2xl rounded-tl-2xl rounded-tr-2xl bg-white px-3 pb-2 pt-2.5 sm:px-4"
      >
        <div className="mb-2">{summary}</div>
        <fieldset disabled={promptDisabled} className="min-w-0 border-0 p-0 m-0">
          {children}
        </fieldset>
      </div>
    </div>
  );
}