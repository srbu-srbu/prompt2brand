import { Button } from "@/components/ui/button";

type PromptBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function PromptBar({ value, onChange, onSubmit, disabled, loading }: PromptBarProps) {
  return (
    <div className="border-t border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl gap-2 px-4 py-4">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Describe your brand, tweak the site, or brainstorm domain names..."
          rows={2}
          disabled={disabled}
          className="min-h-[56px] flex-1 resize-none rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900/10 focus:ring-2 disabled:opacity-60"
        />
        <Button onClick={onSubmit} disabled={disabled || loading || !value.trim()} className="self-end">
          {loading ? "Working..." : "Go"}
        </Button>
      </div>
    </div>
  );
}
