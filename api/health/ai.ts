import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hasApiKey = Boolean(process.env.AI_GATEWAY_API_KEY);
  const hasOidc = Boolean(process.env.VERCEL_OIDC_TOKEN);
  const token = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;

  let gatewayOk = false;
  let gatewayStatus = 0;
  let gatewayError = "";

  if (token) {
    try {
      const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
        headers: { Authorization: `Bearer ${token}` },
      });
      gatewayStatus = response.status;
      gatewayOk = response.ok;
      if (!response.ok) {
        gatewayError = (await response.text()).slice(0, 240);
      }
    } catch (error) {
      gatewayError = error instanceof Error ? error.message : "Gateway probe failed";
    }
  }

  res.status(200).json({
    ok: gatewayOk,
    auth: {
      hasApiKey,
      hasOidc,
      configured: Boolean(token),
    },
    gatewayStatus,
    gatewayError: gatewayError || undefined,
  });
}
