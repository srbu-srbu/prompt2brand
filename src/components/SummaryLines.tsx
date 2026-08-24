type SummaryLinesProps = {
  lines: [string, string];
  className?: string;
};

export function SummaryLines({ lines, className }: SummaryLinesProps) {
  return (
    <div className={className}>
      <p className="truncate text-sm text-zinc-700">{lines[0]}</p>
      <p className="truncate text-sm text-zinc-500">{lines[1]}</p>
    </div>
  );
}
