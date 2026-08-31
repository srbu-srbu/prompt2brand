import { ArrowUp, Loader2 } from "lucide-react";
import type { PromptMode } from "@/components/PromptPanel";
import { cn } from "@/lib/utils";

const PLACEHOLDERS: Record<PromptMode, string> = {
  site: "Describe your brand, add pages, or tweak the preview…",
  domain: "Brainstorm domain names — shorter, playful, or alternate spellings…",
};

type PromptBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  mode?: PromptMode;
  disabled?: boolean;
  loading?: boolean;
  embedded?: boolean;
};

export function PromptBar({
  value,
  onChange,
  onSubmit,
  mode = "site",
  disabled,
  loading,
  embedded = false,
}: PromptBarProps) {
  const canSubmit = !disabled && !loading && value.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit();
  }

  return (
    <div>
      <div
        className={cn(
          "relative w-full transition-shadow",
          embedded
            ? cn(
                "rounded-xl border border-zinc-200 bg-zinc-50/80",
                "focus-within:border-zinc-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-900/5",
              )
            : cn(
                "rounded-2xl border bg-white shadow-sm",
                "focus-within:border-zinc-300 focus-within:shadow-md focus-within:ring-2 focus-within:ring-zinc-900/5",
              ),
          disabled && "opacity-60",
        )}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={PLACEHOLDERS[mode]}
          rows={3}
          disabled={disabled || loading}
          className="block w-full resize-none bg-transparent px-3.5 py-3 pr-14 text-[15px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed sm:px-4 sm:py-3.5"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label={loading ? "Working on your prompt" : "Send prompt"}
          className={cn(
            "absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg transition-all",
            canSubmit
              ? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 active:scale-95"
              : "cursor-not-allowed bg-zinc-200/80 text-zinc-400",
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
