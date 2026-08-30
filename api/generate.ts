import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateSite, mockFallback } from "./_lib/generateSite";
import { detectIntent } from "./_lib/mock";
import type { BrandKit, PageDraft } from "./_lib/types";

type GenerateRequestBody = {
  prompt?: string;
  draft?: {
    brandKit?: BrandKit;
    pages?: PageDraft[];
    promptHistory?: string[];
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (req.body ?? {}) as GenerateRequestBody;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const intent = detectIntent(prompt);
  if (intent === "domain") {
    res.status(400).json({
      error: "Domain prompts should use /api/domains/suggest",
      intent: "domain",
    });
    return;
  }

  try {
    const generated = await generateSite({
      prompt,
      draft: body.draft,
    });

    res.status(200).json({
      intent: "site",
      brandKit: generated.brandKit,
      pages: generated.pages,
      summary: generated.summary,
      source: generated.source,
      ...(generated.error ? { error: generated.error } : {}),
    });
  } catch (error) {
    console.error("generate handler failed", error);
    const message = error instanceof Error ? error.message : "generate handler failed";
    const generated = mockFallback({ prompt, draft: body.draft }, message);
    res.status(200).json({
      intent: "site",
      brandKit: generated.brandKit,
      pages: generated.pages,
      summary: generated.summary,
      source: generated.source,
      error: generated.error,
    });
  }
}
