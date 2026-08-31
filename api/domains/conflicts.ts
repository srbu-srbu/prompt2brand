import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBrandConflicts } from "../_lib/serpapi";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const fqdn = typeof req.query.fqdn === "string" ? req.query.fqdn.trim().toLowerCase() : "";
  const brandName = typeof req.query.brandName === "string" ? req.query.brandName.trim() : undefined;

  if (!fqdn) {
    res.status(400).json({ error: "fqdn is required" });
    return;
  }

  try {
    const result = await getBrandConflicts(fqdn, brandName);
    res.status(200).json(result);
  } catch (error) {
    console.error("domain conflicts failed", error);
    const message = error instanceof Error ? error.message : "Conflict check failed";
    res.status(500).json({ error: message });
  }
}
