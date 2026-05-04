// src/extraction.ts

import { z } from "zod";
import { ERROR_PREFIXES } from "./agent.js";
import type { OpenRouterProvider } from "./openrouter.js";

/**
 * PDF processing engine options.
 * - pdf-text: Free, works well for structured PDFs
 * - mistral-ocr: Paid, better for scanned documents
 * - native: Uses model's native file handling
 */
export type PdfEngine = "pdf-text" | "mistral-ocr" | "native";

/**
 * Options for document extraction.
 *
 * @template T - The type that the schema parses to
 */
export interface ExtractDocumentOptions<T> {
  /**
   * The document to extract data from.
   * Provide either fileData (base64 data URI) or fileUrl (public URL).
   */
  document: {
    /** Filename with extension (e.g., "invoice.pdf") */
    filename: string;
    /** File data as a data URI (e.g., "data:application/pdf;base64,...") */
    fileData?: string;
    /** Public URL to the file */
    fileUrl?: string;
  };

  /**
   * Zod schema defining the structure of the extracted data.
   * The model will be constrained to return data matching this schema.
   *
   * @example
   * ```typescript
   * const schema = z.object({
   *   invoiceNumber: z.string(),
   *   total: z.number(),
   *   lineItems: z.array(z.object({
   *     description: z.string(),
   *     amount: z.number()
   *   }))
   * });
   * ```
   */
  schema: z.ZodType<T>;

  /**
   * Model to use for extraction.
   * Must be a vision-capable model (e.g., "anthropic/claude-sonnet-4-20250514").
   */
  model: string;

  /**
   * System instructions to guide the extraction behavior.
   * Sets the overall extraction approach and constraints.
   *
   * @example
   * ```typescript
   * instructions: "Be precise with numbers. If a value is unclear, return null."
   * ```
   */
  instructions?: string;

  /**
   * User prompt to provide context about what to extract.
   * This is sent alongside the document as user input.
   *
   * @example
   * ```typescript
   * prompt: "Extract all line items from this invoice, including quantities and unit prices"
   * ```
   */
  prompt?: string;

  /**
   * PDF processing engine to use.
   * @default "native"
   */
  pdfEngine?: PdfEngine;

  /**
   * Sampling temperature (0-2).
   * Lower values are more deterministic, higher values more creative.
   * @default 0
   */
  temperature?: number;

  /**
   * Maximum tokens to generate.
   * Increase for documents that may produce large structured outputs.
   */
  maxOutputTokens?: number;
}

/**
 * Result of document extraction including the extracted data and metadata.
 *
 * @template T - The type of the extracted data
 */
export interface ExtractDocumentResult<T> {
  /** The extracted and validated data */
  data: T;

  /** Token usage statistics */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };

  /** Raw response for debugging */
  raw?: unknown;
}

/**
 * Extract structured data from a document using the OpenRouter Responses API.
 *
 * This function provides a simple, direct API for document extraction with
 * guaranteed structured output. The response is validated against the provided
 * Zod schema, ensuring type safety.
 *
 * @template T - The type that the schema parses to
 * @param provider - The OpenRouter provider instance
 * @param options - Extraction options including document, schema, and model
 * @returns Promise resolving to the extracted data
 * @throws When extraction fails or output doesn't match schema
 *
 * @example
 * ```typescript
 * import { extractDocument, OpenRouterProvider } from "schaake-agents";
 * import { z } from "zod";
 * import fs from "fs";
 *
 * const provider = new OpenRouterProvider();
 *
 * // Define the extraction schema
 * const invoiceSchema = z.object({
 *   invoiceNumber: z.string(),
 *   date: z.string(),
 *   vendor: z.object({
 *     name: z.string(),
 *     address: z.string().optional(),
 *   }),
 *   lineItems: z.array(z.object({
 *     description: z.string(),
 *     quantity: z.number(),
 *     unitPrice: z.number(),
 *     total: z.number(),
 *   })),
 *   subtotal: z.number(),
 *   tax: z.number().optional(),
 *   total: z.number(),
 * });
 *
 * // Extract data from PDF
 * const pdfBase64 = fs.readFileSync("invoice.pdf").toString("base64");
 *
 * const result = await extractDocument(provider, {
 *   document: {
 *     filename: "invoice.pdf",
 *     fileData: `data:application/pdf;base64,${pdfBase64}`,
 *   },
 *   schema: invoiceSchema,
 *   model: "anthropic/claude-sonnet-4-20250514",
 *   prompt: "Extract all invoice details including line items",
 * });
 *
 * console.log(result.data.invoiceNumber);
 * console.log(result.data.total);
 * ```
 */
export async function extractDocument<T>(
  provider: OpenRouterProvider,
  options: ExtractDocumentOptions<T>,
): Promise<ExtractDocumentResult<T>> {
  const {
    document,
    schema,
    model,
    instructions,
    prompt,
    pdfEngine = "native",
    temperature = 0,
    maxOutputTokens,
  } = options;

  // Validate document has either fileData or fileUrl
  if (!document.fileData && !document.fileUrl) {
    throw new Error(
      `${ERROR_PREFIXES.EXTRACTION} document must have either fileData or fileUrl`,
    );
  }

  // Convert Zod schema to JSON Schema for responseFormat
  const jsonSchema = z.toJSONSchema(schema, {
    reused: "inline", // Inline all refs for provider compatibility
  });

  // Anti-hallucination guidance - always included
  const antiHallucinationGuidance =
    "IMPORTANT: Only extract information that is explicitly present in the document. " +
    "DO NOT GUESS OR HALLUCINATE. If a field cannot be determined from the document, " +
    "use null for optional fields or indicate uncertainty. Never invent or assume data.";

  // Build the system instructions
  const baseInstructions =
    instructions ||
    "Extract all relevant information from this document and return it as JSON matching the specified schema.";

  const systemInstructions = `${baseInstructions}\n\n${antiHallucinationGuidance}`;

  // Build the user prompt
  const userPrompt =
    prompt ||
    "Please analyze this document and extract the requested information.";

  // Build the request using OpenRouter Responses API format
  const request = {
    model,
    input: [
      {
        type: "message" as const,
        role: "user" as const,
        content: [
          {
            type: "input_file" as const,
            filename: document.filename,
            ...(document.fileData && { fileData: document.fileData }),
            ...(document.fileUrl && { fileUrl: document.fileUrl }),
          },
          {
            type: "input_text" as const,
            text: userPrompt,
          },
        ],
      },
    ],
    instructions: systemInstructions,
    text: {
      format: {
        type: "json_schema" as const,
        name: "document_extraction",
        description: "Extracted data from the document",
        schema: jsonSchema,
        strict: true,
      },
    },
    plugins: [
      {
        id: "file-parser" as const,
        pdf: {
          engine: pdfEngine,
        },
      },
    ],
    temperature,
    ...(maxOutputTokens !== undefined && { maxOutputTokens }),
    stream: false as const,
  };

  // Call the Responses API
  const response = await provider.client.beta.responses.send({
    responsesRequest: request,
  });

  // Extract the text output from the response
  // First try outputText (convenience field), then extract from output array
  let rawContent = response.outputText;

  if (!rawContent) {
    // Extract text from the output array
    // Find message items and extract their text content
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
      `${ERROR_PREFIXES.EXTRACTION} No output text in response. ` +
        `Output items: ${JSON.stringify(response.output.map((o) => ("type" in o ? o.type : "unknown")))}`,
    );
  }

  // Parse the JSON response
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch {
    // Try to extract JSON from markdown code blocks (fallback for some models)
    const jsonMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch?.[1]) {
      try {
        parsedJson = JSON.parse(jsonMatch[1]);
      } catch {
        throw new Error(
          `${ERROR_PREFIXES.EXTRACTION} Failed to parse response as JSON. Raw content: ${rawContent.substring(0, 500)}`,
        );
      }
    } else {
      throw new Error(
        `${ERROR_PREFIXES.EXTRACTION} Failed to parse response as JSON. Raw content: ${rawContent.substring(0, 500)}`,
      );
    }
  }

  // Validate against the schema
  let validatedData: T;
  try {
    validatedData = schema.parse(parsedJson);
  } catch (validationError) {
    const errorMessage =
      validationError instanceof Error
        ? validationError.message
        : "Unknown validation error";
    throw new Error(
      `${ERROR_PREFIXES.EXTRACTION} Response does not match schema. ${errorMessage}`,
    );
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
    data: validatedData,
    usage,
    raw: response,
  };
}

/**
 * Simple extraction function that returns only the extracted data.
 * Use this when you don't need usage statistics or the raw response.
 *
 * @template T - The type that the schema parses to
 * @param provider - The OpenRouter provider instance
 * @param options - Extraction options
 * @returns Promise resolving to the extracted data
 *
 * @example
 * ```typescript
 * const data = await extractDocumentSimple(provider, {
 *   document: {
 *     filename: "invoice.pdf",
 *     fileData: `data:application/pdf;base64,${pdfBase64}`,
 *   },
 *   schema: invoiceSchema,
 *   model: "anthropic/claude-sonnet-4-20250514",
 * });
 *
 * console.log(data.total);
 * ```
 */
export async function extractDocumentSimple<T>(
  provider: OpenRouterProvider,
  options: ExtractDocumentOptions<T>,
): Promise<T> {
  const result = await extractDocument(provider, options);
  return result.data;
}
