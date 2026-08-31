import type { ReactNode } from "react";
import { findHighlightRanges } from "../../shared/conflictMatch";
import { cn } from "@/lib/utils";

type ConflictHighlightProps = {
  text: string;
  keyword: string;
  className?: string;
};

export function ConflictHighlight({ text, keyword, className }: ConflictHighlightProps) {
  const ranges = findHighlightRanges(text, keyword);
  if (ranges.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      nodes.push(text.slice(cursor, range.start));
    }
    nodes.push(
      <mark
        key={`${range.start}-${range.end}`}
        className="rounded bg-amber-200/90 px-0.5 text-inherit"
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return <span className={cn(className)}>{nodes}</span>;
}
