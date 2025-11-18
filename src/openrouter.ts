// src/openrouter.ts
import { OpenRouter } from "@openrouter/sdk";
import type { Message as SDKMessage } from "@openrouter/sdk/models/message";
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ChatToolCall,
  LLMProvider,
  Message,
  OpenRouterChatResponse,
  OpenRouterContentItem,
} from "./types.js";

/**
 * Converts our internal Message format to the SDK's Message format.
 * The SDK expects specific message structures with toolCallId for tool responses.
 */
function toSDKMessages(messages: Message[]): SDKMessage[] {
  return messages.map((msg): SDKMessage => {
    switch (msg.role) {
      case "system":
        return {
          role: "system",
          content: msg.content ?? "",
        };
      case "user":
        return {
          role: "user",
          content: msg.content ?? "",
        };
      case "assistant":
        return {
          role: "assistant",
          content: msg.content ?? undefined,
          name: msg.name,
          toolCalls: msg.toolCalls,
        };
      case "tool":
        if (!msg.toolCallId) {
          throw new Error(
            "OpenRouterProvider: Tool message missing required toolCallId",
          );
        }
        return {
          role: "tool",
          content: msg.content ?? "",
          toolCallId: msg.toolCallId,
        };
    }
  });
}

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

    if (!apiKey) {
      throw new Error(
        "OpenRouterProvider: API key is required but not provided.\n\n" +
          "Resolution steps:\n" +
          "1. Pass apiKey option: new OpenRouterProvider({ apiKey: 'your-key' })\n" +
          "2. Set OPENROUTER_API_KEY environment variable: export OPENROUTER_API_KEY=your-key\n" +
          "3. Get your API key from: https://openrouter.ai/keys\n\n" +
          "Choose one method and try again.",
      );
    }

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

    const sdkRequest = {
      model: req.model,
      messages: toSDKMessages(req.messages),
      tools,
      toolChoice: tools && tools.length > 0 ? "auto" : undefined,
      temperature: req.temperature ?? undefined,
      maxTokens: req.maxTokens ?? undefined,
      stream: false, // Non-streaming for now
      responseFormat: req.responseFormat,
    };

    // Call the SDK's chat.send method
    const response = await this.client.chat.send(sdkRequest);

    // Type the response for proper type safety
    const typedResponse = response as OpenRouterChatResponse;
    const choice = typedResponse.choices[0];
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
        const contentItems = choice.message.content;
        content = contentItems
          .map((item: OpenRouterContentItem) => (item.type === "text" ? item.text : ""))
          .join("");
      }
    }

    return {
      message: {
        role: "assistant",
        content,
        toolCalls: toolCalls,
      },
      finishReason: choice.finishReason ?? null,
      raw: response,
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk> {
    // Convert our tool format to SDK format
    const tools = req.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));

    const sdkRequest = {
      model: req.model,
      messages: toSDKMessages(req.messages),
      tools,
      toolChoice: tools && tools.length > 0 ? "auto" : undefined,
      temperature: req.temperature ?? undefined,
      maxTokens: req.maxTokens ?? undefined,
      stream: true as const,
      responseFormat: req.responseFormat,
    };

    // Call the SDK's chat.send method with stream: true
    const streamResponse = await this.client.chat.send(sdkRequest);

    // The SDK returns an EventStream which is an AsyncIterable
    for await (const chunk of streamResponse) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;
      const streamChunk: ChatStreamChunk = {};

      // Handle content delta
      if (delta.content) {
        streamChunk.content = delta.content;
      }

      // Handle tool calls delta
      if (delta.toolCalls && delta.toolCalls.length > 0) {
        streamChunk.toolCalls = delta.toolCalls.map((tc) => ({
          index: tc.index,
          id: tc.id,
          type: tc.type,
          function: tc.function
            ? {
                name: tc.function.name,
                arguments: tc.function.arguments,
              }
            : undefined,
        }));
      }

      // Handle finish reason
      if (choice.finishReason) {
        streamChunk.finishReason = choice.finishReason;
      }

      // Handle usage (typically in the final chunk)
      if (chunk.usage) {
        streamChunk.usage = {
          promptTokens: chunk.usage.promptTokens,
          completionTokens: chunk.usage.completionTokens,
          totalTokens: chunk.usage.totalTokens,
        };
      }

      yield streamChunk;
    }
  }
}
