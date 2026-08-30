import { z } from "zod";

const MODEL_ID = "google/gemini-2.5-flash-lite";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

const domainKeywordsSchema = z.object({
  keywords: z.array(z.string().min(2).max(40)).min(2).max(6),
  summary: z.object({
    line1: z.string().max(120),
    line2: z.string().max(120),
  }),
});

export type DomainBrainstormInput = {
  prompt: string;
  brandName?: string;
};

export type DomainBrainstormResult = {
  keywords: string[];
  summary: [string, string];
  source: "llm" | "mock";
};

function gatewayAuthToken(): string | undefined {
  return process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
}

function hasGatewayAuth(): boolean {
  return Boolean(gatewayAuthToken());
}

function sanitizeKeyword(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

function fallbackKeywords(input: DomainBrainstormInput): string[] {
  const fromBrand = input.brandName ? sanitizeKeyword(input.brandName) : "";
  const fromPrompt = sanitizeKeyword(input.prompt.replace(/\s+/g, ""));
  const keywords = [fromBrand, fromPrompt].filter((word) => word.length >= 3);
  return [...new Set(keywords)].slice(0, 4);
}

type GatewayChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(jsonText);
}

export async function brainstormDomainKeywords(
  input: DomainBrainstormInput,
): Promise<DomainBrainstormResult> {
  const fallback = fallbackKeywords(input);
  const fallbackSummary: [string, string] = [
    fallback.length > 0 ? "Searching name.com for available domains." : "No domain suggestions available.",
    `Keywords: ${input.prompt.slice(0, 60)}`,
  ];

  if (!hasGatewayAuth()) {
    return { keywords: fallback, summary: fallbackSummary, source: "mock" };
  }

  const token = gatewayAuthToken();
  if (!token) {
    return { keywords: fallback, summary: fallbackSummary, source: "mock" };
  }

  const schemaHint = JSON.stringify(
    {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" },
        },
        summary: {
          type: "object",
          properties: { line1: { type: "string" }, line2: { type: "string" } },
          required: ["line1", "line2"],
        },
      },
      required: ["keywords", "summary"],
    },
    null,
    2,
  );

  const userPayload = {
    brandName: input.brandName ?? null,
    prompt: input.prompt,
  };

  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        temperature: 0.7,
        stream: false,
        messages: [
          {
            role: "system",
            content: `You brainstorm domain name search keywords for prompt2brand.

Given a brand context and the user's prompt, return JSON only with:
- keywords: 2-6 lowercase alphanumeric search stems (no dots, no TLDs). Mix literal brand stems, shortened variants, playful spellings, and niche descriptors the user asked for.
- summary: two short lines describing what you searched for.

Examples: "voltworks", "voltwrks", "brightvolt", "getvolt" — not "voltworks.com".`,
          },
          {
            role: "user",
            content: `${JSON.stringify(userPayload, null, 2)}\n\nRespond with JSON matching:\n${schemaHint}`,
          },
        ],
      }),
    });

    const data = (await response.json()) as GatewayChatResponse;
    if (!response.ok) {
      throw new Error(data.error?.message ?? `Gateway request failed (${response.status})`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Gateway returned empty content");
    }

    const parsed = domainKeywordsSchema.parse(parseModelJson(content));
    const keywords = parsed.keywords
      .map(sanitizeKeyword)
      .filter((word) => word.length >= 3);

    if (keywords.length === 0) {
      return { keywords: fallback, summary: fallbackSummary, source: "mock" };
    }

    return {
      keywords: [...new Set(keywords)].slice(0, 6),
      summary: [parsed.summary.line1, parsed.summary.line2],
      source: "llm",
    };
  } catch (error) {
    console.error("domain brainstorm failed", error);
    return { keywords: fallback, summary: fallbackSummary, source: "mock" };
  }
}
