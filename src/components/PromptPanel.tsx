import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PromptMode = "site" | "domain";

type PromptPanelTabsProps = {
  mode: PromptMode;
  onModeChange: (mode: PromptMode) => void;
  disabled?: boolean;
};

const tabs: { id: PromptMode; label: string }[] = [
  { id: "site", label: "Create / Edit website" },
  { id: "domain", label: "Choose your domain" },
];

export function PromptPanelTabs({
  mode,
  onModeChange,
  disabled,
}: PromptPanelTabsProps) {
  return (
    <div className="flex gap-0.5 px-1.5 pt-1.5" role="tablist" aria-label="Prompt mode">
      {tabs.map((tab) => {
        const isActive = mode === tab.id;
        const isDisabled = disabled;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isDisabled}
            onClick={() => onModeChange(tab.id)}
            className={cn(
              "relative rounded-t-lg px-3 py-1.5 text-xs font-medium leading-snug transition-colors sm:px-3.5 sm:py-2",
              isActive
                ? "z-10 bg-white text-zinc-900 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-white"
                : "bg-transparent text-zinc-500 hover:bg-zinc-300/45 hover:text-zinc-700",
              isDisabled && "cursor-not-allowed opacity-45",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

type PromptPanelProps = {
  mode: PromptMode;
  onModeChange: (mode: PromptMode) => void;
  disabled?: boolean;
  summary: ReactNode;
  children: ReactNode;
};

export function PromptPanel({
  mode,
  onModeChange,
  disabled,
  summary,
  children,
}: PromptPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-300/70 bg-zinc-200/55 shadow-sm">
      <PromptPanelTabs mode={mode} onModeChange={onModeChange} disabled={disabled} />

      <div
        className={cn(
          "relative bg-white px-3 pb-2 pt-2.5 sm:px-4",
          mode === "site" ? "rounded-b-2xl rounded-tr-2xl" : "rounded-b-2xl rounded-tl-2xl",
        )}
      >
        <div className="mb-2">{summary}</div>
        {children}
      </div>
    </div>
  );
}