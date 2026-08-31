export function isLiveIntegrations(): boolean {
  const raw = process.env.P2B_LIVE_INTEGRATIONS?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function isSerpApiEnabled(): boolean {
  return isLiveIntegrations() && Boolean(process.env.SERPAPI_KEY?.trim());
}

export function namecomEnvironment(): "sandbox" | "production" {
  return isLiveIntegrations() ? "production" : "sandbox";
}
