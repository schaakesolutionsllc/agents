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

type ParameterMetadata = Pick<
  ModelParameterInfo,
  "type" | "description" | "min" | "max"
>;

type DefaultParameterValues = {
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  repetitionPenalty?: number | null;
  temperature?: number | null;
  topK?: number | null;
  topP?: number | null;
};

const PARAMETER_METADATA: Record<string, ParameterMetadata> = {
  temperature: {
    type: "number",
    description: "Sampling temperature. Higher values make output more random.",
    min: 0,
    max: 2,
  },
  top_p: {
    type: "number",
    description: "Nucleus sampling threshold.",
    min: 0,
    max: 1,
  },
  top_k: {
    type: "number",
    description: "Limits sampling to the top K tokens.",
    min: 0,
  },
  frequency_penalty: {
    type: "number",
    description: "Penalizes tokens based on frequency in generated text.",
    min: -2,
    max: 2,
  },
  presence_penalty: {
    type: "number",
    description: "Penalizes tokens that have already appeared in generated text.",
    min: -2,
    max: 2,
  },
  repetition_penalty: {
    type: "number",
    description: "Penalizes repeated tokens.",
  },
  max_tokens: {
    type: "integer",
    description: "Maximum number of tokens to generate.",
    min: 1,
  },
  max_completion_tokens: {
    type: "integer",
    description: "Maximum number of completion tokens to generate.",
    min: 1,
  },
  logit_bias: {
    type: "object",
    description: "Biases likelihood of specified tokens.",
  },
  logprobs: {
    type: "boolean",
    description: "Whether to return log probabilities.",
  },
  top_logprobs: {
    type: "integer",
    description: "Number of top token log probabilities to return.",
    min: 0,
  },
  seed: {
    type: "integer",
    description: "Seed for deterministic sampling where supported.",
  },
  response_format: {
    type: "object",
    description: "Response format configuration.",
  },
  structured_outputs: {
    type: "boolean",
    description: "Whether structured outputs are supported.",
  },
  stop: {
    type: "string | string[]",
    description: "Stop sequence or sequences.",
  },
  tools: {
    type: "array",
    description: "Tool definitions available to the model.",
  },
  tool_choice: {
    type: "string | object",
    description: "Controls whether and which tool is called.",
  },
  parallel_tool_calls: {
    type: "boolean",
    description: "Whether the model can call tools in parallel.",
  },
  include_reasoning: {
    type: "boolean",
    description: "Whether to include reasoning output.",
  },
  reasoning: {
    type: "object",
    description: "Reasoning configuration.",
  },
  reasoning_effort: {
    type: "string",
    description: "Reasoning effort level.",
  },
  web_search_options: {
    type: "object",
    description: "Web search configuration.",
  },
  verbosity: {
    type: "string",
    description: "Verbosity level for supported models.",
  },
};

function getDefaultParameterValue(
  defaultParameters: DefaultParameterValues | null | undefined,
  name: string,
): unknown {
  if (!defaultParameters) return undefined;

  switch (name) {
    case "frequency_penalty":
      return defaultParameters.frequencyPenalty ?? undefined;
    case "presence_penalty":
      return defaultParameters.presencePenalty ?? undefined;
    case "repetition_penalty":
      return defaultParameters.repetitionPenalty ?? undefined;
    case "temperature":
      return defaultParameters.temperature ?? undefined;
    case "top_k":
      return defaultParameters.topK ?? undefined;
    case "top_p":
      return defaultParameters.topP ?? undefined;
    default:
      return undefined;
  }
}

/**
 * List all available models from OpenRouter.
 *
 * @example
 * ```typescript
 * import { listModels, OpenRouterProvider } from "@schaake-solutions/agents";
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
 * import { getModelParameters, OpenRouterProvider } from "@schaake-solutions/agents";
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
  const response = await provider.client.models.list();
  const modelInfo = response.data.find(
    (availableModel) =>
      availableModel.id === model || availableModel.canonicalSlug === model,
  );

  if (!modelInfo) {
    return [];
  }

  return modelInfo.supportedParameters.map((parameter): ModelParameterInfo => {
    const name = String(parameter);
    const metadata = PARAMETER_METADATA[name];

    return {
      name,
      type: metadata?.type ?? "unknown",
      description: metadata?.description,
      default: getDefaultParameterValue(modelInfo.defaultParameters, name),
      min: metadata?.min,
      max: metadata?.max,
    };
  });
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
