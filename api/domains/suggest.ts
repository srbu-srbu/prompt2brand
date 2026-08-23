import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildSummary, MOCK_DOMAINS } from "./_lib/mock";

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

  const summary = buildSummary("domain", prompt);

  res.status(200).json({
    intent: "domain",
    domains: [...MOCK_DOMAINS],
    summary,
  });
}
