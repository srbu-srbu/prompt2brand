import type { BrandKit, PageDraft } from "./types";
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

function teamQuery(config: VercelConfig): string {
  return config.teamId ? `?teamId=${encodeURIComponent(config.teamId)}` : "";
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

  for (const page of pages) {
    const html = wrapPage(page.title, page.bodyHtml, brandKit);
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
