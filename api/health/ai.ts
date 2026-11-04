import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getMetaChatModel,
  getModelApiKey,
  hasModelApiConfig,
} from "../_lib/metaModelApi";

type ModelsListResponse = {
  data?: Array<{ id?: string }>;
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hasApiKey = hasModelApiConfig();
  const token = getModelApiKey();
  const model = getMetaChatModel();

  let metaOk = false;
  let metaStatus = 0;
  let metaError = "";
  let availableModels: string[] | undefined;

  if (token) {
    try {
      const modelsResponse = await fetch("https://api.meta.ai/v1/models", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (modelsResponse.ok) {
        const modelsData = (await modelsResponse.json()) as ModelsListResponse;
        availableModels = (modelsData.data ?? [])
          .map((entry) => entry.id)
          .filter((id): id is string => Boolean(id));
      }

      const response = await fetch("https://api.meta.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply with OK only." }],
          max_completion_tokens: 16,
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

  const modelAvailable = availableModels ? availableModels.includes(model) : undefined;

  res.status(200).json({
    ok: metaOk,
    provider: "meta-model-api",
    model,
    modelAvailable,
    availableModels,
    auth: {
      hasApiKey,
      configured: Boolean(token),
    },
    metaStatus,
    metaError: metaError || undefined,
  });
}
