import type { BrandKit, Draft, PageDraft, SummaryLines } from "./types";

const STORAGE_KEY = "prompt2brand:draft";

export const PROMPT_HISTORY_MAX = 5;

export const EMPTY_DRAFT: Draft = {
  prompt: "",
  promptHistory: [],
  brandKit: {
    name: "",
    tagline: "",
    primaryColor: "#2563eb",
    accentColor: "#f59e0b",
    fontFamily: "system-ui, sans-serif",
  },
  pages: [],
  summary: [
    "Describe your brand to get started.",
    "We will build a preview and suggest domains.",
    "Use the tabs above to edit your site or pick a domain.",
  ],
  status: "idle",
};

export function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_DRAFT };
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      ...EMPTY_DRAFT,
      ...parsed,
      summary: normalizeSummary(parsed.summary),
    };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

function normalizeSummary(summary: unknown): SummaryLines {
  if (!Array.isArray(summary)) return EMPTY_DRAFT.summary;
  return [
    String(summary[0] ?? ""),
    String(summary[1] ?? ""),
    String(summary[2] ?? ""),
  ];
}

export function saveDraft(draft: Draft) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasSite(draft: Draft) {
  return draft.pages.length > 0;
}

export function mergeDraft(
  current: Draft,
  patch: Partial<Draft> & { brandKit?: BrandKit; pages?: PageDraft[] },
): Draft {
  return {
    ...current,
    ...patch,
    brandKit: patch.brandKit ?? current.brandKit,
    pages: patch.pages ?? current.pages,
    summary: patch.summary ?? current.summary,
    promptHistory: patch.promptHistory ?? current.promptHistory,
  };
}

export function appendPromptHistory(history: string[] | undefined, prompt: string): string[] {
  return [...(history ?? []), prompt].slice(-PROMPT_HISTORY_MAX);
}
