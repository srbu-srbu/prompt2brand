import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { BrandKit, PageDraft } from "../_lib/types";
import { hasNamecomConfig, registerDomainWithDns } from "../_lib/namecom";
import {
  createSiteId,
  hostedUrlForSite,
  savePublishedSite,
  updateSiteDomainStatus,
  updateSiteHosting,
} from "../_lib/sites";
import { createSiteDeployment, hasVercelDeployConfig } from "../_lib/vercelDeploy";

type PublishBody = {
  draft?: {
    pages?: PageDraft[];
    brandKit?: BrandKit;
  };
  domainFqdn?: string;
};

function appOrigin(req: VercelRequest): string {
  const host = (req.headers["x-forwarded-host"] ?? req.headers.host ?? "prompt2brand.vercel.app") as string;
  const protocol = (req.headers["x-forwarded-proto"] ?? "https") as string;
  return `${protocol}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (req.body ?? {}) as PublishBody;
  const pages = body.draft?.pages ?? [];
  const brandKit = body.draft?.brandKit;
  const domainFqdn = typeof body.domainFqdn === "string" ? body.domainFqdn.trim().toLowerCase() : "";

  if (!brandKit || pages.length === 0) {
    res.status(400).json({ error: "draft.brandKit and draft.pages are required" });
    return;
  }

  if (!domainFqdn) {
    res.status(400).json({ error: "domainFqdn is required" });
    return;
  }

  const siteId = createSiteId();
  const fallbackUrl = `${appOrigin(req)}/api/sites/${siteId}/home`;
  let hostedUrl = hostedUrlForSite(siteId);
  let hostingStatus: "pending" | "live" | "failed" = "pending";
  let vercelDeploymentId: string | null = null;
  let domainStatus: "pending" | "live" | "failed" = "pending";
  let domainSource: "namecom" | "mock" = "mock";

  try {
    await savePublishedSite({
      siteId,
      hostedUrl: fallbackUrl,
      domainFqdn,
      brandKit,
      pages,
      domainStatus,
      hostingStatus: "pending",
    });

    if (hasVercelDeployConfig()) {
      try {
        const deployment = await createSiteDeployment({ siteId, pages, brandKit });
        vercelDeploymentId = deployment.deploymentId;
        hostedUrl = deployment.hostedUrl;
        hostingStatus = "pending";
        await updateSiteHosting(siteId, {
          hostedUrl,
          hostingStatus,
          vercelDeploymentId,
        });
      } catch (error) {
        console.error("vercel deploy failed", error);
        hostingStatus = "failed";
        hostedUrl = fallbackUrl;
        await updateSiteHosting(siteId, {
          hostedUrl: fallbackUrl,
          hostingStatus: "failed",
          vercelDeploymentId: null,
        });
      }
    } else {
      hostingStatus = "live";
      hostedUrl = fallbackUrl;
      await updateSiteHosting(siteId, {
        hostedUrl: fallbackUrl,
        hostingStatus: "live",
        vercelDeploymentId: null,
      });
    }

    const dnsTargetUrl = hostingStatus === "failed" ? fallbackUrl : hostedUrl;

    if (hasNamecomConfig()) {
      try {
        await registerDomainWithDns({
          fqdn: domainFqdn,
          hostedUrl: dnsTargetUrl,
          idempotencyKey: siteId,
        });
        domainStatus = "live";
        domainSource = "namecom";
      } catch (error) {
        console.error("name.com register failed", error);
        domainStatus = "failed";
        domainSource = "namecom";
      }

      await updateSiteDomainStatus(siteId, domainStatus);
    }

    res.status(200).json({
      siteId,
      hostedUrl,
      fallbackUrl,
      domainFqdn,
      hostingStatus,
      domainStatus,
      domainSource,
      vercelDeploymentId,
    });
  } catch (error) {
    console.error("publish failed", error);
    const message = error instanceof Error ? error.message : "Publish failed";
    const status = message.includes("POSTGRES_URL") ? 503 : 500;
    res.status(status).json({ error: message });
  }
}
