type SummaryLinesProps = {
  lines: [string, string];
};

export function SummaryLines({ lines }: SummaryLinesProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <p className="truncate text-sm text-zinc-700">{lines[0]}</p>
      <p className="truncate text-sm text-zinc-500">{lines[1]}</p>
    </div>
  );
}
