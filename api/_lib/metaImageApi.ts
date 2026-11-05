import type { BrandKit } from "../../shared/types";
import { getModelApiKey } from "./metaModelApi";

const META_IMAGE_GENERATIONS_URL = "https://api.meta.ai/v1/images/generations";
const MUSE_IMAGE_MODEL = "muse-image-1.0";

type ImageGenerationResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
};

export function hasMetaImageConfig(): boolean {
  return Boolean(getModelApiKey());
}

function buildLogoPrompt(userPrompt: string, brandKit: BrandKit): string {
  const brandName = brandKit.name.trim() || "Brand";
  const tagline = brandKit.tagline.trim();
  return [
    "Square brand logo mark icon, centered, simple shapes, readable at small sizes, no fine text, transparent or solid simple background.",
    `Brand: ${brandName}.`,
    tagline ? `Tagline mood: ${tagline}.` : "",
    `Palette inspired by ${brandKit.primaryColor} and ${brandKit.accentColor}.`,
    userPrompt,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateBrandLogoImage(prompt: string, brandKit: BrandKit): Promise<Buffer> {
  const apiKey = getModelApiKey();
  if (!apiKey) {
    throw new Error("MODEL_API_KEY is not configured");
  }

  const response = await fetch(META_IMAGE_GENERATIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MUSE_IMAGE_MODEL,
      prompt: buildLogoPrompt(prompt, brandKit),
      n: 1,
      size: "1024x1024",
      output_format: "png",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    let message = `Meta Image API failed (${response.status})`;
    try {
      const data = (await response.json()) as ImageGenerationResponse;
      message = data.error?.message ?? message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text.slice(0, 240);
    }
    throw new Error(message);
  }

  const data = (await response.json()) as ImageGenerationResponse;
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Meta Image API returned no image data");
  }

  return Buffer.from(b64, "base64");
}
