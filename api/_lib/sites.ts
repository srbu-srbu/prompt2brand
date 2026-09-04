import type { BrandKit, PageDraft } from "./types";
import { getSql } from "./db";
import { preparePublishedHtml } from "../../shared/internalLinks";
import { wrapPage } from "./wrapPage";

export type SiteRow = {
  site_id: string;
  hosted_url: string;
  vercel_deployment_id: string | null;
  domain_fqdn: string | null;
  hosting_status: "pending" | "live" | "failed";
  domain_status: "pending" | "live" | "failed" | null;
  created_at: Date;
};

export function createSiteId(): string {
  return `p2b-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function hostedUrlForSite(siteId: string): string {
  return `https://${siteId}.vercel.app`;
}

export async function savePublishedSite(input: {
  siteId: string;
  hostedUrl: string;
  domainFqdn: string;
  brandKit: BrandKit;
  pages: PageDraft[];
  domainStatus?: "pending" | "live" | "failed";
  hostingStatus?: "pending" | "live" | "failed";
  vercelDeploymentId?: string | null;
}): Promise<void> {
  const sql = getSql();
  const domainStatus = input.domainStatus ?? "pending";
  const hostingStatus = input.hostingStatus ?? "pending";

  await sql`
    INSERT INTO sites (site_id, hosted_url, domain_fqdn, hosting_status, domain_status, vercel_deployment_id)
    VALUES (
      ${input.siteId},
      ${input.hostedUrl},
      ${input.domainFqdn},
      ${hostingStatus},
      ${domainStatus},
      ${input.vercelDeploymentId ?? null}
    )
  `;

  for (const page of input.pages) {
    const pageMeta = input.pages.map((entry) => ({ slug: entry.slug, title: entry.title }));
    const bodyHtml = preparePublishedHtml(page.bodyHtml, pageMeta);
    const html = wrapPage(page.title, bodyHtml, input.brandKit);
    await sql`
      INSERT INTO site_pages (site_id, slug, title, html)
      VALUES (${input.siteId}, ${page.slug}, ${page.title}, ${html})
    `;
  }
}

export async function updateSiteDomainStatus(
  siteId: string,
  domainStatus: "pending" | "live" | "failed",
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE sites
    SET domain_status = ${domainStatus}
    WHERE site_id = ${siteId}
  `;
}

export async function updateSiteHosting(
  siteId: string,
  input: {
    hostedUrl: string;
    hostingStatus: "pending" | "live" | "failed";
    vercelDeploymentId?: string | null;
  },
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE sites
    SET
      hosted_url = ${input.hostedUrl},
      hosting_status = ${input.hostingStatus},
      vercel_deployment_id = ${input.vercelDeploymentId ?? null}
    WHERE site_id = ${siteId}
  `;
}

export async function getSiteById(siteId: string): Promise<SiteRow | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      site_id,
      hosted_url,
      vercel_deployment_id,
      domain_fqdn,
      hosting_status,
      domain_status,
      created_at
    FROM sites
    WHERE site_id = ${siteId}
    LIMIT 1
  `;

  const row = rows[0] as SiteRow | undefined;
  return row ?? null;
}

export async function getSitePageMeta(siteId: string): Promise<{ slug: string; title: string }[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT slug, title
    FROM site_pages
    WHERE site_id = ${siteId}
    ORDER BY slug
  `;
  return rows as { slug: string; title: string }[];
}

export async function getPageHtml(siteId: string, slug: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT html
    FROM site_pages
    WHERE site_id = ${siteId} AND slug = ${slug}
    LIMIT 1
  `;
  const row = rows[0] as { html: string } | undefined;
  return row?.html ?? null;
}
