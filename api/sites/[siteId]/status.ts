import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : "";

  if (!siteId) {
    res.status(400).json({ error: "siteId is required" });
    return;
  }

  const tick = Number(req.query.tick ?? "0");
  const live = tick >= 2;

  res.status(200).json({
    siteId,
    hosting: live ? "live" : "pending",
    domain: live ? "live" : "pending",
    hostedUrl: `https://${siteId}.vercel.app`,
    domainFqdn: `${siteId.replace("p2b-", "")}.com`,
  });
}
