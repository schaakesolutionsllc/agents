// src/agent.ts
import {
  Agent,
  AgentConfig,
  AgentContext,
  AgentRunOptions,
  AgentRunResult,
  AgentStream,
  ChatRequest,
  ChatStreamChunk,
  ChatTool,
  ChatToolCall,
  Message,
  ResponseFormat,
  StreamChunk,
  ToolDefinition,
  ToolSchema,
} from "./types.js";
import { z } from "zod";

/**
 * Default maximum number of tool iterations before agent stops
 */
export const DEFAULT_MAX_TOOL_ITERATIONS = 4;

/**
 * Error message prefixes for consistent error reporting
 */
export const ERROR_PREFIXES = {
  AGENT: "createAgent:",
  OPENROUTER: "OpenRouterProvider:",
  EXTRACTION: "extractDocument:",
  WEB_SEARCH: "searchWithWeb:",
} as const;

/**
 * Validation error detail for a single field.
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
  expected?: string;
  received?: string;
}

/**
 * Validates tool arguments against the tool's JSON schema.
 *
 * Performs runtime validation to ensure arguments match the expected schema
 * before tool execution. Uses basic JSON Schema validation patterns for
 * type checking and required field validation.
 *
 * @param toolName - Name of the tool (for error messages)
 * @param args - The arguments object to validate
 * @param schema - The tool's schema containing parameter definitions
 * @throws Error when validation fails with detailed field-level error information
 *
 * @example
 * ```typescript
 * validateToolArguments("get_weather", { location: "SF" }, weatherToolSchema);
 * // Throws if 'location' is not a string or missing when required
 * ```
 *
 * @internal
 */
export function validateToolArguments(
  toolName: string,
  args: unknown,
  schema: ToolSchema,
): void {
  const errors: ValidationErrorDetail[] = [];
  const params = schema.parameters;

  // Handle edge case: args is not an object
  if (typeof args !== "object" || args === null) {
    throw new Error(
      `${ERROR_PREFIXES.AGENT} Tool argument validation failed for '${toolName}': Expected object, received ${args === null ? "null" : typeof args}`,
    );
  }

  const argsObj = args as Record<string, unknown>;

  // Check required fields
  const requiredFields = params.required as string[] | undefined;
  if (requiredFields && Array.isArray(requiredFields)) {
    for (const field of requiredFields) {
      if (!(field in argsObj)) {
        errors.push({
          field,
          message: "Missing required field",
          expected: "value",
          received: "undefined",
        });
      }
    }
  }

  // Check types for provided fields
  const properties = params.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (properties) {
    for (const [field, value] of Object.entries(argsObj)) {
      const propSchema = properties[field];
      if (propSchema) {
        const expectedType = propSchema.type as string | undefined;
        if (expectedType) {
          const actualType = getJsonSchemaType(value);
          if (!isTypeMatch(expectedType, actualType, value)) {
            errors.push({
              field,
              message: `Invalid type`,
              expected: expectedType,
              received: actualType,
            });
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    const errorMessages = errors.map((e) => {
      if (e.expected && e.received) {
        return `${e.field}: ${e.message} (expected ${e.expected}, received ${e.received})`;
      }
      return `${e.field}: ${e.message}`;
    });
    throw new Error(
      `${ERROR_PREFIXES.AGENT} Tool argument validation failed for '${toolName}': ${errorMessages.join("; ")}`,
    );
  }
}

/**
 * Gets the JSON Schema type name for a JavaScript value.
 *
 * @param value - The value to get the type for
 * @returns The JSON Schema type name
 *
 * @internal
 */
function getJsonSchemaType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Checks if an actual type matches the expected JSON Schema type.
 *
 * @param expected - The expected JSON Schema type
 * @param actual - The actual type of the value
 * @param value - The actual value (for integer checking)
 * @returns True if types match
 *
 * @internal
 */
function isTypeMatch(
  expected: string,
  actual: string,
  value: unknown,
): boolean {
  // Direct match
  if (expected === actual) return true;

  // Integer is a special case - it's a number with no fractional part
  if (expected === "integer" && actual === "number") {
    return Number.isInteger(value);
  }

  return false;
}

/**
 * Internal interface for accumulating streaming tool calls.
 * Tool calls are streamed incrementally and need to be accumulated.
 */
interface AccumulatedToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Accumulates streaming tool call deltas into complete tool calls.
 * The OpenRouter SDK streams tool calls incrementally with partial data.
 */
function accumulateToolCalls(
  accumulated: Map<number, AccumulatedToolCall>,
  toolCallDeltas: ChatStreamChunk["toolCalls"],
): void {
  if (!toolCallDeltas) return;

  for (const delta of toolCallDeltas) {
    const existing = accumulated.get(delta.index);
    if (existing) {
      // Accumulate arguments
      if (delta.function?.arguments) {
        existing.function.arguments += delta.function.arguments;
      }
      // Update name if provided (usually only in first chunk)
      if (delta.function?.name) {
        existing.function.name = delta.function.name;
      }
    } else {
      // Create new accumulated tool call
      accumulated.set(delta.index, {
        id: delta.id ?? "",
        type: "function",
        function: {
          name: delta.function?.name ?? "",
          arguments: delta.function?.arguments ?? "",
        },
      });
    }
  }
}

/**
 * Converts tool definitions to the provider-compatible ChatTool format.
 * Maps the internal ToolDefinition structure to the OpenAI-compatible format
 * expected by LLM providers.
 *
 * @param tools - Array of tool definitions to convert
 * @returns Array of ChatTools in provider format, or undefined if no tools
 *
 * @internal
 */
function toChatTools(
  tools: ToolDefinition[] | undefined,
): ChatTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.schema.name,
      description: t.schema.description,
      parameters: t.schema.parameters,
    },
  }));
}

/**
 * Builds the initial message array from agent configuration and user input.
 * Creates the starting conversation with optional system prompt and user message.
 *
 * If the config has an inputSchema, the input is validated/parsed through it.
 * If buildInputMessages is provided, it's used to create the user messages;
 * otherwise, the input is converted to a single user message.
 *
 * @template I - The input type
 * @param config - The agent configuration
 * @param input - The user input to convert to messages
 * @returns Array of initial messages for the conversation
 *
 * @internal
 */
function buildInitialMessages<I, O>(
  config: AgentConfig<I, O>,
  input: I,
): Message[] {
  const msgs: Message[] = [];
  if (config.systemPrompt) {
    msgs.push({ role: "system", content: config.systemPrompt });
  }

  const value = config.inputSchema ? config.inputSchema.parse(input) : input;

  if (config.buildInputMessages) {
    msgs.push(...config.buildInputMessages(value));
  } else {
    msgs.push({
      role: "user",
      content: typeof value === "string" ? value : JSON.stringify(value),
    });
  }

  return msgs;
}

/**
 * Executes tool calls requested by the LLM and returns tool result messages.
 *
 * For each tool call:
 * 1. Finds the matching tool definition
 * 2. Parses the JSON arguments
 * 3. Executes the handler with arguments and context
 * 4. Creates a tool result message with the result or error
 *
 * Errors are handled gracefully:
 * - Missing tools return an error message to the LLM
 * - Invalid JSON arguments return an error message
 * - Handler errors are caught and returned as error messages
 *
 * Events are emitted via ctx.onEvent for each tool call and result/error.
 *
 * @param tools - Available tool definitions
 * @param toolCalls - Tool calls from the LLM to execute
 * @param ctx - Agent context with logging and event callbacks
 * @returns Array of tool result messages to add to conversation
 *
 * @internal
 */
async function runToolCalls(
  tools: ToolDefinition[],
  toolCalls: ChatToolCall[],
  ctx: AgentContext,
): Promise<Message[]> {
  const toolMessages: Message[] = [];

  for (const toolCall of toolCalls) {
    const toolCallId = toolCall.id;
    const name = toolCall.function.name;
    // Default to empty object if arguments are undefined, null, or empty string
    // This handles the case where LLM calls a tool with no arguments
    const argsJson = toolCall.function.arguments || "{}";

    const def = tools.find((t) => t.schema.name === name);
    if (!def) {
      ctx.logger?.({
        type: "tool_result",
        data: {
          name,
          error: "Tool not found",
        },
      });

      toolMessages.push({
        role: "tool",
        toolCallId,
        content: JSON.stringify({ error: "Tool not found" }),
      });
      continue;
    }

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(argsJson) as Record<string, unknown>;
    } catch {
      ctx.logger?.({
        type: "tool_result",
        data: { name, error: "Invalid JSON arguments", raw: argsJson },
      });

      toolMessages.push({
        role: "tool",
        toolCallId,
        content: JSON.stringify({ error: "Invalid arguments JSON" }),
      });
      continue;
    }

    ctx.logger?.({ type: "tool_call", data: { name, args } });

    // Emit typed tool_call event
    ctx.onEvent?.({
      type: "tool_call",
      name,
      args,
    });

    try {
      // Validate arguments against tool schema before execution
      validateToolArguments(name, args, def.schema);

      const result = await def.handler(args, ctx);

      ctx.logger?.({ type: "tool_result", data: { name, result } });

      // Emit typed tool_result event
      ctx.onEvent?.({
        type: "tool_result",
        name,
        result,
      });

      toolMessages.push({
        role: "tool",
        toolCallId,
        content: JSON.stringify(result ?? {}),
      });
    } catch (error) {
      // Extract error message
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error occurred";

      // Extract stack trace for logging (if available)
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log the error with full context
      ctx.logger?.({
        type: "tool_result",
        data: {
          name,
          error: errorMessage,
          stack: errorStack,
          args,
        },
      });

      // Emit typed tool_error event
      ctx.onEvent?.({
        type: "tool_error",
        name,
        error: errorMessage,
      });

      // Format error result for the model
      // Include tool name and error message, but not stack trace
      const errorResult = {
        error: `Tool '${name}' failed: ${errorMessage}`,
        status: "error",
      };

      toolMessages.push({
        role: "tool",
        toolCallId,
        content: JSON.stringify(errorResult),
      });
    }
  }

  return toolMessages;
}

/**
 * Builds the complete configuration object for a provider chat call.
 * Consolidates all sampling, token, metadata, and routing parameters
 * into a single call configuration object.
 *
 * @template I - The input type of the agent
 * @template O - The output type of the agent
 * @param config - The agent configuration
 * @param messages - The message array to send to the provider
 * @param chatTools - The ChatTool[] or undefined for tool calls
 * @param stream - Whether this is a streaming call
 * @param responseFormat - Response format for structured outputs
 * @param metadata - Runtime metadata for this execution
 * @returns Complete provider call configuration object
 *
 * @internal
 */
function buildProviderCallConfig<I, O>(
  config: AgentConfig<I, O>,
  messages: Message[],
  chatTools: ChatTool[] | undefined,
  stream: boolean,
  responseFormat: ResponseFormat | undefined,
  metadata: Record<string, unknown> | undefined,
): ChatRequest {
  return {
    model: config.model.model,
    models: config.model.models,
    messages,
    tools: chatTools,
    stream,
    // Sampling parameters
    temperature: config.model.temperature,
    topP: config.model.topP,
    frequencyPenalty: config.model.frequencyPenalty,
    presencePenalty: config.model.presencePenalty,
    seed: config.model.seed,
    stop: config.model.stop,
    // Token limits
    maxTokens: config.model.maxTokens,
    // Metadata and output
    metadata,
    responseFormat,
    // Provider routing
    providerOptions: config.model.providerOptions,
    // Reasoning
    reasoning: config.model.reasoning,
  };
}

/**
 * Creates an agent execution context with unique ID and event handlers.
 *
 * The context is passed to all tool handlers and contains:
 * - runId: Unique identifier for this execution
 * - metadata: Optional metadata for logging/tracking
 * - logger: Optional logging callback
 * - onEvent: Event emission callback for monitoring
 *
 * @param metadata - Optional metadata including logger callback
 * @param onEvent - Optional event handler for agent events
 * @returns AgentContext with all required properties initialized
 *
 * @internal
 */
function createContext(
  metadata: AgentRunOptions["metadata"],
  onEvent: AgentRunOptions["onEvent"],
): AgentContext {
  // Extract logger from metadata if provided
  const logger =
    metadata && "logger" in metadata && typeof metadata.logger === "function"
      ? (metadata.logger as (event: import("./types.js").AgentLogEvent) => void)
      : undefined;

  return {
    runId: crypto.randomUUID(),
    metadata,
    logger,
    onEvent,
  };
}

/**
 * Builds JSON schema response format from an output schema.
 *
 * Converts a Zod schema into OpenAI-compatible JSON schema format
 * with inline refs for provider compatibility. Used when the agent
 * is configured with an outputSchema for structured outputs.
 *
 * @template I - The input type
 * @template O - The output type
 * @param config - Agent configuration containing name and outputSchema
 * @returns ResponseFormat object suitable for provider chat calls,
 *          or undefined if no outputSchema is configured
 *
 * @internal
 */
function buildResponseFormat<I, O>(
  config: AgentConfig<I, O>,
): ResponseFormat | undefined {
  if (!config.outputSchema) return undefined;

  return {
    type: "json_schema" as const,
    jsonSchema: {
      name: config.name.replace(/[^a-zA-Z0-9_-]/g, "_"),
      description: `Structured output for ${config.name}`,
      schema: z.toJSONSchema(config.outputSchema as z.ZodType, {
        reused: "inline", // Inline all refs for OpenRouter compatibility
      }),
      strict: true,
    },
  };
}

/**
 * Parses raw model output with support for structured and raw outputs.
 *
 * When outputSchema is configured:
 * 1. Attempts direct JSON parse of rawContent
 * 2. Falls back to extracting JSON from markdown code blocks
 * 3. Logs and throws helpful error if both fail
 * 4. Validates parsed JSON against outputSchema
 *
 * When no outputSchema: returns rawContent as-is (cast to output type)
 *
 * Handles common LLM behavior where structured output may be wrapped
 * in markdown code blocks or returned as raw JSON.
 *
 * @template I - The input type
 * @template O - The expected output type
 * @param rawContent - Raw text from the model
 * @param config - Agent configuration with optional outputSchema
 * @param ctx - Agent context for logging
 * @returns Parsed output validated against schema, or raw content if no schema
 * @throws Error when JSON parsing fails (when outputSchema is configured)
 *
 * @internal
 */
function parseStructuredOutput<I, O>(
  rawContent: string,
  config: AgentConfig<I, O>,
  ctx: AgentContext,
): O {
  if (!config.outputSchema) {
    return rawContent as unknown as O;
  }

  const parseJsonContent = (): unknown => {
    try {
      return JSON.parse(rawContent) as unknown;
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch?.[1]) {
        try {
          return JSON.parse(jsonMatch[1]) as unknown;
        } catch {
          // Fall through to error
        }
      }

      // If we have an output schema but can't parse JSON, throw a helpful error
      ctx.logger?.({
        type: "final",
        data: {
          content: rawContent,
          error: "Failed to parse JSON",
          parseError:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        },
      });

      throw new Error(
        `${ERROR_PREFIXES.AGENT} Failed to parse structured output as JSON. Raw content: ${rawContent.substring(0, 200)}${rawContent.length > 200 ? "..." : ""}`,
      );
    }
  };

  return config.outputSchema.parse(parseJsonContent());
}

/**
 * Creates an agent instance with the given configuration.
 *
 * The agent provides three execution methods:
 * - `run()`: Simple execution returning only the output
 * - `runWithHistory()`: Execution returning output with full conversation history
 * - `stream()`: Streaming execution yielding chunks as they arrive
 *
 * The agent executes in a tool-calling loop:
 * 1. Send messages to the LLM
 * 2. If LLM requests tool calls, execute them and continue
 * 3. When LLM finishes, parse and return the output
 *
 * @template I - Input type the agent accepts
 * @template O - Output type the agent returns
 *
 * @param config - Configuration defining the agent's behavior
 * @returns An Agent instance with run, runWithHistory, and stream methods
 *
 * @throws Error when max tool iterations exceeded without completion
 * @throws Error when output schema validation fails
 * @throws Error when JSON parsing fails for structured output
 *
 * @example
 * ```typescript
 * import { createAgent } from "@schaakesolutionsllc/agents";
 * import { z } from "zod";
 *
 * // Simple agent with string output
 * const simpleAgent = createAgent({
 *   name: "simple",
 *   model: {
 *     provider: openRouterProvider,
 *     model: "anthropic/claude-3.5-sonnet"
 *   },
 *   systemPrompt: "You are a helpful assistant."
 * });
 *
 * const response = await simpleAgent.run("Hello!");
 *
 * // Agent with structured output
 * const weatherSchema = z.object({
 *   temperature: z.number(),
 *   condition: z.string()
 * });
 *
 * const weatherAgent = createAgent({
 *   name: "weather",
 *   model: modelConfig,
 *   tools: [getWeatherTool],
 *   outputSchema: weatherSchema
 * });
 *
 * const { temperature, condition } = await weatherAgent.run("Weather in SF?");
 * ```
 *
 * @see AgentConfig - Configuration options
 * @see Agent - The returned agent interface
 */
export function createAgent<I = unknown, O = unknown>(
  config: AgentConfig<I, O>,
): Agent<I, O> {
  /**
   * Execute the agent and return only the output.
   *
   * Runs the agent's tool-calling loop until completion, then parses
   * and returns the output. Use this for simple cases where you only
   * need the final result.
   *
   * @param input - The input to process
   * @param options - Optional execution options
   * @returns Promise resolving to the parsed output
   *
   * @throws Error when max iterations exceeded
   * @throws Error when output parsing fails
   * @throws Error if stream option is true (not supported via run)
   */
  async function run(input: I, options: AgentRunOptions = {}): Promise<O> {
    const {
      stream = false,
      maxToolIterations = DEFAULT_MAX_TOOL_ITERATIONS,
      metadata,
      onEvent,
    } = options;
    if (stream) {
      // For now, only non-streaming is implemented
      // You can add a `runStream` method later that uses provider.chatStream
      throw new Error(
        `${ERROR_PREFIXES.AGENT} Streaming not implemented yet in run`,
      );
    }

    const ctx = createContext(metadata, onEvent);
    const messages = buildInitialMessages(config, input);
    const tools = config.tools ?? [];
    const chatTools = toChatTools(tools);
    const responseFormat = buildResponseFormat(config);

    for (let i = 0; i < maxToolIterations; i += 1) {
      ctx.logger?.({
        type: "model_call",
        data: { iteration: i, messages, tools: !!chatTools },
      });

      // Emit typed model_call event before LLM call
      ctx.onEvent?.({
        type: "model_call",
        iteration: i,
        messages: [...messages], // Copy to avoid mutation issues
      });

      const res = await config.model.provider.chat(
        buildProviderCallConfig(
          config,
          messages,
          chatTools,
          false,
          responseFormat,
          metadata,
        ),
      );

      const assistantMsg = res.message;
      const toolCalls = assistantMsg.toolCalls;
      const finishReason = res.finishReason;

      // Add assistant message to history (with tool calls if present)
      messages.push({
        role: "assistant",
        content: assistantMsg.content ?? "",
        toolCalls: toolCalls,
      });

      ctx.logger?.({
        type: "model_call",
        data: {
          iteration: i,
          finishReason,
          hasToolCalls: !!toolCalls?.length,
          toolCallsCount: toolCalls?.length || 0,
        },
      });

      if (toolCalls && toolCalls.length > 0 && finishReason === "tool_calls") {
        // Execute tools and append tool messages
        const toolMessages = await runToolCalls(tools, toolCalls, ctx);
        messages.push(...toolMessages);
        // Loop again with updated messages
        continue;
      }

      // No tool calls – assume we're done
      const rawContent = assistantMsg.content ?? "";
      const parsed = parseStructuredOutput(rawContent, config, ctx);

      ctx.logger?.({ type: "final", data: { content: rawContent } });

      // Emit typed complete event
      ctx.onEvent?.({
        type: "complete",
        output: parsed,
      });

      return parsed;
    }

    throw new Error(
      `${ERROR_PREFIXES.AGENT} Agent exceeded maxToolIterations without finishing`,
    );
  }

  /**
   * Execute the agent and return output with full conversation history.
   *
   * Similar to run(), but returns additional metadata:
   * - output: The parsed final output
   * - messages: Complete conversation history
   * - iterations: Number of LLM calls made
   *
   * Use this when you need to inspect the conversation or debug issues.
   *
   * @param input - The input to process
   * @param options - Optional execution options
   * @returns Promise resolving to AgentRunResult with output and history
   *
   * @throws Error when max iterations exceeded
   * @throws Error when output parsing fails
   * @throws Error if stream option is true (not supported via runWithHistory)
   */
  async function runWithHistory(
    input: I,
    options: AgentRunOptions = {},
  ): Promise<AgentRunResult<O>> {
    const {
      stream = false,
      maxToolIterations = DEFAULT_MAX_TOOL_ITERATIONS,
      metadata,
      onEvent,
    } = options;
    if (stream) {
      throw new Error(
        `${ERROR_PREFIXES.AGENT} Streaming not implemented yet in runWithHistory`,
      );
    }

    const ctx = createContext(metadata, onEvent);
    const messages = buildInitialMessages(config, input);
    const tools = config.tools ?? [];
    const chatTools = toChatTools(tools);
    const responseFormat = buildResponseFormat(config);

    let iterationCount = 0;

    for (let i = 0; i < maxToolIterations; i += 1) {
      iterationCount = i + 1;
      ctx.logger?.({
        type: "model_call",
        data: { iteration: i, messages, tools: !!chatTools },
      });

      // Emit typed model_call event before LLM call
      ctx.onEvent?.({
        type: "model_call",
        iteration: i,
        messages: [...messages], // Copy to avoid mutation issues
      });

      const res = await config.model.provider.chat(
        buildProviderCallConfig(
          config,
          messages,
          chatTools,
          false,
          responseFormat,
          metadata,
        ),
      );

      const assistantMsg = res.message;
      const toolCalls = assistantMsg.toolCalls;
      const finishReason = res.finishReason;

      // Add assistant message to history (with tool calls if present)
      messages.push({
        role: "assistant",
        content: assistantMsg.content ?? "",
        toolCalls: toolCalls,
      });

      ctx.logger?.({
        type: "model_call",
        data: {
          iteration: i,
          finishReason,
          hasToolCalls: !!toolCalls?.length,
          toolCallsCount: toolCalls?.length || 0,
        },
      });

      if (toolCalls && toolCalls.length > 0 && finishReason === "tool_calls") {
        const toolMessages = await runToolCalls(tools, toolCalls, ctx);
        messages.push(...toolMessages);
        continue;
      }

      // No tool calls – assume we're done
      const rawContent = assistantMsg.content ?? "";
      const parsed = parseStructuredOutput(rawContent, config, ctx);

      ctx.logger?.({ type: "final", data: { content: rawContent } });

      // Emit typed complete event
      ctx.onEvent?.({
        type: "complete",
        output: parsed,
      });

      return {
        output: parsed,
        messages,
        iterations: iterationCount,
      };
    }

    throw new Error(
      `${ERROR_PREFIXES.AGENT} Agent exceeded maxToolIterations without finishing`,
    );
  }

  /**
   * Streams the agent's response, yielding chunks as they arrive.
   * Supports tool calling during streaming by executing tools and continuing.
   *
   * @param input - The input to process
   * @param options - Optional run options
   * @returns An AgentStream that can be iterated over and provides finalResult()
   */
  function stream(input: I, options: AgentRunOptions = {}): AgentStream<O> {
    const {
      maxToolIterations = DEFAULT_MAX_TOOL_ITERATIONS,
      metadata,
      onEvent,
    } = options;

    const ctx = createContext(metadata, onEvent);
    const messages = buildInitialMessages(config, input);
    const tools = config.tools ?? [];
    const chatTools = toChatTools(tools);
    const responseFormat = buildResponseFormat(config);

    // State for the stream
    let iterationCount = 0;
    let streamingComplete = false;
    let finalOutput: O | undefined;
    let totalUsage:
      | {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        }
      | undefined;

    // Create the async generator that yields StreamChunks
    async function* generateChunks(): AsyncGenerator<StreamChunk> {
      for (let i = 0; i < maxToolIterations; i += 1) {
        iterationCount = i + 1;

        ctx.logger?.({
          type: "model_call",
          data: { iteration: i, messages, tools: !!chatTools },
        });

        ctx.onEvent?.({
          type: "model_call",
          iteration: i,
          messages: [...messages],
        });

        // Stream from the provider
        const streamIterable = config.model.provider.chatStream(
          buildProviderCallConfig(
            config,
            messages,
            chatTools,
            true,
            responseFormat,
            metadata,
          ),
        );

        // Accumulate the streaming response
        let accumulatedContent = "";
        const accumulatedToolCalls = new Map<number, AccumulatedToolCall>();
        let finishReason: string | null = null;

        // Process streaming chunks
        for await (const chunk of streamIterable) {
          // Handle content
          if (chunk.content) {
            accumulatedContent += chunk.content;
            yield { type: "content", content: chunk.content };
          }

          // Handle tool calls
          if (chunk.toolCalls) {
            accumulateToolCalls(accumulatedToolCalls, chunk.toolCalls);
          }

          // Handle finish reason
          if (chunk.finishReason) {
            finishReason = chunk.finishReason;
          }

          // Handle usage
          if (chunk.usage) {
            if (totalUsage) {
              totalUsage.promptTokens += chunk.usage.promptTokens;
              totalUsage.completionTokens += chunk.usage.completionTokens;
              totalUsage.totalTokens += chunk.usage.totalTokens;
            } else {
              totalUsage = { ...chunk.usage };
            }
          }
        }

        // Convert accumulated tool calls to array
        const toolCalls: ChatToolCall[] = Array.from(
          accumulatedToolCalls.values(),
        );

        // Add assistant message to history
        messages.push({
          role: "assistant",
          content: accumulatedContent || null,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        });

        ctx.logger?.({
          type: "model_call",
          data: {
            iteration: i,
            finishReason,
            hasToolCalls: toolCalls.length > 0,
            toolCallsCount: toolCalls.length,
          },
        });

        // Check if we have tool calls to execute
        if (toolCalls.length > 0 && finishReason === "tool_calls") {
          // Emit tool_call chunks for each tool
          for (const toolCall of toolCalls) {
            yield { type: "tool_call", toolCall };
          }

          // Execute tools
          const toolMessages = await runToolCalls(tools, toolCalls, ctx);

          // Emit tool_result chunks
          for (let j = 0; j < toolMessages.length; j++) {
            const toolMsg = toolMessages[j];
            const toolCall = toolCalls[j];
            if (toolCall && toolMsg) {
              try {
                const contentStr =
                  typeof toolMsg.content === "string"
                    ? toolMsg.content
                    : JSON.stringify(toolMsg.content);
                const result: unknown = JSON.parse(contentStr ?? "{}");
                yield {
                  type: "tool_result",
                  toolResult: {
                    name: toolCall.function.name,
                    result,
                  },
                };
              } catch {
                // If parsing fails, emit raw content
                const rawContent: unknown =
                  typeof toolMsg.content === "string"
                    ? toolMsg.content
                    : JSON.stringify(toolMsg.content);
                yield {
                  type: "tool_result",
                  toolResult: {
                    name: toolCall.function.name,
                    result: rawContent,
                  },
                };
              }
            }
          }

          // Add tool messages to history and continue
          messages.push(...toolMessages);
          continue;
        }

        // No tool calls - we're done
        const rawContent = accumulatedContent;
        const parsed = parseStructuredOutput(rawContent, config, ctx);

        finalOutput = parsed;
        streamingComplete = true;

        ctx.logger?.({ type: "final", data: { content: rawContent } });

        ctx.onEvent?.({
          type: "complete",
          output: parsed,
        });

        // Emit done chunk
        yield { type: "done" };
        return;
      }

      throw new Error(
        `${ERROR_PREFIXES.AGENT} Agent exceeded maxToolIterations without finishing`,
      );
    }

    // Create the iterator
    const iterator = generateChunks();

    // Return the AgentStream object
    return {
      [Symbol.asyncIterator]() {
        return iterator;
      },

      async finalResult(): Promise<AgentRunResult<O>> {
        // If not complete, consume the rest of the stream
        if (!streamingComplete) {
          for await (const _ of iterator) {
            // Consume remaining chunks
          }
        }

        if (finalOutput === undefined) {
          throw new Error(
            `${ERROR_PREFIXES.AGENT} Stream did not complete successfully - no output available`,
          );
        }

        return {
          output: finalOutput,
          messages,
          iterations: iterationCount,
          usage: totalUsage,
        };
      },
    };
  }

  return { run, runWithHistory, stream };
}
