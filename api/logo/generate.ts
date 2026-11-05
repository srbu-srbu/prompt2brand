import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateBrandAssetsFromPrompt } from "../_lib/brandAssets";
import { hasMetaImageConfig } from "../_lib/metaImageApi";
import type { BrandAssets, BrandKit } from "../../shared/types";

export const maxDuration = 60;

type LogoGenerateBody = {
  prompt?: string;
  brandKit?: BrandKit;
  brandAssets?: BrandAssets;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (req.body ?? {}) as LogoGenerateBody;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const brandKit = body.brandKit;

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  if (!brandKit?.name?.trim()) {
    res.status(400).json({ error: "brandKit.name is required — create a site first" });
    return;
  }

  if (!hasMetaImageConfig()) {
    res.status(503).json({ error: "MODEL_API_KEY is not configured" });
    return;
  }

  try {
    const brandAssets = await generateBrandAssetsFromPrompt({
      prompt,
      brandKit,
      previousRevision: body.brandAssets?.revision,
    });

    res.status(200).json({
      brandAssets,
      source: "llm",
      summary: [
        "Logo updated from your prompt.",
        "Saved as logo.png (200×200) and favicon.png (32×32).",
        `Latest cue: ${prompt.slice(0, 60)}`,
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logo generation failed";
    console.error("logo generate failed", error);
    res.status(200).json({
      brandAssets: body.brandAssets,
      source: "mock",
      error: message,
      summary: [
        "Logo update failed — kept the previous logo.",
        `Latest cue: ${prompt.slice(0, 60)}`,
        message.slice(0, 120),
      ],
    });
  }
}
