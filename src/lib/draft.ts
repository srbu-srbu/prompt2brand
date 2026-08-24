import type { BrandKit, Draft, PageDraft } from "./types";

const STORAGE_KEY = "prompt2brand:draft";

export const EMPTY_DRAFT: Draft = {
  prompt: "",
  brandKit: {
    name: "",
    tagline: "",
    primaryColor: "#2563eb",
    accentColor: "#f59e0b",
    fontFamily: "system-ui, sans-serif",
  },
  pages: [],
  summary: ["Describe your brand to get started.", "We will build a preview and suggest domains."],
  status: "idle",
};

export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_DRAFT };
    return { ...EMPTY_DRAFT, ...JSON.parse(raw) } as Draft;
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function saveDraft(draft: Draft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
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
  };
}

export function detectClientIntent(prompt: string): "site" | "domain" {
  const lower = prompt.toLowerCase();
  const domainHints = ["domain", "name", ".com", "shorter", "playful", "prefix", "url"];
  return domainHints.some((hint) => lower.includes(hint)) ? "domain" : "site";
}
