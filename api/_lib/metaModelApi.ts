/** Default chat model (override with META_MODEL if GET /v1/models differs for your key). */
export const META_DEFAULT_CHAT_MODEL = "muse-wonder-1.0";

/** Default reasoning depth for site + domain LLM calls (override with META_REASONING_EFFORT). */
export const META_DEFAULT_REASONING_EFFORT = "low" as const;

export type MetaReasoningEffort = "minimal" | "low" | "medium" | "high";

export function getMetaReasoningEffort(): MetaReasoningEffort {
  const raw = process.env.META_REASONING_EFFORT?.trim().toLowerCase();
  const allowed: MetaReasoningEffort[] = ["minimal", "low", "medium", "high"];
  if (raw && allowed.includes(raw as MetaReasoningEffort)) {
    return raw as MetaReasoningEffort;
  }
  return META_DEFAULT_REASONING_EFFORT;
}

const META_API_BASE = "https://api.meta.ai/v1";
const META_CHAT_URL = `${META_API_BASE}/chat/completions`;

export function getMetaChatModel(): string {
  const raw = process.env.META_MODEL?.trim() || META_DEFAULT_CHAT_MODEL;
  return raw.replace(/^\uFEFF/, "").replace(/^["']|["']$/g, "");
}

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { message?: string };
};

export type ChatCompletionOptions = {
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  maxCompletionTokens?: number;
  /** Prefer streaming for long generations — avoids Meta non-streaming gateway timeouts. */
  stream?: boolean;
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

function extractMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: string }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

async function readStreamingChatContent(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error("Meta Model API stream had no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const chunk = JSON.parse(payload) as ChatCompletionResponse;
        const delta = (chunk as { choices?: Array<{ delta?: { content?: unknown } }> }).choices?.[0]
          ?.delta?.content;
        if (delta) {
          content += extractMessageContent(delta);
        }
      } catch {
        // Ignore malformed SSE chunks
      }
    }
  }

  if (!content) {
    throw new Error("Meta Model API stream returned empty content");
  }

  return content;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions,
): Promise<string> {
  const apiKey = getModelApiKey();
  if (!apiKey) {
    throw new Error("MODEL_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    model: getMetaChatModel(),
    messages,
    stream: Boolean(options?.stream),
  };

  if (options?.reasoningEffort) {
    body.reasoning_effort = options.reasoningEffort;
  }

  if (options?.maxCompletionTokens) {
    body.max_completion_tokens = options.maxCompletionTokens;
  }

  const response = await fetch(META_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options?.stream ? { Accept: "text/event-stream" } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Meta Model API failed (${response.status})`;
    try {
      const data = (await response.json()) as ChatCompletionResponse;
      message = data.error?.message ?? message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text.slice(0, 240);
    }
    throw new Error(message);
  }

  if (options?.stream) {
    return readStreamingChatContent(response);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = extractMessageContent(data.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("Meta Model API returned empty content");
  }

  return content;
}
