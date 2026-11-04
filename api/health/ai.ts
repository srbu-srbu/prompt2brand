import type { VercelRequest, VercelResponse } from "@vercel/node";
import { META_SPARK_MODEL, getModelApiKey, hasModelApiConfig } from "../_lib/metaModelApi";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hasApiKey = hasModelApiConfig();
  const token = getModelApiKey();

  let metaOk = false;
  let metaStatus = 0;
  let metaError = "";

  if (token) {
    try {
      const response = await fetch("https://api.meta.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: META_SPARK_MODEL,
          messages: [{ role: "user", content: "Reply with OK only." }],
          max_completion_tokens: 16,
          reasoning_effort: "low",
        }),
      });
      metaStatus = response.status;
      metaOk = response.ok;
      if (!response.ok) {
        metaError = (await response.text()).slice(0, 240);
      }
    } catch (error) {
      metaError = error instanceof Error ? error.message : "Meta Model API probe failed";
    }
  }

  res.status(200).json({
    ok: metaOk,
    provider: "meta-model-api",
    model: META_SPARK_MODEL,
    auth: {
      hasApiKey,
      configured: Boolean(token),
    },
    metaStatus,
    metaError: metaError || undefined,
  });
}
