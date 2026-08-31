import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSiteById, updateSiteHosting } from "../../_lib/sites";
import { resolveHostingStatus } from "../../_lib/vercelDeploy";

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

    const resolved = await resolveHostingStatus({
      siteId: site.site_id,
      hostedUrl: site.hosted_url,
      vercelDeploymentId: site.vercel_deployment_id,
      currentStatus: site.hosting_status,
    });

    if (
      resolved.hostingStatus !== site.hosting_status ||
      resolved.hostedUrl !== site.hosted_url
    ) {
      await updateSiteHosting(site.site_id, {
        hostedUrl: resolved.hostedUrl,
        hostingStatus: resolved.hostingStatus,
        vercelDeploymentId: site.vercel_deployment_id,
      });
    }

    res.status(200).json({
      siteId: site.site_id,
      hosting: resolved.hostingStatus,
      domain: site.domain_status ?? "pending",
      hostedUrl: resolved.hostedUrl,
      domainFqdn: site.domain_fqdn,
    });
  } catch (error) {
    console.error("status failed", error);
    const message = error instanceof Error ? error.message : "Status failed";
    const status = message.includes("POSTGRES_URL") ? 503 : 500;
    res.status(status).json({ error: message });
  }
}
