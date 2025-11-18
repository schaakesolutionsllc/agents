// src/web-search.ts

import { z } from "zod/v4";
import type { OpenRouterProvider } from "./openrouter.js";

/**
 * Search engine options for web search.
 * - native: OpenRouter's default web search
 * - exa: Exa search engine (more advanced, better for technical queries)
 */
export type SearchEngine = "native" | "exa";

/**
 * Search context size - controls how much context from search results is included.
 * - low: Minimal context, faster and cheaper
 * - medium: Balanced context
 * - high: Extensive context, better for complex queries
 */
export type SearchContextSize = "low" | "medium" | "high";

/**
 * Options for web search.
 *
 * @template T - The type that the schema parses to (if using structured output)
 */
export interface WebSearchOptions<T = string> {
  /**
   * The search query or question to answer.
   */
  query: string;

  /**
   * Model to use for generating the response.
   */
  model: string;

  /**
   * Optional Zod schema for structured output.
   * If not provided, returns plain text.
   *
   * @example
   * ```typescript
   * const schema = z.object({
   *   answer: z.string(),
   *   sources: z.array(z.string()),
   *   confidence: z.number(),
   * });
   * ```
   */
  schema?: z.ZodType<T>;

  /**
   * Search engine to use.
   * - exa: Exa search engine (recommended, works with most models)
   * - native: OpenRouter's native search (limited model support)
   * @default "exa"
   */
  engine?: SearchEngine;

  /**
   * Maximum number of search results to retrieve.
   */
  maxResults?: number;

  /**
   * Size of search context to include.
   * @default "medium"
   */
  searchContextSize?: SearchContextSize;

  /**
   * System instructions for the model.
   */
  instructions?: string;

  /**
   * User prompt to provide additional context.
   * Appended after the query.
   */
  prompt?: string;

  /**
   * Sampling temperature (0-2).
   * @default 0
   */
  temperature?: number;

  /**
   * Maximum tokens to generate.
   */
  maxOutputTokens?: number;
}

/**
 * Result of web search including the response and metadata.
 *
 * @template T - The type of the response data
 */
export interface WebSearchResult<T> {
  /** The response data (structured if schema provided, otherwise string) */
  data: T;

  /** Token usage statistics */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };

  /** Raw response for debugging */
  raw?: any;
}

/**
 * Search the web and generate a grounded response using the OpenRouter Responses API.
 *
 * This function uses the web plugin to search for real-time information and
 * generate responses grounded in actual web content.
 *
 * @template T - The type that the schema parses to
 * @param provider - The OpenRouter provider instance
 * @param options - Search options including query, model, and optional schema
 * @returns Promise resolving to the search result
 * @throws When search fails or output doesn't match schema
 *
 * @example
 * ```typescript
 * import { searchWithWeb, OpenRouterProvider } from "schaake-agents";
 * import { z } from "zod";
 *
 * const provider = new OpenRouterProvider();
 *
 * // Simple text response
 * const result = await searchWithWeb(provider, {
 *   query: "What are the new features in Next.js 15?",
 *   model: "anthropic/claude-sonnet-4-20250514",
 *   engine: "exa",
 *   maxResults: 10,
 * });
 *
 * console.log(result.data); // Grounded text response
 *
 * // Structured response
 * const newsSchema = z.object({
 *   features: z.array(z.object({
 *     name: z.string(),
 *     description: z.string(),
 *   })),
 *   releaseDate: z.string().optional(),
 * });
 *
 * const structured = await searchWithWeb(provider, {
 *   query: "What are the new features in Next.js 15?",
 *   model: "anthropic/claude-sonnet-4-20250514",
 *   schema: newsSchema,
 *   engine: "exa",
 * });
 *
 * console.log(structured.data.features);
 * ```
 */
export async function searchWithWeb<T = string>(
  provider: OpenRouterProvider,
  options: WebSearchOptions<T>,
): Promise<WebSearchResult<T>> {
  const {
    query,
    model,
    schema,
    engine = "exa",
    maxResults,
    searchContextSize = "medium",
    instructions,
    prompt,
    temperature = 0,
    maxOutputTokens,
  } = options;

  // Anti-hallucination guidance for grounded responses
  const groundingGuidance =
    "IMPORTANT: Base your response ONLY on the information found in the web search results. " +
    "DO NOT GUESS OR HALLUCINATE. If the search results don't contain the information needed, " +
    "clearly state that. Always cite or reference the sources when possible.";

  // Build the system instructions
  const baseInstructions =
    instructions ||
    "Answer the user's question based on the web search results. Be accurate and comprehensive.";

  const systemInstructions = `${baseInstructions}\n\n${groundingGuidance}`;

  // Build the user input
  const userInput = prompt ? `${query}\n\n${prompt}` : query;

  // Build text format config (for structured output)
  const textConfig = schema
    ? {
        format: {
          type: "json_schema" as const,
          name: "web_search_response",
          description: "Structured response from web search",
          schema: z.toJSONSchema(schema, { reused: "inline" }),
          strict: true,
        },
      }
    : undefined;

  // Build the request using OpenRouter Responses API format
  const request = {
    model,
    input: userInput,
    instructions: systemInstructions,
    ...(textConfig && { text: textConfig }),
    plugins: [
      {
        id: "web" as const,
        engine,
        ...(maxResults !== undefined && { maxResults }),
        searchContextSize,
      },
    ],
    temperature,
    ...(maxOutputTokens !== undefined && { maxOutputTokens }),
    stream: false as const,
  };

  // Call the Responses API
  const response = await provider.client.beta.responses.send(request);

  // Extract the text output from the response
  let rawContent = response.outputText;

  if (!rawContent) {
    // Extract text from the output array
    for (const item of response.output) {
      if ("type" in item && item.type === "message" && "content" in item) {
        const messageItem = item as {
          type: string;
          content: Array<{ type: string; text?: string }>;
        };
        for (const content of messageItem.content) {
          if (content.type === "output_text" && content.text) {
            rawContent = content.text;
            break;
          }
        }
      }
      if (rawContent) break;
    }
  }

  if (!rawContent) {
    throw new Error(
      `searchWithWeb: No output text in response. ` +
        `Output items: ${JSON.stringify(response.output.map((o) => ("type" in o ? o.type : "unknown")))}`,
    );
  }

  // Parse and validate the response
  let data: T;

  if (schema) {
    // Parse as structured output
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch?.[1]) {
        try {
          parsedJson = JSON.parse(jsonMatch[1]);
        } catch {
          throw new Error(
            `searchWithWeb: Failed to parse response as JSON. Raw content: ${rawContent.substring(0, 500)}`,
          );
        }
      } else {
        throw new Error(
          `searchWithWeb: Failed to parse response as JSON. Raw content: ${rawContent.substring(0, 500)}`,
        );
      }
    }

    // Validate against schema
    try {
      data = schema.parse(parsedJson);
    } catch (validationError) {
      const errorMessage =
        validationError instanceof Error
          ? validationError.message
          : "Unknown validation error";
      throw new Error(
        `searchWithWeb: Response does not match schema. ${errorMessage}`,
      );
    }
  } else {
    // Return as plain text
    data = rawContent as T;
  }

  // Extract usage from response
  const usage = response.usage
    ? {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
      }
    : undefined;

  return {
    data,
    usage,
    raw: response,
  };
}
