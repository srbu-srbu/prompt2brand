import { z } from "zod";
import {
  extractStemsFromContext,
  mergePreferredTlds,
  normalizeStems,
} from "./domainPromptParse";
import {
  chatCompletion,
  getMetaReasoningEffort,
  hasModelApiConfig,
  parseModelJson,
} from "./metaModelApi";

export const DEFAULT_PREFERRED_TLDS = ["com", "org", "net"] as const;
export const MORE_PREFERRED_TLDS = ["xyz", "app", "dev"] as const;

const domainBrainstormSchema = z.object({
  stems: z.array(z.string().min(2).max(40)).min(1).max(6),
  preferredTlds: z.array(z.string().min(2).max(20)).min(1).max(5),
  summary: z.object({
    line1: z.string().max(120),
    line2: z.string().max(120),
    line3: z.string().max(120),
  }),
});

export type DomainBrainstormMode = "initial" | "more";

export type DomainBrainstormInput = {
  prompt: string;
  brandName?: string;
  tagline?: string;
  pageTitles?: string[];
  mode?: DomainBrainstormMode;
  excludeFqdns?: string[];
};

export type DomainBrainstormResult = {
  stems: string[];
  preferredTlds: string[];
  summary: [string, string, string];
  source: "llm" | "mock";
};

export function sanitizeStem(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

export function sanitizeTlds(raw: string[]): string[] {
  return mergePreferredTlds(raw, "", [...DEFAULT_PREFERRED_TLDS]);
}

function fallbackTlds(mode: DomainBrainstormMode, prompt: string): string[] {
  const fromPrompt = mergePreferredTlds([], prompt, []);
  if (fromPrompt.length > 0) return fromPrompt;
  return mode === "more" ? [...MORE_PREFERRED_TLDS] : [...DEFAULT_PREFERRED_TLDS];
}

function moreFallbackStems(input: DomainBrainstormInput): string[] {
  const excludedStems = new Set(
    (input.excludeFqdns ?? [])
      .map((fqdn) => sanitizeStem(fqdn.split(".")[0] ?? ""))
      .filter((stem) => stem.length >= 3),
  );

  const base = extractStemsFromContext(input).filter((stem) => !excludedStems.has(stem));
  if (base.length >= 1) return base.slice(0, 4);

  const suffixes = ["hq", "go", "site", "hub"];
  const seed = excludedStems.values().next().value ?? "brand";
  const alternates = suffixes
    .map((suffix) => sanitizeStem(`${seed}${suffix}`))
    .filter((stem) => stem.length >= 3 && !excludedStems.has(stem));

  return [...new Set(alternates])].slice(0, 4);
}

function buildFallbackResult(input: DomainBrainstormInput): DomainBrainstormResult {
  const mode = input.mode ?? "initial";
  const stems = mode === "more" ? moreFallbackStems(input) : extractStemsFromContext(input);
  const preferredTlds = fallbackTlds(mode, input.prompt);
  const fallbackSummary: [string, string, string] =
    stems.length > 0
      ? [
          mode === "more"
            ? "Searching name.com for more available domains."
            : "Searching name.com for available domains.",
          `Keywords: ${input.prompt.slice(0, 60)}`,
          `TLDs: ${preferredTlds.map((tld) => `.${tld}`).join(", ")}`,
        ]
      : ["No domain suggestions available.", `Keywords: ${input.prompt.slice(0, 60)}`, "Try a different prompt."];

  return { stems, preferredTlds, summary: fallbackSummary, source: "mock" };
}

function systemPrompt(mode: DomainBrainstormMode): string {
  if (mode === "more") {
    return `You brainstorm additional domain search keywords for prompt2brand.

The user already saw some domain suggestions and wants MORE options. Return JSON only with:
- stems: 1-4 NEW lowercase alphanumeric search stems (no dots, no TLDs). NEVER return the user's instruction sentence as a stem. Use brand names and short variants only — e.g. "miliojen", "milio", "getmilio".
- preferredTlds: 2-4 TLD extensions WITHOUT dots (e.g. "app", "dev", "xyz", "com"). Honor explicit TLD requests in the prompt.
- summary: three short lines describing the new search (mention TLDs on line 3).

If the prompt asks for specific extensions (example: "provide .dev and .xyz for miliojen"), stems should be ["miliojen"] and preferredTlds should include ["dev", "xyz"].`;
  }

  return `You brainstorm domain name search keywords for prompt2brand.

Given brand context and the user's prompt, return JSON only with:
- stems: 1-6 lowercase alphanumeric search stems (no dots, no TLDs). NEVER return the full instruction sentence as a stem. Use brand names and short variants only.
- preferredTlds: 2-4 TLD extensions WITHOUT dots (e.g. "com", "org", "net", "dev", "xyz", "app"). Choose TLDs that fit the business and honor explicit TLD requests in the prompt.
- summary: three short lines describing what you searched for (mention chosen TLDs on line 3).

Refinement example: prompt "Please provide .dev and .xyz extensions for miliojen" -> stems ["miliojen"], preferredTlds ["dev", "xyz"].`;
}

export async function brainstormDomainKeywords(
  input: DomainBrainstormInput,
): Promise<DomainBrainstormResult> {
  const mode = input.mode ?? "initial";
  const fallback = buildFallbackResult({ ...input, mode });

  if (!hasModelApiConfig()) {
    return fallback;
  }

  const schemaHint = JSON.stringify(
    {
      type: "object",
      properties: {
        stems: {
          type: "array",
          minItems: 1,
          maxItems: mode === "more" ? 4 : 6,
          items: { type: "string" },
        },
        preferredTlds: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: { type: "string" },
        },
        summary: {
          type: "object",
          properties: {
            line1: { type: "string" },
            line2: { type: "string" },
            line3: { type: "string" },
          },
          required: ["line1", "line2", "line3"],
        },
      },
      required: ["stems", "preferredTlds", "summary"],
    },
    null,
    2,
  );

  const userPayload = {
    brandName: input.brandName ?? null,
    tagline: input.tagline ?? null,
    pageTitles: input.pageTitles ?? [],
    prompt: input.prompt,
    excludeFqdns: input.excludeFqdns ?? [],
    mode,
  };

  try {
    const content = await chatCompletion(
      [
        { role: "system", content: systemPrompt(mode) },
        {
          role: "user",
          content: `${JSON.stringify(userPayload, null, 2)}\n\nRespond with JSON matching:\n${schemaHint}`,
        },
      ],
      { reasoningEffort: getMetaReasoningEffort(), maxCompletionTokens: 2048 },
    );

    const parsed = domainBrainstormSchema.parse(parseModelJson(content));
    const stems = normalizeStems(parsed.stems);
    const preferredTlds = mergePreferredTlds(
      parsed.preferredTlds,
      input.prompt,
      fallbackTlds(mode, input.prompt),
    );

    if (stems.length === 0) {
      return fallback;
    }

    return {
      stems: [...new Set(stems)].slice(0, mode === "more" ? 4 : 6),
      preferredTlds,
      summary: [parsed.summary.line1, parsed.summary.line2, parsed.summary.line3],
      source: "llm",
    };
  } catch (error) {
    console.error("domain brainstorm failed", error);
    return fallback;
  }
}
