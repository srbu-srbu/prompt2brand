import { generateObject } from "ai";
import { z } from "zod";
import type { BrandKit, PageDraft } from "./types";
import {
  MOCK_BRAND,
  MOCK_PAGES,
  mockSiteFromPrompt,
} from "./mock";

const MODEL_ID = "google/gemini-2.5-flash-lite";

const brandKitSchema = z.object({
  name: z.string().min(1).max(80),
  tagline: z.string().min(1).max(160),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: z.string().min(1).max(120),
});

const pageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
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

function buildSystemPrompt(hasExistingSite: boolean): string {
  const mode = hasExistingSite
    ? "Update the existing brand site draft based on the user's latest prompt. Preserve slugs unless the user asks to add or remove pages."
    : "Create a new brand website draft from the user's prompt.";

  return `${mode}

You generate content for prompt2brand, a prompt-to-brand website builder.

Rules:
- Return JSON matching the schema only.
- brandKit: concise brand name, tagline, two hex colors, a web-safe font stack.
- pages: 1 to 5 self-contained HTML page bodies (NOT full documents). Always include slug "home".
- bodyHtml: semantic HTML only (<header>, <main>, <section>, <h1>-<h3>, <p>, <a role="button">). No <html>, <head>, <body>, <script>, or external CSS.
- Keep copy specific to the user's business idea; avoid generic lorem ipsum.
- summary: exactly two short factual lines (not chatty). Line 2 may reference the latest cue briefly.
- Slugs: lowercase letters, numbers, hyphens only.`;
}

function buildUserPrompt(input: GenerateSiteInput, hasExistingSite: boolean): string {
  if (!hasExistingSite) {
    return `User prompt:\n${input.prompt}`;
  }

  return `User prompt:\n${input.prompt}

Current draft JSON:
${JSON.stringify(
  {
    brandKit: input.draft?.brandKit,
    pages: input.draft?.pages,
  },
  null,
  2,
)}`;
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

  if (!hasGatewayAuth()) {
    return mockFallback(input.prompt, hasExistingSite);
  }

  try {
    const { object } = await generateObject({
      model: MODEL_ID,
      schema: generateSiteSchema,
      system: buildSystemPrompt(hasExistingSite),
      prompt: buildUserPrompt(input, hasExistingSite),
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
    console.error("generateSite failed", error);
    return mockFallback(input.prompt, hasExistingSite);
  }
}
