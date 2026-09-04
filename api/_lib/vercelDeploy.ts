import type { BrandKit, PageDraft } from "./types";
import { preparePublishedHtml } from "../../shared/internalLinks";
import { wrapPage } from "./wrapPage";

const VERCEL_API = "https://api.vercel.com";

type VercelConfig = {
  token: string;
  teamId?: string;
};

type DeployFile = {
  file: string;
  data: string;
};

type DeploymentResponse = {
  id?: string;
  url?: string;
  readyState?: string;
  alias?: string[];
  aliasAssigned?: boolean | number | null;
  automaticAliases?: string[];
  error?: { message?: string; code?: string };
};

export type SiteDeploymentResult = {
  deploymentId: string;
  hostedUrl: string;
  readyState: string;
};

export function hasVercelDeployConfig(): boolean {
  return Boolean(process.env.VERCEL_TOKEN?.trim());
}

function getVercelConfig(): VercelConfig | null {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) return null;

  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  return { token, teamId: teamId || undefined };
}

function buildTeamQuery(config: VercelConfig, extra?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (config.teamId) params.set("teamId", config.teamId);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function teamQuery(config: VercelConfig): string {
  return buildTeamQuery(config);
}

async function vercelFetch<T>(
  path: string,
  init: RequestInit & { config?: VercelConfig } = {},
): Promise<T> {
  const config = init.config ?? getVercelConfig();
  if (!config) {
    throw new Error("VERCEL_TOKEN is required");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${VERCEL_API}${path}`, {
    ...init,
    headers,
  });

  const data = (await response.json().catch(() => ({}))) as T & DeploymentResponse;
  if (!response.ok) {
    const message =
      (data as DeploymentResponse).error?.message ??
      `Vercel API ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  return data;
}

/** Build static file tree for a one-project-per-launch Vercel deployment. */
export function buildStaticDeployFiles(pages: PageDraft[], brandKit: BrandKit): DeployFile[] {
  const files: DeployFile[] = [];
  const pageMeta = pages.map((page) => ({ slug: page.slug, title: page.title }));

  for (const page of pages) {
    const bodyHtml = preparePublishedHtml(page.bodyHtml, pageMeta);
    const html = wrapPage(page.title, bodyHtml, brandKit);
    const file = page.slug === "home" ? "index.html" : `${page.slug}.html`;
    files.push({ file, data: html });
  }

  files.push({
    file: "vercel.json",
    data: JSON.stringify({ cleanUrls: true }, null, 2),
  });

  return files;
}

export function hostedUrlFromDeployment(deployment: DeploymentResponse, siteId: string): string {
  const candidates = [
    ...(deployment.alias ?? []),
    ...(deployment.automaticAliases ?? []),
    deployment.url,
    siteId,
  ].filter(Boolean) as string[];

  const preferred =
    candidates.find((value) => value.includes(siteId) && value.includes(".vercel.app")) ??
    candidates.find((value) => value.includes(".vercel.app")) ??
    siteId;

  if (preferred.startsWith("http://") || preferred.startsWith("https://")) {
    return preferred;
  }

  return `https://${preferred.replace(/^https?:\/\//, "")}`;
}

/** New Deploy API projects inherit team SSO protection; customer sites must be public. */
export async function disableProjectSsoProtection(projectIdOrName: string): Promise<void> {
  const config = getVercelConfig();
  if (!config) {
    throw new Error("VERCEL_TOKEN is required");
  }

  await vercelFetch(`/v9/projects/${encodeURIComponent(projectIdOrName)}${teamQuery(config)}`, {
    method: "PATCH",
    config,
    body: JSON.stringify({ ssoProtection: null }),
  });
}

type DomainConfigResponse = {
  recommendedIPv4?: Array<{ rank: number; value: string[] }>;
  recommendedCNAME?: Array<{ rank: number; value: string }>;
  misconfigured?: boolean;
};

export type ProductionDnsRecord = {
  host: string;
  type: "A" | "CNAME";
  answer: string;
};

function splitApexAndWww(fqdn: string): { apexFqdn: string; wwwFqdn: string } {
  const normalized = fqdn.trim().toLowerCase();
  if (normalized.startsWith("www.")) {
    const apexFqdn = normalized.slice(4);
    return { apexFqdn, wwwFqdn: normalized };
  }
  return { apexFqdn: normalized, wwwFqdn: `www.${normalized}` };
}

function preferredRank1<T extends { rank: number }>(items: T[] | undefined): T | undefined {
  if (!items?.length) return undefined;
  return items.find((item) => item.rank === 1) ?? items[0];
}

async function addProjectDomain(projectIdOrName: string, domainName: string): Promise<void> {
  const config = getVercelConfig();
  if (!config) {
    throw new Error("VERCEL_TOKEN is required");
  }

  try {
    await vercelFetch(`/v10/projects/${encodeURIComponent(projectIdOrName)}/domains${teamQuery(config)}`, {
      method: "POST",
      config,
      body: JSON.stringify({ name: domainName }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes(" 409") || message.toLowerCase().includes("already")) {
      return;
    }
    throw error;
  }
}

async function getDomainConfig(domain: string, projectIdOrName: string): Promise<DomainConfigResponse> {
  const config = getVercelConfig();
  if (!config) {
    throw new Error("VERCEL_TOKEN is required");
  }

  return vercelFetch<DomainConfigResponse>(
    `/v6/domains/${encodeURIComponent(domain)}/config${buildTeamQuery(config, {
      projectIdOrName,
    })}`,
    { config },
  );
}

/** Register apex + www on the launch project and return name.com DNS targets (mode 4). */
export async function setupProductionCustomDomain(input: {
  siteId: string;
  fqdn: string;
}): Promise<{ records: ProductionDnsRecord[] }> {
  const { apexFqdn, wwwFqdn } = splitApexAndWww(input.fqdn);

  await addProjectDomain(input.siteId, apexFqdn);
  if (wwwFqdn !== apexFqdn) {
    await addProjectDomain(input.siteId, wwwFqdn);
  }

  const [apexConfig, wwwConfig] = await Promise.all([
    getDomainConfig(apexFqdn, input.siteId),
    getDomainConfig(wwwFqdn, input.siteId),
  ]);

  const apexIp = preferredRank1(apexConfig.recommendedIPv4)?.value?.[0];
  const wwwCname = preferredRank1(wwwConfig.recommendedCNAME)?.value;

  if (!apexIp) {
    throw new Error(`Vercel did not return an apex A record target for ${apexFqdn}`);
  }
  if (!wwwCname) {
    throw new Error(`Vercel did not return a www CNAME target for ${wwwFqdn}`);
  }

  const cnameAnswer = wwwCname.endsWith(".") ? wwwCname : `${wwwCname}.`;

  return {
    records: [
      { host: "@", type: "A", answer: apexIp },
      { host: "www", type: "CNAME", answer: cnameAnswer },
    ],
  };
}

export async function createSiteDeployment(input: {
  siteId: string;
  pages: PageDraft[];
  brandKit: BrandKit;
}): Promise<SiteDeploymentResult> {
  const config = getVercelConfig();
  if (!config) {
    throw new Error("VERCEL_TOKEN is required");
  }

  const files = buildStaticDeployFiles(input.pages, input.brandKit).map((entry) => ({
    file: entry.file,
    data: Buffer.from(entry.data, "utf8").toString("base64"),
    encoding: "base64" as const,
  }));

  const deployment = await vercelFetch<DeploymentResponse>(
    `/v13/deployments${teamQuery(config)}`,
    {
      method: "POST",
      config,
      body: JSON.stringify({
        name: input.siteId,
        files,
        projectSettings: {
          framework: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
        },
        target: "production",
      }),
    },
  );

  if (!deployment.id) {
    throw new Error("Vercel deployment response did not include an id");
  }

  try {
    await disableProjectSsoProtection(input.siteId);
  } catch (error) {
    console.error("vercel disable SSO protection failed", error);
  }

  return {
    deploymentId: deployment.id,
    hostedUrl: hostedUrlFromDeployment(deployment, input.siteId),
    readyState: deployment.readyState ?? "QUEUED",
  };
}

export async function getDeployment(deploymentId: string): Promise<DeploymentResponse> {
  const config = getVercelConfig();
  if (!config) {
    throw new Error("VERCEL_TOKEN is required");
  }

  return vercelFetch<DeploymentResponse>(
    `/v13/deployments/${encodeURIComponent(deploymentId)}${teamQuery(config)}`,
    { config },
  );
}

export function mapReadyStateToHosting(
  readyState?: string,
): "pending" | "live" | "failed" {
  if (readyState === "READY") return "live";
  if (readyState === "ERROR" || readyState === "CANCELED") return "failed";
  return "pending";
}

export async function checkUrlReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function resolveHostingStatus(input: {
  siteId: string;
  hostedUrl: string;
  vercelDeploymentId: string | null;
  currentStatus: "pending" | "live" | "failed";
}): Promise<{ hostingStatus: "pending" | "live" | "failed"; hostedUrl: string }> {
  const fallbackUrl = input.hostedUrl || `https://${input.siteId}.vercel.app`;

  if (!input.vercelDeploymentId || !hasVercelDeployConfig()) {
    const reachable = await checkUrlReachable(fallbackUrl);
    if (reachable) return { hostingStatus: "live", hostedUrl: fallbackUrl };
    return { hostingStatus: input.currentStatus, hostedUrl: fallbackUrl };
  }

  try {
    const deployment = await getDeployment(input.vercelDeploymentId);
    const hostedUrl = hostedUrlFromDeployment(deployment, input.siteId);
    const hostingStatus = mapReadyStateToHosting(deployment.readyState);

    if (hostingStatus === "live") {
      const reachable = await checkUrlReachable(hostedUrl);
      return {
        hostingStatus: reachable ? "live" : "pending",
        hostedUrl,
      };
    }

    if (hostingStatus === "failed") {
      const reachable = await checkUrlReachable(fallbackUrl);
      return {
        hostingStatus: reachable ? "live" : "failed",
        hostedUrl: reachable ? fallbackUrl : hostedUrl,
      };
    }

    return { hostingStatus: "pending", hostedUrl };
  } catch (error) {
    console.error("resolveHostingStatus failed", error);
    return { hostingStatus: input.currentStatus, hostedUrl: fallbackUrl };
  }
}
