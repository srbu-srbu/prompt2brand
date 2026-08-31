import type { VercelRequest, VercelResponse } from "@vercel/node";
import { suggestMoreDomains } from "../../_lib/domains";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const exclude = Array.isArray(req.body?.exclude)
    ? req.body.exclude.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : undefined;
  const brandName = typeof req.body?.brandName === "string" ? req.body.brandName.trim() : undefined;
  const tagline = typeof req.body?.tagline === "string" ? req.body.tagline.trim() : undefined;
  const pageTitles = Array.isArray(req.body?.pageTitles)
    ? req.body.pageTitles.filter((value: unknown): value is string => typeof value === "string")
    : undefined;

  const { domains, summary, source } = await suggestMoreDomains({
    exclude,
    prompt,
    brandName,
    tagline,
    pageTitles,
  });

  res.status(200).json({ domains, summary, source });
}
