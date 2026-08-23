import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { BrandKit, PageDraft } from "../../shared/types";
import {
  createSiteId,
  hostedUrlForSite,
  savePublishedSite,
} from "../_lib/sites";

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
  const domainFqdn = typeof body.domainFqdn === "string" ? body.domainFqdn.trim() : "";

  if (!brandKit || pages.length === 0) {
    res.status(400).json({ error: "draft.brandKit and draft.pages are required" });
    return;
  }

  if (!domainFqdn) {
    res.status(400).json({ error: "domainFqdn is required" });
    return;
  }

  const siteId = createSiteId();
  const deployTargetUrl = hostedUrlForSite(siteId);
  const fallbackUrl = `${appOrigin(req)}/api/sites/${siteId}/home`;

  try {
    await savePublishedSite({
      siteId,
      hostedUrl: fallbackUrl,
      domainFqdn,
      brandKit,
      pages,
    });

    res.status(200).json({
      siteId,
      hostedUrl: fallbackUrl,
      deployTargetUrl,
      domainFqdn,
      hostingStatus: "live",
      domainStatus: "pending",
    });
  } catch (error) {
    console.error("publish failed", error);
    const message = error instanceof Error ? error.message : "Publish failed";
    const status = message.includes("POSTGRES_URL") ? 503 : 500;
    res.status(status).json({ error: message });
  }
}
