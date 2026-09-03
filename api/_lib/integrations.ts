export type LiveIntegrationsMode = 0 | 1 | 2;

export function getLiveIntegrationsMode(): LiveIntegrationsMode {
  const raw = process.env.P2B_LIVE_INTEGRATIONS?.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "off") return 0;
  if (raw === "1") return 1;
  if (raw === "2" || raw === "true" || raw === "yes") return 2;
  return 0;
}

export function isLiveIntegrations(): boolean {
  return getLiveIntegrationsMode() >= 1;
}

export function isSerpApiEnabled(): boolean {
  return getLiveIntegrationsMode() >= 1 && Boolean(process.env.SERPAPI_KEY?.trim());
}

export function namecomEnvironment(): "sandbox" | "production" {
  return getLiveIntegrationsMode() === 2 ? "production" : "sandbox";
}
