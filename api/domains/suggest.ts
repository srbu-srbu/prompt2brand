import type { VercelRequest, VercelResponse } from "@vercel/node";
import { suggestDomainsFromPrompt } from "../_lib/domains";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const brandName =
    typeof req.body?.brandName === "string" ? req.body.brandName.trim() : undefined;
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const { domains, summary, source } = await suggestDomainsFromPrompt(prompt, { brandName });

  res.status(200).json({
    intent: "domain",
    domains,
    summary,
    source,
  });
}
