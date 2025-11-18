// src/openrouter.ts
import { OpenRouter } from "@openrouter/sdk";
import type { Message as SDKMessage } from "@openrouter/sdk/models/message";
import { ERROR_PREFIXES } from "./agent.js";
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ChatToolCall,
  LLMProvider,
  Message,
  MessageContentItem,
  OpenRouterChatResponse,
  OpenRouterContentItem,
  ProviderOptions,
  TextContentItem,
} from "./types.js";

/**
 * Converts our multimodal content format to the SDK's format.
 */
/**
 * SDK content type union for multimodal content items.
 * OpenRouter SDK accepts various content item formats for multimodal input.
 */
type SDKContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: { url: string; detail?: string } }
  | { type: "input_audio"; inputAudio: { data: string; format: string } };

function toSDKContent(
  content: string | MessageContentItem[] | null,
): string | SDKContentItem[] | undefined {
  if (content === null) {
    return undefined;
  }
  if (typeof content === "string") {
    return content;
  }
  // Convert our content items to SDK format
  return content.map((item) => {
    switch (item.type) {
      case "text":
        return { type: "text", text: item.text };
      case "image_url":
        return {
          type: "image_url",
          imageUrl: {
            url: item.imageUrl.url,
            detail: item.imageUrl.detail,
          },
        };
      case "input_audio":
        return {
          type: "input_audio",
          inputAudio: {
            data: item.inputAudio.data,
            format: item.inputAudio.format,
          },
        };
      case "input_file":
        // File content requires the Responses API, not Chat API
        // Use extractDocument() or OpenRouterProvider.responses() instead
        throw new Error(
          `${ERROR_PREFIXES.OPENROUTER} File content (input_file) requires the Responses API. ` +
            "Use extractDocument() or provider.responses() instead of chat().",
        );
    }
  });
}

/**
 * Converts our internal Message format to the SDK's Message format.
 * The SDK expects specific message structures with toolCallId for tool responses.
 */
function toSDKMessages(messages: Message[]): SDKMessage[] {
  return messages.map((msg): SDKMessage => {
    switch (msg.role) {
      case "system": {
        // System messages must be strings
        const systemContent =
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter((c): c is TextContentItem => c.type === "text")
                  .map((c) => c.text)
                  .join("")
              : "";
        return {
          role: "system",
          content: systemContent,
        };
      }
      case "user": {
        const content = toSDKContent(msg.content);
        // SDK expects string or content item array for user messages
        // Cast required due to SDK type mismatch between our content format and SDK format
        return {
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- SDK type accepts string | content[], but TypeScript can't verify compatibility
          content: (content ?? "") as any,
        } as SDKMessage;
      }
      case "assistant": {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .map((c) => (c.type === "text" ? c.text : ""))
                  .join("")
              : undefined;
        return {
          role: "assistant",
          content,
          name: msg.name,
          toolCalls: msg.toolCalls,
        };
      }
      case "tool":
        if (!msg.toolCallId) {
          throw new Error(
            `${ERROR_PREFIXES.OPENROUTER} Tool message missing required toolCallId`,
          );
        }
        return {
          role: "tool",
          content:
            (typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content)) ?? "",
          toolCallId: msg.toolCallId,
        };
    }
  });
}

/**
 * Builds provider options for SDK requests from our ProviderOptions type.
 * Maps our internal ProviderOptions to the SDK's expected format.
 *
 * @param providerOptions - The provider options from ChatRequest
 * @returns SDK provider options or undefined if no options provided
 */
function buildSDKProviderOptions(
  providerOptions?: ProviderOptions,
): Record<string, unknown> | undefined {
  if (!providerOptions) return undefined;

  return {
    sort: providerOptions.sort,
    order: providerOptions.order,
    only: providerOptions.only,
    ignore: providerOptions.ignore,
    zdr: providerOptions.zdr,
    dataCollection: providerOptions.dataCollection,
    allowFallbacks: providerOptions.allowFallbacks,
    requireParameters: providerOptions.requireParameters,
    maxPrice: providerOptions.maxPrice,
    quantizations: providerOptions.quantizations,
  };
}

/**
 * Builds a complete SDK request from a ChatRequest.
 * Handles all optional parameters, including sampling, token limits, and logging options.
 *
 * @param req - The ChatRequest with model, messages, and options
 * @param tools - Formatted tools for the SDK (from our format to SDK format)
 * @param stream - Whether this request should use streaming
 * @returns Complete request object for the SDK's chat.send() method
 */
function buildSDKRequest(
  req: ChatRequest,
  tools:
    | Array<{
        type: "function";
        function: {
          name: string;
          description: string | undefined;
          parameters: Record<string, unknown> | undefined;
        };
      }>
    | undefined,
  stream: boolean,
): Record<string, unknown> {
  const provider = buildSDKProviderOptions(req.providerOptions);

  return {
    model: req.model,
    ...(req.models && { models: req.models }),
    messages: toSDKMessages(req.messages),
    ...(tools && { tools }),
    ...(tools && tools.length > 0 && { toolChoice: "auto" as const }),
    // Sampling parameters
    ...(req.temperature !== undefined && { temperature: req.temperature }),
    ...(req.topP !== undefined && { topP: req.topP }),
    ...(req.frequencyPenalty !== undefined && {
      frequencyPenalty: req.frequencyPenalty,
    }),
    ...(req.presencePenalty !== undefined && {
      presencePenalty: req.presencePenalty,
    }),
    ...(req.seed !== undefined && { seed: req.seed }),
    ...(req.stop !== undefined && { stop: req.stop }),
    ...(req.logitBias !== undefined && { logitBias: req.logitBias }),
    // Token limits
    ...(req.maxTokens !== undefined && { maxTokens: req.maxTokens }),
    // Logging
    ...(req.logprobs !== undefined && { logprobs: req.logprobs }),
    ...(req.topLogprobs !== undefined && { topLogprobs: req.topLogprobs }),
    // Output
    stream,
    ...(req.responseFormat && { responseFormat: req.responseFormat }),
    // Provider routing
    ...(provider && { provider }),
    // Reasoning
    ...(req.reasoning && { reasoning: req.reasoning }),
  };
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
  private _client: OpenRouter;
  private _apiKey: string;

  constructor(opts: OpenRouterProviderOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error(
        `${ERROR_PREFIXES.OPENROUTER} API key is required but not provided.\n\n` +
          "Resolution steps:\n" +
          "1. Pass apiKey option: new OpenRouterProvider({ apiKey: 'your-key' })\n" +
          "2. Set OPENROUTER_API_KEY environment variable: export OPENROUTER_API_KEY=your-key\n" +
          "3. Get your API key from: https://openrouter.ai/keys\n\n" +
          "Choose one method and try again.",
      );
    }

    this._apiKey = apiKey;
    this._client = new OpenRouter({
      apiKey,
      serverURL: opts.baseUrl,
      debugLogger: opts.debugLogger,
    });
  }

  /**
   * Get the API key for use with endpoints requiring bearer authentication.
   * Some OpenRouter SDK endpoints require explicit bearer token auth.
   */
  get apiKey(): string {
    return this._apiKey;
  }

  /**
   * Direct access to the OpenRouter SDK client for advanced features.
   * Use this for features not exposed through the agent API, such as:
   * - Analytics: `provider.client.analytics.getUserActivity()`
   * - Credits: `provider.client.credits.getCredits()`
   * - Generations: `provider.client.generations.getGeneration()`
   * - Models: `provider.client.models.list()`
   * - API Keys: `provider.client.apiKeys.*`
   *
   * @example
   * ```typescript
   * const provider = new OpenRouterProvider();
   *
   * // Check credits
   * const credits = await provider.client.credits.getCredits();
   *
   * // List available models
   * const models = await provider.client.models.list();
   *
   * // Get generation details
   * const gen = await provider.client.generations.getGeneration({
   *   generationId: "gen_123"
   * });
   * ```
   */
  get client(): OpenRouter {
    return this._client;
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

    const sdkRequest = buildSDKRequest(req, tools, false);

    // Call the SDK's chat.send method
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- SDK types don't match our request structure exactly
    const response = await this._client.chat.send(sdkRequest as any);

    // Type the response for proper type safety
    const typedResponse = response as OpenRouterChatResponse;
    const choice = typedResponse.choices[0];
    if (!choice) {
      throw new Error(`${ERROR_PREFIXES.OPENROUTER} No choices in response`);
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
          .map((item: OpenRouterContentItem) =>
            item.type === "text" ? item.text : "",
          )
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

    const sdkRequest = buildSDKRequest(req, tools, true);

    // Call the SDK's chat.send method with stream: true
    // SDK types don't match our request structure exactly
    const streamResponse = (await this._client.chat.send(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- SDK type mismatch
      sdkRequest as any,
    )) as unknown as AsyncIterable<StreamChunkFromSDK>;

    // Type definition for SDK stream chunks
    interface StreamChunkFromSDK {
      choices: Array<{
        delta: {
          content?: string;
          toolCalls?: Array<{
            index: number;
            id?: string;
            type?: string;
            function?: {
              name?: string;
              arguments?: string;
            };
          }>;
        };
        finishReason?: string;
      }>;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }

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
          type: tc.type as "function" | undefined,
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
