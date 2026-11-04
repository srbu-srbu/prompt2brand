import { z } from "zod";
import type { BrandKit, PageDraft } from "./types";
import {
  chatCompletion,
  getMetaReasoningEffort,
  hasModelApiConfig,
  parseModelJson,
} from "./metaModelApi";

const PROMPT_HISTORY_MAX = 5;
const PAGE_BODY_MAX = 24000;
const PAGE_CONTEXT_MAX = 8000;

const hexColorSchema = z.string().transform((val) => {
  const trimmed = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return "#2563eb";
});

const brandKitSchema = z.object({
  name: z.string().min(1).max(80),
  tagline: z.string().min(1).max(200),
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  fontFamily: z.string().min(1).max(120),
});

const pageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(40)
    .transform((val) =>
      val
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "home",
    ),
  title: z.string().min(1).max(80),
  bodyHtml: z.string().min(1).max(PAGE_BODY_MAX),
});

const generateSiteSchema = z.object({
  brandKit: brandKitSchema,
  pages: z.array(pageSchema).min(1).max(5),
  summary: z.object({
    line1: z.string().max(120),
    line2: z.string().max(120),
    line3: z.string().max(120),
  }),
});

const generateSiteJsonSchema = {
  type: "object",
  properties: {
    brandKit: {
      type: "object",
      properties: {
        name: { type: "string" },
        tagline: { type: "string" },
        primaryColor: { type: "string" },
        accentColor: { type: "string" },
        fontFamily: { type: "string" },
      },
      required: ["name", "tagline", "primaryColor", "accentColor", "fontFamily"],
      additionalProperties: false,
    },
    pages: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          slug: { type: "string" },
          title: { type: "string" },
          bodyHtml: { type: "string" },
        },
        required: ["slug", "title", "bodyHtml"],
        additionalProperties: false,
      },
    },
    summary: {
      type: "object",
      properties: {
        line1: { type: "string" },
        line2: { type: "string" },
        line3: { type: "string" },
      },
      required: ["line1", "line2", "line3"],
      additionalProperties: false,
    },
  },
  required: ["brandKit", "pages", "summary"],
  additionalProperties: false,
} as const;

export type GenerateSiteInput = {
  prompt: string;
  draft?: {
    brandKit?: BrandKit;
    pages?: PageDraft[];
    promptHistory?: string[];
  };
};

export type GenerateSiteResult = {
  brandKit: BrandKit;
  pages: PageDraft[];
  summary: [string, string, string];
  source: "llm" | "mock";
  error?: string;
};

function recentPromptsForLlm(input: GenerateSiteInput): string[] {
  return [...(input.draft?.promptHistory ?? []), input.prompt].slice(-PROMPT_HISTORY_MAX);
}

function draftContextForLlm(draft: GenerateSiteInput["draft"]) {
  if (!draft?.pages?.length) return undefined;

  return {
    brandKit: draft.brandKit,
    pages: draft.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      bodyHtml: page.bodyHtml.slice(0, PAGE_CONTEXT_MAX),
    })),
  };
}

function buildSystemPrompt(): string {
  return `You generate content for prompt2brand, a prompt-to-brand website builder.

Infer the user's intent from their recent prompts and any existing draft:
- Create a new site when the draft is empty or they describe a new business from scratch.
- Update the current site when they ask to tweak copy, layout, colors, or sections.
- Replace the site when they explicitly ask for a new brand, rebrand, or a different business.

When updating, start from the current draft HTML/CSS and change only what the prompts request.
When replacing, ignore the previous brand unless they ask to keep something.

Rules:
- Return JSON matching the schema only.
- brandKit: brand name, tagline, two hex colors (#RRGGBB), a web-safe font stack.
- pages: 1 to 5 HTML page bodies (NOT full documents). Always include slug "home".
- bodyHtml: a polished, self-styled HTML fragment for one page. Put a <style> block first with layout, typography, and color CSS. Scope styles to your fragment (use class selectors); do not style html, body, or unscoped header/nav/main elements that could leak if mis-rendered. Use semantic HTML (header, nav, main, section, footer, article). Inline style attributes are fine.
- No <html>, <head>, <body>, <script>, external stylesheets, or CDN links.
- Match the user's business and latest prompt. Never revert to unrelated sample brands unless the user asked for that business.
- summary: exactly three short factual lines (line1, line2, line3). Line3 may reference the latest cue briefly.
- Slugs: lowercase letters, numbers, hyphens only.
- Multi-page nav: when separate pages exist, link between them with paths like /about or /contact — not #about hash links on a single page.`;
}

function buildUserPrompt(input: GenerateSiteInput): string {
  const recentPrompts = recentPromptsForLlm(input);
  const draft = draftContextForLlm(input.draft);

  const payload: {
    recentPrompts: string[];
    currentPrompt: string;
    draft?: ReturnType<typeof draftContextForLlm>;
  } = {
    recentPrompts,
    currentPrompt: input.prompt,
  };

  if (draft) {
    payload.draft = draft;
  }

  return JSON.stringify(payload, null, 2);
}

export function mockFallback(input: GenerateSiteInput, error?: string): GenerateSiteResult {
  const hasExistingSite = Boolean(input.draft?.pages?.length);

  if (hasExistingSite && input.draft?.brandKit && input.draft.pages?.length) {
    return {
      brandKit: input.draft.brandKit,
      pages: input.draft.pages,
      summary: [
        "AI unavailable — kept your current preview.",
        `Latest cue: ${input.prompt.slice(0, 60)}`,
        error ? error.slice(0, 120) : "Try again in a moment if the Meta Model API was rate-limited.",
      ],
      source: "mock",
      error,
    };
  }

  return {
    brandKit: input.draft?.brandKit ?? {
      name: "",
      tagline: "",
      primaryColor: "#2563eb",
      accentColor: "#f59e0b",
      fontFamily: "system-ui, sans-serif",
    },
    pages: [],
    summary: [
      "AI unavailable — no preview generated.",
      `Latest cue: ${input.prompt.slice(0, 60)}`,
      error ? error.slice(0, 120) : "Try again in a moment if the Meta Model API was rate-limited.",
    ],
    source: "mock",
    error,
  };
}

function placeholderHomeHtml(brandKit: BrandKit): string {
  return `<style>.p2b{padding:2rem;font-family:system-ui,sans-serif;color:#18181b}.p2b h1{color:${brandKit.primaryColor}}</style><main class="p2b"><h1>${brandKit.name}</h1><p>${brandKit.tagline}</p></main>`;
}

function ensureHomePage(pages: PageDraft[], brandKit: BrandKit): PageDraft[] {
  if (pages.some((page) => page.slug === "home")) return pages;

  return [
    {
      slug: "home",
      title: "Home",
      bodyHtml: placeholderHomeHtml(brandKit),
    },
    ...pages,
  ];
}

function siteGenerationChatOptions() {
  return {
    reasoningEffort: getMetaReasoningEffort(),
    maxCompletionTokens: 16384,
    // Non-streaming: Meta returns misleading model_not_found on long streamed site-gen payloads (Spark + Wonder).
    stream: false,
  };
}

async function callMetaModel(input: GenerateSiteInput) {
  const schemaHint = JSON.stringify(generateSiteJsonSchema, null, 2);
  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `${buildSystemPrompt()}\n\nRespond with JSON only (no markdown fences) matching this schema:\n${schemaHint}`,
      },
      { role: "user", content: buildUserPrompt(input) },
    ],
    siteGenerationChatOptions(),
  );

  return generateSiteSchema.parse(parseModelJson(content));
}

export async function generateSite(input: GenerateSiteInput): Promise<GenerateSiteResult> {
  if (!hasModelApiConfig()) {
    console.warn("generateSite: MODEL_API_KEY not configured, using mock");
    return mockFallback(input);
  }

  try {
    const object = await callMetaModel(input);

    return {
      brandKit: object.brandKit,
      pages: ensureHomePage(object.pages, object.brandKit),
      summary: [object.summary.line1, object.summary.line2, object.summary.line3],
      source: "llm",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "generateSite failed";
    console.error("generateSite failed, preserving draft when possible", error);
    return mockFallback(input, message);
  }
}
