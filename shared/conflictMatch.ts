export type HighlightRange = { start: number; end: number };

/** Conflict checks use the selected domain stem (e.g. miliojen from miliojen.org). */
export function conflictKeyword(fqdn: string): string {
  return fqdn.split(".")[0]?.replace(/-/g, " ").trim().toLowerCase() ?? fqdn.toLowerCase();
}

export function quoteForSearch(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) return trimmed;
  return trimmed.includes(" ") ? `"${trimmed}"` : `"${trimmed}"`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedAlphaNum(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length] ?? 0;
}

export function hasWholeWordMatch(part: string, haystack: string): boolean {
  if (part.length < 3) return false;
  const re = new RegExp(`\\b${escapeRegex(part)}\\b`, "i");
  return re.test(haystack);
}

export function tokenMatchesPart(token: string, part: string): boolean {
  const target = normalizedAlphaNum(part);
  const normalizedToken = normalizedAlphaNum(token);
  if (target.length < 4 || normalizedToken.length === 0) return false;
  if (Math.abs(normalizedToken.length - target.length) > 1) return false;
  return levenshtein(target, normalizedToken) <= 1;
}

export function hasCloseTokenMatch(part: string, haystack: string): boolean {
  const tokens = haystack.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return tokens.some((token) => tokenMatchesPart(token, part));
}

export function keywordMatchesHaystack(haystack: string, keyword: string): boolean {
  const parts = keyword.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;

  return parts.every(
    (part) => hasWholeWordMatch(part, haystack) || hasCloseTokenMatch(part, haystack),
  );
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [{ ...sorted[0] }];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];
    if (current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/** Ranges in `text` that matched the same rules used for conflict detection. */
export function findHighlightRanges(text: string, keyword: string): HighlightRange[] {
  const parts = keyword.trim().split(/\s+/).filter(Boolean);
  const ranges: HighlightRange[] = [];

  for (const part of parts) {
    if (part.length >= 3) {
      const wordRe = new RegExp(`\\b${escapeRegex(part)}\\b`, "gi");
      for (const match of text.matchAll(wordRe)) {
        if (match.index === undefined) continue;
        ranges.push({ start: match.index, end: match.index + match[0].length });
      }
    }

    const tokenRe = /[a-zA-Z0-9]+/g;
    for (const match of text.matchAll(tokenRe)) {
      if (match.index === undefined) continue;
      const token = match[0];
      if (!tokenMatchesPart(token, part)) continue;
      ranges.push({ start: match.index, end: match.index + token.length });
    }
  }

  return mergeRanges(ranges);
}
