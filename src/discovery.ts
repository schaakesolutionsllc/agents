// src/discovery.ts

import type { OpenRouterProvider } from "./openrouter.js";

/**
 * Parse a model ID into author and slug components.
 * Model IDs are typically in format "author/slug" (e.g., "anthropic/claude-3.5-sonnet").
 */
function parseModelId(model: string): { author: string; slug: string } {
  const parts = model.split("/");
  if (parts.length < 2 || !parts[0]) {
    throw new Error(
      `Invalid model ID format: "${model}". Expected "author/slug" format (e.g., "anthropic/claude-3.5-sonnet").`,
    );
  }
  return {
    author: parts[0],
    slug: parts.slice(1).join("/"), // Handle cases like "meta-llama/llama-3.1-8b-instruct"
  };
}

/**
 * Information about a model available on OpenRouter.
 */
export interface ModelInfo {
  /** Model identifier (e.g., "anthropic/claude-3.5-sonnet") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the model */
  description?: string;
  /** Context length in tokens */
  contextLength?: number;
  /** Pricing information */
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
  };
  /** Model architecture */
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instructType?: string;
  };
  /** Top provider for this model */
  topProvider?: {
    contextLength?: number;
    maxCompletionTokens?: number;
    isModerated?: boolean;
  };
  /** Per-request limits */
  perRequestLimits?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

/**
 * Information about a model's supported parameters.
 */
export interface ModelParameterInfo {
  /** Parameter name */
  name: string;
  /** Data type of the parameter */
  type: string;
  /** Description of the parameter */
  description?: string;
  /** Default value if not specified */
  default?: unknown;
  /** Minimum value (for numeric parameters) */
  min?: number;
  /** Maximum value (for numeric parameters) */
  max?: number;
  /** Popularity score (0-1) indicating how often this parameter is used */
  popularity?: number;
}

/**
 * List all available models from OpenRouter.
 *
 * @example
 * ```typescript
 * import { listModels, OpenRouterProvider } from "@schaake/agents";
 *
 * const provider = new OpenRouterProvider();
 * const models = await listModels(provider);
 *
 * // Find Claude models
 * const claudeModels = models.filter(m => m.id.includes("claude"));
 *
 * claudeModels.forEach(model => {
 *   console.log(`${model.id}: ${model.name}`);
 *   console.log(`  Context: ${model.contextLength} tokens`);
 *   console.log(`  Pricing: $${model.pricing?.prompt}/1M prompt tokens`);
 * });
 * ```
 */
export async function listModels(
  provider: OpenRouterProvider,
): Promise<ModelInfo[]> {
  const response = await provider.client.models.list();

  return response.data.map(
    (model): ModelInfo => ({
      id: model.id,
      name: model.name,
      description: model.description,
      contextLength: model.contextLength ?? undefined,
      pricing: model.pricing,
      architecture: model.architecture
        ? {
            modality: model.architecture.modality ?? undefined,
            tokenizer: model.architecture.tokenizer ?? undefined,
            instructType: model.architecture.instructType ?? undefined,
          }
        : undefined,
      topProvider: model.topProvider
        ? {
            contextLength: model.topProvider.contextLength ?? undefined,
            maxCompletionTokens:
              model.topProvider.maxCompletionTokens ?? undefined,
            isModerated: model.topProvider.isModerated ?? undefined,
          }
        : undefined,
      perRequestLimits: model.perRequestLimits ?? undefined,
    }),
  );
}

/**
 * Get the number of available models.
 *
 * @example
 * ```typescript
 * const count = await getModelCount(provider);
 * console.log(`${count} models available`);
 * ```
 */
export async function getModelCount(
  provider: OpenRouterProvider,
): Promise<number> {
  const response = (await provider.client.models.count()) as { count?: number };
  return response.count ?? 0;
}

/**
 * Get supported parameters for a specific model.
 * Returns parameter information with popularity data indicating how often each is used.
 *
 * @example
 * ```typescript
 * import { getModelParameters, OpenRouterProvider } from "@schaake/agents";
 *
 * const provider = new OpenRouterProvider();
 * const params = await getModelParameters(provider, "anthropic/claude-3.5-sonnet");
 *
 * params.forEach(param => {
 *   console.log(`${param.name}: ${param.type}`);
 *   if (param.popularity !== undefined) {
 *     console.log(`  Used by ${(param.popularity * 100).toFixed(1)}% of requests`);
 *   }
 * });
 * ```
 */
export async function getModelParameters(
  provider: OpenRouterProvider,
  model: string,
): Promise<ModelParameterInfo[]> {
  const { author, slug } = parseModelId(model);

  // The SDK requires bearer token authentication for this endpoint
  // SDK types are incomplete for parameters endpoint, requiring runtime type assertions
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- SDK parameters endpoint not fully typed
  const response = await (provider.client.parameters as any).getParameters(
    { bearer: provider.apiKey },
    { author, slug },
  );

  // The SDK returns parameters in a specific format
  // Convert to our ModelParameterInfo format
  const params: ModelParameterInfo[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- SDK response structure varies
  const data = response?.data ?? response;
  if (data && typeof data === "object") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- data is verified as object above
    for (const [name, info] of Object.entries(data)) {
      if (typeof info === "object" && info !== null) {
        const paramInfo = info as Record<string, unknown>;
        params.push({
          name,
          type: typeof paramInfo.type === "string" ? paramInfo.type : "unknown",
          description:
            typeof paramInfo.description === "string"
              ? paramInfo.description
              : undefined,
          default: paramInfo.default,
          min: typeof paramInfo.min === "number" ? paramInfo.min : undefined,
          max: typeof paramInfo.max === "number" ? paramInfo.max : undefined,
          popularity:
            typeof paramInfo.popularity === "number"
              ? paramInfo.popularity
              : undefined,
        });
      }
    }
  }

  return params;
}

/**
 * List available providers on OpenRouter.
 *
 * @example
 * ```typescript
 * const providers = await listProviders(provider);
 * providers.forEach(p => console.log(p.name));
 * ```
 */
export async function listProviders(
  provider: OpenRouterProvider,
): Promise<Array<{ name: string; [key: string]: unknown }>> {
  const response = await provider.client.providers.list();
  return response.data ?? [];
}

/**
 * List endpoints for a specific model.
 * Shows which providers offer this model and their capabilities.
 *
 * @example
 * ```typescript
 * const endpoints = await listModelEndpoints(provider, "anthropic/claude-3.5-sonnet");
 * endpoints.forEach(ep => {
 *   console.log(`${ep.provider}: ${ep.contextLength} context`);
 * });
 * ```
 */
export async function listModelEndpoints(
  provider: OpenRouterProvider,
  model: string,
): Promise<
  Array<{
    name?: string;
    provider?: string;
    contextLength?: number;
    [key: string]: unknown;
  }>
> {
  const { author, slug } = parseModelId(model);

  // The SDK expects author and slug as separate parameters
  // SDK types are incomplete for endpoints, requiring runtime type assertions
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- SDK endpoints not fully typed
  const response = await (provider.client.endpoints as any).list({
    author,
    slug,
  });
  if (Array.isArray(response)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Array.isArray provides sufficient type guard
    return response;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access -- SDK response structure varies
  return response?.data ?? [];
}
