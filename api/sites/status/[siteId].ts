import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSiteById } from "../_lib/sites";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : "";

  if (!siteId) {
    res.status(400).json({ error: "siteId is required" });
    return;
  }

  try {
    const site = await getSiteById(siteId);

    if (!site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }

    res.status(200).json({
      siteId: site.site_id,
      hosting: site.hosting_status,
      domain: site.domain_status ?? "pending",
      hostedUrl: site.hosted_url,
      domainFqdn: site.domain_fqdn,
    });
  } catch (error) {
    console.error("status failed", error);
    const message = error instanceof Error ? error.message : "Status failed";
    const status = message.includes("POSTGRES_URL") ? 503 : 500;
    res.status(status).json({ error: message });
  }
}
