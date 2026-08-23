import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const siteId = `p2b-${Date.now().toString(36)}`;
  const domainFqdn = typeof req.body?.domainFqdn === "string" ? req.body.domainFqdn : "example.com";

  res.status(200).json({
    siteId,
    hostedUrl: `https://${siteId}.vercel.app`,
    domainFqdn,
    hostingStatus: "pending",
    domainStatus: "pending",
  });
}
