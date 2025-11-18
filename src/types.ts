// src/types.ts

/**
 * The allowed message roles in a conversation.
 * - `system`: System-level instructions for the model
 * - `user`: Messages from the user
 * - `assistant`: Responses from the AI model
 * - `tool`: Results from tool executions
 */
export type Role = "system" | "user" | "assistant" | "tool";

/**
 * Represents a single message in the conversation history.
 * Messages form the context sent to the LLM provider.
 *
 * @example
 * ```typescript
 * const userMessage: Message = {
 *   role: "user",
 *   content: "What is the weather in San Francisco?"
 * };
 *
 * const toolResult: Message = {
 *   role: "tool",
 *   toolCallId: "call_123",
 *   content: JSON.stringify({ temperature: 72, condition: "sunny" })
 * };
 * ```
 */
export interface Message {
  /** The role of the message sender */
  role: Role;
  /** The text content of the message, or null for tool-calling assistant messages */
  content: string | null;
  /** Optional name for assistant messages (NOT for tool messages) */
  name?: string;
  /** Tool call ID for tool response messages - required by OpenRouter SDK */
  toolCallId?: string;
  /** Tool calls requested by the assistant in this message */
  toolCalls?: ChatToolCall[];
}

/**
 * Schema definition for a tool that can be called by the LLM.
 * Describes the tool's name, purpose, and parameter structure.
 *
 * @example
 * ```typescript
 * const weatherToolSchema: ToolSchema = {
 *   name: "get_weather",
 *   description: "Get the current weather for a location",
 *   parameters: {
 *     type: "object",
 *     properties: {
 *       location: {
 *         type: "string",
 *         description: "The city and state, e.g., San Francisco, CA"
 *       }
 *     },
 *     required: ["location"]
 *   }
 * };
 * ```
 */
export interface ToolSchema {
  /** Unique identifier for the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description?: string;
  /** JSON Schema object describing the tool's parameters */
  parameters: Record<string, any>;
}

/**
 * Handler function signature for tool execution.
 * Called when the LLM invokes a tool with parsed arguments.
 *
 * @param args - The parsed arguments from the LLM's tool call
 * @param ctx - The agent context with runtime information
 * @returns A promise resolving to the tool result
 *
 * @example
 * ```typescript
 * const weatherHandler: ToolHandler = async (args, ctx) => {
 *   const { location } = args;
 *   const weather = await fetchWeather(location);
 *   return { temperature: weather.temp, condition: weather.condition };
 * };
 * ```
 */
export type ToolHandler = (args: any, ctx: AgentContext) => Promise<any>;

/**
 * Complete tool definition combining schema and handler.
 * Used to define tools that agents can invoke during execution.
 *
 * @see defineTool - Helper function to create tool definitions
 * @see defineSyncTool - Helper for synchronous tool handlers
 *
 * @example
 * ```typescript
 * const weatherTool: ToolDefinition = {
 *   schema: {
 *     name: "get_weather",
 *     description: "Get weather for a location",
 *     parameters: { ... }
 *   },
 *   handler: async (args) => {
 *     return await fetchWeather(args.location);
 *   }
 * };
 * ```
 */
export interface ToolDefinition {
  /** The schema describing the tool's interface */
  schema: ToolSchema;
  /** The async handler function that executes the tool */
  handler: ToolHandler;
}

/**
 * Format for tools sent to the LLM provider.
 * This is the OpenAI-compatible tool format used by providers.
 */
export interface ChatTool {
  /** Always "function" for function-calling tools */
  type: "function";
  /** The function definition */
  function: {
    /** Name of the function */
    name: string;
    /** Description of what the function does */
    description?: string;
    /** JSON Schema for the function parameters */
    parameters?: Record<string, any>;
  };
}

/**
 * Represents a tool invocation request from the LLM.
 * Contains the tool name and JSON-encoded arguments.
 *
 * @example
 * ```typescript
 * const toolCall: ChatToolCall = {
 *   id: "call_abc123",
 *   type: "function",
 *   function: {
 *     name: "get_weather",
 *     arguments: '{"location": "San Francisco, CA"}'
 *   }
 * };
 * ```
 */
export interface ChatToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Always "function" for function calls */
  type: "function";
  /** The function call details */
  function: {
    /** Name of the function to call */
    name: string;
    /** JSON string of the function arguments */
    arguments: string;
  };
}

// OpenRouter API response types
// These provide type safety for OpenRouter SDK responses

/**
 * Content item in OpenRouter response when content is returned as an array.
 */
export interface OpenRouterContentItem {
  type: "text";
  text: string;
}

/**
 * Represents a single choice from the OpenRouter API response.
 * Each choice contains the assistant's message and optional tool calls.
 */
export interface OpenRouterChoice {
  index: number;
  finishReason: string | null;
  message: {
    role: "assistant";
    content: string | OpenRouterContentItem[] | null;
    toolCalls?: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
}

/**
 * Complete response from OpenRouter's chat API.
 * This interface maps to the SDK's response structure.
 */
export interface OpenRouterChatResponse {
  id: string;
  choices: OpenRouterChoice[];
  created: number;
  model: string;
  object: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Type for tool handler return values.
 * Tools can return data (object) or perform side effects only (void).
 */
export type ToolHandlerResult = Record<string, unknown> | void;

/**
 * Response structure from the LLM provider.
 * Contains the assistant's message and metadata about the response.
 *
 * @see LLMProvider.chat - Method that returns this type
 */
export interface ChatResponse {
  /** The assistant's response message */
  message: {
    /** Always "assistant" for responses */
    role: "assistant";
    /** Text content of the response, or null if only tool calls */
    content: string | null;
    /** Tool calls requested by the assistant */
    toolCalls?: ChatToolCall[];
  };
  /** Reason the model stopped generating (e.g., "stop", "tool_calls") */
  finishReason: string | null;
  /** Raw response from the provider for debugging */
  raw?: any;
}

/**
 * Result of an agent run, including output, conversation history, and metadata.
 * Used by runWithHistory() to provide full execution details.
 *
 * @template O - The output type from the agent execution
 *
 * @example
 * ```typescript
 * const result = await agent.runWithHistory("What's the weather?");
 * console.log(result.output);           // Parsed output
 * console.log(result.messages.length);  // Number of messages
 * console.log(result.iterations);       // Number of LLM calls
 * ```
 */
export interface AgentRunResult<O> {
  /** The final output from the agent execution */
  output: O;
  /** Complete conversation history including system, user, assistant, and tool messages */
  messages: Message[];
  /** Number of agent loop iterations (tool calls + processing) */
  iterations: number;
  /** Optional token usage statistics for cost tracking */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Request structure for the LLM provider.
 * Sent to the provider's chat method with all necessary configuration.
 *
 * @see LLMProvider.chat - Method that accepts this type
 */
export interface ChatRequest {
  /** The model identifier (e.g., "anthropic/claude-3.5-sonnet") */
  model: string;
  /** The conversation messages to send */
  messages: Message[];
  /** Optional tools available for the model to call */
  tools?: ChatTool[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Sampling temperature (0-2, lower is more deterministic) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Additional metadata for the request */
  metadata?: Record<string, any>;
  /** Response format for structured output */
  responseFormat?: {
    type: "json_schema";
    jsonSchema: {
      name: string;
      description?: string;
      schema?: Record<string, any>;
      strict?: boolean;
    };
  };
}

/**
 * Represents a single chunk from a streaming chat response.
 * Used by LLMProvider.chatStream() to yield incremental updates.
 */
export interface ChatStreamChunk {
  /** Incremental text content from the model */
  content?: string;
  /** Incremental tool call data (may be partial) */
  toolCalls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  /** Finish reason - only present in the final chunk */
  finishReason?: string | null;
  /** Token usage statistics - only present in the final chunk */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Provider abstraction for LLM API calls.
 * Implementations handle the specifics of different LLM providers (e.g., OpenRouter).
 *
 * @example
 * ```typescript
 * const provider: LLMProvider = {
 *   async chat(req) {
 *     const response = await openrouter.chat.create(req);
 *     return transformResponse(response);
 *   },
 *   async *chatStream(req) {
 *     for await (const chunk of openrouter.chat.stream(req)) {
 *       yield transformChunk(chunk);
 *     }
 *   }
 * };
 * ```
 */
export interface LLMProvider {
  /**
   * Send a chat request and receive a complete response.
   * @param req - The chat request configuration
   * @returns Promise resolving to the chat response
   */
  chat(req: ChatRequest): Promise<ChatResponse>;

  /**
   * Stream a chat response chunk by chunk.
   * @param req - The chat request configuration
   * @returns AsyncIterable of chat stream chunks
   */
  chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk>;
}

/**
 * Configuration for the LLM model used by an agent.
 * Specifies the provider, model, and optional generation parameters.
 *
 * @example
 * ```typescript
 * const modelConfig: ModelConfig = {
 *   provider: openRouterProvider,
 *   model: "anthropic/claude-3.5-sonnet",
 *   temperature: 0.7,
 *   maxTokens: 4096
 * };
 * ```
 */
export interface ModelConfig {
  /** The LLM provider implementation */
  provider: LLMProvider;
  /** Model identifier string */
  model: string;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

/**
 * Runtime context available to tool handlers during execution.
 * Provides access to run metadata, logging, and event callbacks.
 *
 * @example
 * ```typescript
 * const handler: ToolHandler = async (args, ctx) => {
 *   console.log(`Run ID: ${ctx.runId}`);
 *   ctx.logger?.({ type: "tool_call", data: { name: "my_tool", args } });
 *   return { result: "success" };
 * };
 * ```
 */
export interface AgentContext {
  /** Unique identifier for this agent run */
  runId: string;
  /** Optional metadata passed from run options */
  metadata?: Record<string, any>;
  /** Optional logger callback for debugging events */
  logger?: (event: AgentLogEvent) => void;
  /**
   * Optional callback for typed agent events.
   * Provides type-safe event handling with discriminated union types.
   */
  onEvent?: (event: AgentEvent) => void;
}

/**
 * Legacy log event type for the logger callback.
 * Use AgentEvent with onEvent for better type safety.
 *
 * @see AgentEvent - Preferred typed event system
 */
export type AgentLogEvent =
  | { type: "model_call"; data: any }
  | { type: "tool_call"; data: any }
  | { type: "tool_result"; data: any }
  | { type: "final"; data: any };

/**
 * Typed agent event for the onEvent callback.
 * A discriminated union with specific event types for type-safe event handling.
 *
 * Event types:
 * - `model_call`: Fired before each LLM call with iteration number and messages
 * - `tool_call`: Fired before tool execution with name and arguments
 * - `tool_result`: Fired after successful tool execution with result
 * - `tool_error`: Fired when tool handler throws with error message
 * - `complete`: Fired at end of run with final output
 *
 * @example
 * ```typescript
 * onEvent: (event) => {
 *   if (event.type === 'model_call') {
 *     console.log(`Iteration ${event.iteration}: ${event.messages.length} messages`);
 *   } else if (event.type === 'tool_error') {
 *     console.error(`Tool ${event.name} failed: ${event.error}`);
 *   }
 * }
 * ```
 */
export type AgentEvent =
  | { type: "model_call"; iteration: number; messages: Message[] }
  | { type: "tool_call"; name: string; args: any }
  | { type: "tool_result"; name: string; result: any }
  | { type: "tool_error"; name: string; error: string }
  | { type: "complete"; output: any };

/**
 * Generic schema interface for input/output validation.
 * Compatible with Zod, Valibot, and other schema libraries.
 *
 * @template T - The type that the schema parses to
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 *
 * const inputSchema = z.object({
 *   query: z.string(),
 *   limit: z.number().optional()
 * });
 *
 * // Zod schemas implement this interface
 * const agent = createAgent({
 *   inputSchema, // Works directly
 *   ...
 * });
 * ```
 */
export interface Schema<T> {
  /**
   * Parse and validate an unknown value.
   * @param value - The value to parse
   * @returns The validated and typed value
   * @throws When validation fails
   */
  parse(value: unknown): T;
}

/**
 * Configuration for creating an agent instance.
 * Defines the agent's behavior, model, tools, and schemas.
 *
 * @template I - Input type the agent accepts
 * @template O - Output type the agent returns
 *
 * @example
 * ```typescript
 * const config: AgentConfig<string, WeatherResponse> = {
 *   name: "weather-agent",
 *   description: "Gets weather information for locations",
 *   systemPrompt: "You are a helpful weather assistant.",
 *   model: {
 *     provider: openRouterProvider,
 *     model: "anthropic/claude-3.5-sonnet",
 *     temperature: 0.3
 *   },
 *   tools: [weatherTool],
 *   outputSchema: weatherResponseSchema
 * };
 * ```
 *
 * @see createAgent - Factory function that uses this config
 */
export interface AgentConfig<I = unknown, O = unknown> {
  /** Name identifier for the agent */
  name: string;
  /** Human-readable description of the agent's purpose */
  description?: string;
  /** System prompt to set the agent's behavior */
  systemPrompt?: string;
  /** Model configuration including provider and parameters */
  model: ModelConfig;
  /** Tools available for the agent to use */
  tools?: ToolDefinition[];

  /**
   * Custom function to convert input into messages.
   * Defaults to a single user message with the input as content.
   */
  buildInputMessages?: (input: I) => Message[];

  /** Schema to validate and parse input */
  inputSchema?: Schema<I>;
  /** Schema to validate and parse output (enables structured output) */
  outputSchema?: Schema<O>;
}

/**
 * Options for controlling agent execution.
 * Passed to run(), runWithHistory(), or stream() methods.
 *
 * @example
 * ```typescript
 * const options: AgentRunOptions = {
 *   maxToolIterations: 10,
 *   metadata: { userId: "123", requestId: "abc" },
 *   onEvent: (event) => {
 *     if (event.type === "tool_call") {
 *       console.log(`Calling ${event.name}`);
 *     }
 *   }
 * };
 *
 * const result = await agent.run(input, options);
 * ```
 */
export interface AgentRunOptions {
  /** Reserved for future streaming extension via run() */
  stream?: boolean;
  /** Maximum tool call iterations before throwing (default: 4) */
  maxToolIterations?: number;
  /** Additional metadata available to tool handlers */
  metadata?: Record<string, any>;
  /**
   * Optional callback for typed agent events.
   * Called at key points during agent execution with type-safe event data.
   *
   * Events are emitted in this order during execution:
   * model_call -> tool_call -> tool_result/tool_error -> ... -> complete
   *
   * @example
   * ```typescript
   * const events: AgentEvent[] = [];
   * await agent.run(input, {
   *   onEvent: (event) => {
   *     events.push(event);
   *     if (event.type === 'tool_error') {
   *       console.error(`Tool ${event.name} failed: ${event.error}`);
   *     }
   *   },
   * });
   * ```
   */
  onEvent?: (event: AgentEvent) => void;
}

/**
 * Public interface for an agent instance.
 * Provides methods to execute the agent with different response styles.
 *
 * @template I - Input type the agent accepts
 * @template O - Output type the agent returns
 *
 * @example
 * ```typescript
 * const agent: Agent<string, string> = createAgent({
 *   name: "simple-agent",
 *   model: modelConfig,
 *   systemPrompt: "You are a helpful assistant."
 * });
 *
 * // Simple execution
 * const output = await agent.run("Hello!");
 *
 * // With history
 * const { output, messages } = await agent.runWithHistory("Hello!");
 *
 * // Streaming
 * for await (const chunk of agent.stream("Hello!")) {
 *   if (chunk.type === "content") {
 *     process.stdout.write(chunk.content);
 *   }
 * }
 * ```
 *
 * @see createAgent - Factory function to create agents
 */
export interface Agent<I = unknown, O = unknown> {
  /**
   * Execute the agent and return only the output.
   * @param input - The input to process
   * @param options - Optional execution options
   * @returns Promise resolving to the parsed output
   * @throws When max iterations exceeded or output parsing fails
   */
  run(input: I, options?: AgentRunOptions): Promise<O>;

  /**
   * Execute the agent and return output with full conversation history.
   * @param input - The input to process
   * @param options - Optional execution options
   * @returns Promise resolving to output, messages, and metadata
   * @throws When max iterations exceeded or output parsing fails
   */
  runWithHistory(
    input: I,
    options?: AgentRunOptions,
  ): Promise<AgentRunResult<O>>;

  /**
   * Stream the agent's response chunk by chunk.
   * @param input - The input to process
   * @param options - Optional execution options
   * @returns AgentStream that can be async-iterated and provides finalResult()
   */
  stream(input: I, options?: AgentRunOptions): AgentStream<O>;
}

/**
 * Represents a single chunk of data emitted during streaming.
 * A discriminated union with four variants: content, tool_call, tool_result, and done.
 *
 * - `content`: Streamed text content from the model
 * - `tool_call`: A tool invocation call from the model
 * - `tool_result`: The result of a tool execution
 * - `done`: Terminal event indicating stream completion
 */
export type StreamChunk =
  | { type: "content"; content: string }
  | { type: "tool_call"; toolCall: ChatToolCall }
  | { type: "tool_result"; toolResult: { name: string; result: any } }
  | { type: "done" };

/**
 * Interface for streaming agent responses.
 * Supports async iteration and provides access to the final result after streaming completes.
 *
 * @template O - The output type from the agent execution
 *
 * @example
 * ```typescript
 * const stream = agent.stream(input);
 *
 * for await (const chunk of stream) {
 *   if (chunk.type === 'content') {
 *     process.stdout.write(chunk.content);
 *   } else if (chunk.type === 'tool_call') {
 *     console.log(`Calling tool: ${chunk.toolCall.function.name}`);
 *   }
 * }
 *
 * const { output, messages } = await stream.finalResult();
 * ```
 */
export interface AgentStream<O> {
  /**
   * Implements AsyncIterable protocol for consuming stream chunks.
   * Yields StreamChunk events as the agent processes the request.
   */
  [Symbol.asyncIterator](): AsyncIterator<StreamChunk>;

  /**
   * Get the final result after streaming completes.
   * Can only be called after the stream has fully consumed (after receiving 'done' chunk).
   * @returns Promise resolving to complete agent run result with output and history
   */
  finalResult(): Promise<AgentRunResult<O>>;
}
