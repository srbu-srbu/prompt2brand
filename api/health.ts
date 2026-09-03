import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLiveIntegrationsMode, namecomEnvironment } from "./_lib/integrations";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    service: "prompt2brand",
    liveIntegrationsMode: getLiveIntegrationsMode(),
    namecomEnvironment: namecomEnvironment(),
    timestamp: new Date().toISOString(),
  });
}
