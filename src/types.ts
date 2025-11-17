// src/types.ts

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string | null;
  name?: string; // for tool messages
  toolCallId?: string; // for tool response messages - required by OpenRouter SDK
  tool_calls?: ChatToolCall[]; // for assistant messages with tool calls
}

export interface ToolSchema {
  name: string;
  description?: string;
  // JSON Schema-ish object. Caller can generate from Zod or write by hand.
  parameters: Record<string, any>;
}

export type ToolHandler = (args: any, ctx: AgentContext) => Promise<any>;

export interface ToolDefinition {
  schema: ToolSchema;
  handler: ToolHandler;
}

export interface ChatTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// Provider interface – OpenRouter will implement this
export interface ChatResponse {
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: ChatToolCall[];
  };
  finishReason: string | null;
  raw?: any;
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  tools?: ChatTool[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, any>;
}

export interface LLMProvider {
  chat(req: ChatRequest): Promise<ChatResponse>;
  // later: chatStream(req: ChatRequest): AsyncIterable<ChatResponseChunk>;
}

export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentContext {
  runId: string;
  metadata?: Record<string, any>;
  logger?: (event: AgentLogEvent) => void;
}

export type AgentLogEvent =
  | { type: "model_call"; data: any }
  | { type: "tool_call"; data: any }
  | { type: "tool_result"; data: any }
  | { type: "final"; data: any };

// A generic "schema" type so you can pass Zod / Valibot / whatever
export interface Schema<T> {
  parse(value: unknown): T;
}

export interface AgentConfig<I = unknown, O = unknown> {
  name: string;
  description?: string;
  systemPrompt?: string;
  model: ModelConfig;
  tools?: ToolDefinition[];

  // How to turn input into messages. Defaults to single user message.
  buildInputMessages?: (input: I) => Message[];

  // Optional validation / shaping
  inputSchema?: Schema<I>;
  outputSchema?: Schema<O>;
}

export interface AgentRunOptions {
  stream?: boolean; // for future extension
  maxToolIterations?: number;
  metadata?: Record<string, any>;
}

export interface Agent<I = unknown, O = unknown> {
  run(input: I, options?: AgentRunOptions): Promise<O>;
  // later: runStream(...)
}
