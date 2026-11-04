export const META_SPARK_MODEL = "muse-spark-1.3";

const META_CHAT_URL = "https://api.meta.ai/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

export function getModelApiKey(): string | undefined {
  return process.env.MODEL_API_KEY?.trim() || undefined;
}

export function hasModelApiConfig(): boolean {
  return Boolean(getModelApiKey());
}

export function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(jsonText);
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { reasoningEffort?: "low" | "medium" | "high" },
): Promise<string> {
  const apiKey = getModelApiKey();
  if (!apiKey) {
    throw new Error("MODEL_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    model: META_SPARK_MODEL,
    messages,
    stream: false,
  };

  if (options?.reasoningEffort) {
    body.reasoning_effort = options.reasoningEffort;
  }

  const response = await fetch(META_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as ChatCompletionResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Meta Model API failed (${response.status})`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Meta Model API returned empty content");
  }

  return content;
}
