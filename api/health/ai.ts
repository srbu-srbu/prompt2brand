import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getMetaChatModel,
  getMetaReasoningEffort,
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
  const reasoningEffort = getMetaReasoningEffort();

  let metaOk = false;
  let metaStatus = 0;
  let metaError = "";
  let availableModels: string[] | undefined;
  let siteGenProbeOk: boolean | undefined;
  let siteGenProbeStatus: number | undefined;
  let siteGenProbeError = "";

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

      const siteGenProbe = await fetch("https://api.meta.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Reply with JSON only." },
            { role: "user", content: '{"ping":true}' },
          ],
          reasoning_effort: getMetaReasoningEffort(),
          max_completion_tokens: 256,
          stream: false,
        }),
      });
      siteGenProbeStatus = siteGenProbe.status;
      siteGenProbeOk = siteGenProbe.ok;
      if (!siteGenProbe.ok) {
        siteGenProbeError = (await siteGenProbe.text()).slice(0, 240);
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
    reasoningEffort,
    modelAvailable,
    availableModels,
    auth: {
      hasApiKey,
      configured: Boolean(token),
    },
    metaStatus,
    metaError: metaError || undefined,
    siteGenProbe: token
      ? {
          ok: siteGenProbeOk,
          status: siteGenProbeStatus,
          error: siteGenProbeError || undefined,
        }
      : undefined,
  });
}
