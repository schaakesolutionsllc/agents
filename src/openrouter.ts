// src/openrouter.ts
import type {
  ChatRequest,
  ChatResponse,
  ChatTool,
  LLMProvider,
} from "./types.js";

export interface OpenRouterProviderOptions {
  apiKey?: string;
  baseUrl?: string;
}

export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: OpenRouterProviderOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error(
        "OpenRouterProvider: API key is required (OPENROUTER_API_KEY)",
      );
    }

    this.baseUrl = opts.baseUrl ?? "https://openrouter.ai/api/v1";
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const body: any = {
      model: req.model,
      messages: req.messages,
      stream: req.stream ?? false,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    };

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t: ChatTool) => t);
      body.tool_choice = "auto";
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `OpenRouterProvider: ${res.status} ${res.statusText} – ${text}`,
      );
    }

    // Non-streaming only for now; streaming can be added later.
    const json: any = await res.json();
    const choice = json.choices?.[0];

    const message = choice?.message ?? {
      role: "assistant",
      content: "",
    };

    return {
      message,
      finishReason: choice?.finish_reason ?? null,
      raw: json,
    };
  }
}
