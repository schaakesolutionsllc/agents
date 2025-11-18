// src/embeddings.ts

import type { OpenRouterProvider } from "./openrouter.js";
import type { ProviderOptions } from "./types.js";

/**
 * Configuration for generating embeddings.
 */
export interface EmbeddingsConfig {
  /** The OpenRouter provider instance */
  provider: OpenRouterProvider;
  /** Model identifier for embeddings (e.g., "openai/text-embedding-3-small") */
  model: string;
  /** Optional provider routing options */
  providerOptions?: ProviderOptions;
  /** Output format for embeddings */
  encodingFormat?: "float" | "base64";
  /** User identifier for tracking */
  user?: string;
}

/**
 * Result of an embeddings request.
 */
export interface EmbeddingsResult {
  /** Array of embeddings, one per input text */
  embeddings: number[][];
  /** Model that was used */
  model: string;
  /** Token usage statistics */
  usage: {
    promptTokens: number;
    totalTokens: number;
    /** Estimated cost in USD (when available) */
    cost?: number;
  };
}

/**
 * Generate embeddings for text input using OpenRouter.
 * Supports single text or batch processing.
 *
 * @example
 * ```typescript
 * import { createEmbeddings, OpenRouterProvider } from "@schaakesolutionsllc/agents";
 *
 * const provider = new OpenRouterProvider();
 *
 * // Single text
 * const result = await createEmbeddings({
 *   provider,
 *   model: "openai/text-embedding-3-small"
 * }, "Hello world");
 *
 * console.log(result.embeddings[0]); // [0.123, -0.456, ...]
 *
 * // Batch processing
 * const batchResult = await createEmbeddings({
 *   provider,
 *   model: "openai/text-embedding-3-small"
 * }, ["Hello", "World", "Test"]);
 *
 * console.log(batchResult.embeddings.length); // 3
 * ```
 */
export async function createEmbeddings(
  config: EmbeddingsConfig,
  input: string | string[],
): Promise<EmbeddingsResult> {
  const { provider, model, providerOptions, encodingFormat, user } = config;

  // Build provider options if specified
  const sdkProvider = providerOptions
    ? {
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
      }
    : undefined;

  // SDK embeddings response type definition
  interface EmbeddingsResponse {
    data?: Array<{
      embedding: number[] | string;
    }>;
    model?: string;
    usage?: {
      promptTokens?: number;
      totalTokens?: number;
      cost?: number;
    };
  }

  const response = (await provider.client.embeddings.generate({
    input,
    model,
    provider: sdkProvider,
    encodingFormat,
    user,
  })) as EmbeddingsResponse;

  // Extract embeddings from response
  // Handle various response formats from the SDK
  const responseData = response?.data ?? [];
  const embeddings: number[][] = responseData.map((item) => {
    if (typeof item.embedding === "string") {
      // Base64 encoded - decode to float array
      const buffer = Buffer.from(item.embedding, "base64");
      const floats: number[] = [];
      for (let i = 0; i < buffer.length; i += 4) {
        floats.push(buffer.readFloatLE(i));
      }
      return floats;
    }
    return item.embedding;
  });

  return {
    embeddings,
    model: response?.model ?? model,
    usage: {
      promptTokens: response?.usage?.promptTokens ?? 0,
      totalTokens: response?.usage?.totalTokens ?? 0,
      cost: response?.usage?.cost,
    },
  };
}

/**
 * List available embedding models from OpenRouter.
 *
 * @example
 * ```typescript
 * import { listEmbeddingModels, OpenRouterProvider } from "@schaakesolutionsllc/agents";
 *
 * const provider = new OpenRouterProvider();
 * const models = await listEmbeddingModels(provider);
 *
 * models.forEach(model => {
 *   console.log(`${model.id}: ${model.name}`);
 * });
 * ```
 */
export async function listEmbeddingModels(
  provider: OpenRouterProvider,
): Promise<
  Array<{
    id: string;
    name?: string;
    pricing?: { prompt?: string; completion?: string };
  }>
> {
  const response = await provider.client.embeddings.listModels();

  return response.data.map((model) => ({
    id: model.id,
    name: model.name,
    pricing: model.pricing,
  }));
}
