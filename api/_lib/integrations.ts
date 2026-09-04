export type LiveIntegrationsMode = 0 | 1 | 2 | 3;

export function getLiveIntegrationsMode(): LiveIntegrationsMode {
  const raw = process.env.P2B_LIVE_INTEGRATIONS?.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "off") return 0;
  if (raw === "1") return 1;
  if (raw === "2") return 2;
  if (raw === "3") return 3;
  return 0;
}

export function isLiveIntegrations(): boolean {
  const mode = getLiveIntegrationsMode();
  return mode === 2 || mode === 3;
}

export function isSerpApiEnabled(): boolean {
  return isLiveIntegrations() && Boolean(process.env.SERPAPI_KEY?.trim());
}

export function useVercelHosting(): boolean {
  const mode = getLiveIntegrationsMode();
  return mode === 1 || mode === 2 || mode === 3;
}

export function namecomEnvironment(): "sandbox" | "production" {
  return getLiveIntegrationsMode() === 3 ? "production" : "sandbox";
}
