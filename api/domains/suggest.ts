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
  const tagline = typeof req.body?.tagline === "string" ? req.body.tagline.trim() : undefined;
  const pageTitles = Array.isArray(req.body?.pageTitles)
    ? req.body.pageTitles.filter((value: unknown): value is string => typeof value === "string")
    : undefined;
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const { domains, summary, source, brainstormSource } = await suggestDomainsFromPrompt(prompt, {
    brandName,
    tagline,
    pageTitles,
  });

  res.status(200).json({
    intent: "domain",
    domains,
    summary,
    source,
    brainstormSource,
  });
}
