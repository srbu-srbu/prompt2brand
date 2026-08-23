import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  buildSummary,
  detectIntent,
  mockSiteFromPrompt,
  MOCK_BRAND,
  MOCK_PAGES,
} from "./_lib/mock";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const hasExistingSite = Boolean(req.body?.draft?.pages?.length);
  const intent = detectIntent(prompt);

  if (intent === "domain") {
    res.status(400).json({
      error: "Domain prompts should use /api/domains/suggest",
      intent: "domain",
    });
    return;
  }

  const generated = hasExistingSite ? mockSiteFromPrompt(prompt) : { brandKit: MOCK_BRAND, pages: MOCK_PAGES };
  const summary = buildSummary("site", prompt);

  res.status(200).json({
    intent: "site",
    brandKit: generated.brandKit,
    pages: generated.pages,
    summary,
  });
}
