// src/openrouter.ts
import { OpenRouter } from "@openrouter/sdk";
import type {
  ChatRequest,
  ChatResponse,
  ChatToolCall,
  LLMProvider,
} from "./types.js";

export interface OpenRouterProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  /**
   * Optional logger for debugging SDK requests
   * Pass `console` to enable debug logging
   */
  debugLogger?: typeof console;
}

export class OpenRouterProvider implements LLMProvider {
  private client: OpenRouter;

  constructor(opts: OpenRouterProviderOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;

    this.client = new OpenRouter({
      apiKey,
      serverURL: opts.baseUrl,
      debugLogger: opts.debugLogger,
    });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    // Convert our tool format to SDK format
    const tools = req.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));

    // Call the SDK's chat.send method
    const response = await this.client.chat.send({
      model: req.model,
      messages: req.messages as any, // SDK types are compatible
      tools,
      toolChoice: tools && tools.length > 0 ? "auto" : undefined,
      temperature: req.temperature ?? undefined,
      maxTokens: req.maxTokens ?? undefined,
      stream: false, // Non-streaming for now
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("OpenRouterProvider: No choices in response");
    }

    // Convert SDK response to our format
    const toolCalls: ChatToolCall[] | undefined = choice.message.toolCalls?.map(
      (tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }),
    );

    // Handle content - SDK can return string or array, we normalize to string
    let content: string | null = null;
    if (choice.message.content) {
      if (typeof choice.message.content === "string") {
        content = choice.message.content;
      } else if (Array.isArray(choice.message.content)) {
        // Extract text from content items
        content = choice.message.content
          .map((item) => (item.type === "text" ? item.text : ""))
          .join("");
      }
    }

    return {
      message: {
        role: "assistant",
        content,
        tool_calls: toolCalls,
      },
      finishReason: choice.finishReason ?? null,
      raw: response,
    };
  }
}
