import type { SummaryLines as SummaryTuple } from "@/lib/types";

type SummaryLinesProps = {
  lines: SummaryTuple;
  className?: string;
};

export function SummaryLines({ lines, className }: SummaryLinesProps) {
  return (
    <div className={className}>
      <p className="truncate text-sm text-zinc-700">{lines[0]}</p>
      <p className="truncate text-sm text-zinc-500">{lines[1]}</p>
      <p className="truncate text-sm text-zinc-500">{lines[2]}</p>
    </div>
  );
}
