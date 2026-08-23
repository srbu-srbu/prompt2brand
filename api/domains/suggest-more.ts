import type { VercelRequest, VercelResponse } from "@vercel/node";
import { EXTRA_DOMAINS } from "./suggest-more-data";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const exclude = Array.isArray(req.body?.exclude) ? req.body.exclude : [];

  res.status(200).json({
    domains: EXTRA_DOMAINS.filter((d) => !exclude.includes(d.fqdn)),
  });
}
