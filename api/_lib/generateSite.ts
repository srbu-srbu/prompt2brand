import { generateObject } from "ai";
import { z } from "zod";
import type { BrandKit, PageDraft } from "./types";
import {
  MOCK_BRAND,
  MOCK_PAGES,
  mockSiteFromPrompt,
} from "./mock";
import { shouldReplaceBrand } from "../../shared/brandPrompt";

const MODEL_ID = "google/gemini-2.5-flash-lite";

const hexColorSchema = z.string().transform((val) => {
  const trimmed = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return "#2563eb";
});

const brandKitSchema = z.object({
  name: z.string().min(1).max(80),
  tagline: z.string().min(1).max(160),
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
  bodyHtml: z.string().min(1).max(12000),
});

const generateSiteSchema = z.object({
  brandKit: brandKitSchema,
  pages: z.array(pageSchema).min(1).max(5),
  summary: z.tuple([z.string().max(80), z.string().max(80)]),
});

export type GenerateSiteInput = {
  prompt: string;
  draft?: {
    brandKit?: BrandKit;
    pages?: PageDraft[];
  };
};

export type GenerateSiteResult = {
  brandKit: BrandKit;
  pages: PageDraft[];
  summary: [string, string];
  source: "llm" | "mock";
};

function hasGatewayAuth(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN);
}

function summarizeDraftForLlm(draft?: GenerateSiteInput["draft"]) {
  if (!draft?.pages?.length) return undefined;
  return {
    brandKit: draft.brandKit,
    pages: draft.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      bodyPreview: page.bodyHtml.replace(/\s+/g, " ").slice(0, 400),
    })),
  };
}

function buildSystemPrompt(mode: "create" | "update" | "replace"): string {
  const modeLine =
    mode === "create"
      ? "Create a new brand website draft from the user's prompt."
      : mode === "replace"
        ? "The user wants a NEW brand/site. Replace the draft entirely with content for the business described in their prompt. Do not keep the previous brand name, copy, or theme unless the user explicitly asks to."
        : "Update the existing brand site draft based on the user's latest prompt. Preserve slugs unless the user asks to add or remove pages.";

  return `${modeLine}

You generate content for prompt2brand, a prompt-to-brand website builder.

Rules:
- Return JSON matching the schema only.
- brandKit: concise brand name, tagline, two hex colors (#RRGGBB), a web-safe font stack.
- pages: 1 to 5 self-contained HTML page bodies (NOT full documents). Always include slug "home".
- bodyHtml: semantic HTML only (<header>, <main>, <section>, <h1>-<h3>, <p>, <a role="button">). No <html>, <head>, <body>, <script>, or external CSS.
- Keep copy specific to the user's business idea; avoid generic lorem ipsum and unrelated sample brands.
- summary: exactly two short factual lines (not chatty). Line 2 may reference the latest cue briefly.
- Slugs: lowercase letters, numbers, hyphens only.`;
}

function buildUserPrompt(
  input: GenerateSiteInput,
  mode: "create" | "update" | "replace",
): string {
  if (mode === "create") {
    return `User prompt:\n${input.prompt}`;
  }

  const summary = summarizeDraftForLlm(input.draft);
  return `User prompt:\n${input.prompt}

Current draft summary (for context only${mode === "replace" ? " — replace this brand entirely" : ""}):
${JSON.stringify(summary, null, 2)}`;
}

function mockFallback(prompt: string, hasExistingSite: boolean): GenerateSiteResult {
  const generated = hasExistingSite
    ? mockSiteFromPrompt(prompt)
    : { brandKit: MOCK_BRAND, pages: MOCK_PAGES };

  return {
    brandKit: generated.brandKit,
    pages: generated.pages,
    summary: [
      hasExistingSite ? "Updated site from your prompt." : "Built your brand preview.",
      `Latest cue: ${prompt.slice(0, 60)}`,
    ],
    source: "mock",
  };
}

export async function generateSite(input: GenerateSiteInput): Promise<GenerateSiteResult> {
  const hasExistingSite = Boolean(input.draft?.pages?.length);
  const replaceBrand = hasExistingSite && shouldReplaceBrand(input.prompt);
  const mode: "create" | "update" | "replace" = !hasExistingSite
    ? "create"
    : replaceBrand
      ? "replace"
      : "update";

  if (!hasGatewayAuth()) {
    console.warn("generateSite: no AI gateway auth, using mock");
    return mockFallback(input.prompt, hasExistingSite);
  }

  try {
    const { object } = await generateObject({
      model: MODEL_ID,
      schema: generateSiteSchema,
      system: buildSystemPrompt(mode),
      prompt: buildUserPrompt(input, mode),
      temperature: 0.7,
    });

    const pages = object.pages.some((page) => page.slug === "home")
      ? object.pages
      : [
          {
            slug: "home",
            title: "Home",
            bodyHtml: `<header><h1>${object.brandKit.name}</h1><p>${object.brandKit.tagline}</p></header><main><section><h2>Welcome</h2><p>${object.brandKit.tagline}</p></section></main>`,
          },
          ...object.pages,
        ];

    return {
      brandKit: object.brandKit,
      pages,
      summary: object.summary,
      source: "llm",
    };
  } catch (error) {
    console.error("generateSite failed, using mock fallback", error);
    return mockFallback(input.prompt, hasExistingSite);
  }
}
