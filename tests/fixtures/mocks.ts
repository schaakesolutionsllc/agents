// tests/fixtures/mocks.ts
// Mock factory functions for integration testing

import { vi } from "vitest";
import { createAgent } from "../../src/agent.js";
import { defineTool, defineSyncTool } from "../../src/tools.js";
import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  AgentConfig,
  ChatToolCall,
  ChatStreamChunk,
} from "../../src/types.js";

/**
 * Options for creating a mock OpenRouter response
 */
export interface MockResponseOptions {
  content?: string | null;
  toolCalls?: Array<{
    id?: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  finishReason?: string;
}

/**
 * Creates a properly structured ChatResponse for testing.
 * Handles the mapping between simple options and the full response structure.
 */
export function createMockResponse(options: MockResponseOptions): ChatResponse {
  const toolCalls: ChatToolCall[] | undefined = options.toolCalls?.map(
    (tc, idx) => ({
      id: tc.id ?? `call_${idx}`,
      type: "function" as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      },
    }),
  );

  return {
    message: {
      role: "assistant",
      content: options.content ?? null,
      toolCalls,
    },
    finishReason: options.finishReason ?? (toolCalls ? "tool_calls" : "stop"),
  };
}

/**
 * Creates a mock LLM provider that returns a sequence of responses.
 * Tracks call count and throws if more calls are made than responses available.
 */
export function createMockProvider(responses: ChatResponse[]): LLMProvider {
  let callIndex = 0;
  return {
    async chat(_req: ChatRequest): Promise<ChatResponse> {
      if (callIndex >= responses.length) {
        throw new Error(
          `No more mock responses available. Called ${callIndex + 1} times but only ${responses.length} responses provided.`,
        );
      }
      return responses[callIndex++];
    },
  };
}

/**
 * Creates a mock LLM provider that captures all requests for inspection.
 * Useful for verifying what was sent to the model.
 */
export function createCapturingProvider(responses: ChatResponse[]): {
  provider: LLMProvider;
  requests: ChatRequest[];
} {
  const requests: ChatRequest[] = [];
  let callIndex = 0;

  const provider: LLMProvider = {
    async chat(req: ChatRequest): Promise<ChatResponse> {
      requests.push(req);
      if (callIndex >= responses.length) {
        throw new Error(
          `No more mock responses available. Called ${callIndex + 1} times but only ${responses.length} responses provided.`,
        );
      }
      return responses[callIndex++];
    },
  };

  return { provider, requests };
}

/**
 * Creates a mock LLM provider with a custom implementation function.
 * Provides full control over the mock behavior.
 */
export function createCustomProvider(
  impl: (req: ChatRequest, callIndex: number) => Promise<ChatResponse> | ChatResponse,
): LLMProvider {
  let callIndex = 0;
  return {
    async chat(req: ChatRequest): Promise<ChatResponse> {
      const result = await impl(req, callIndex);
      callIndex++;
      return result;
    },
  };
}

// ------ Mock Tool Factories ------

/**
 * Creates a simple async tool that succeeds with the given implementation.
 */
export function createSuccessTool(
  name: string,
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown,
) {
  return defineTool(
    {
      name,
      description: `Test tool: ${name}`,
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: true,
      },
    },
    async (args) => {
      const result = await handler(args);
      return result;
    },
  );
}

/**
 * Creates a tool that always throws the specified error.
 */
export function createFailingTool(name: string, errorMessage: string) {
  return defineTool(
    {
      name,
      description: `Failing test tool: ${name}`,
      parameters: {
        type: "object",
        properties: {},
      },
    },
    async () => {
      throw new Error(errorMessage);
    },
  );
}

/**
 * Creates a sync tool using defineSyncTool.
 */
export function createSyncTool(
  name: string,
  handler: (args: Record<string, unknown>) => unknown,
) {
  return defineSyncTool(
    {
      name,
      description: `Sync test tool: ${name}`,
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: true,
      },
    },
    handler,
  );
}

/**
 * Creates a spy-wrapped tool that tracks calls.
 */
export function createSpyTool(
  name: string,
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown,
) {
  const spy = vi.fn(handler);
  const tool = defineTool(
    {
      name,
      description: `Spy tool: ${name}`,
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: true,
      },
    },
    async (args) => {
      return spy(args);
    },
  );
  return { tool, spy };
}

// ------ Test Agent Factories ------

/**
 * Creates a test agent with minimal configuration.
 * Uses the provided mock provider.
 */
export function createTestAgent<I = string, O = string>(
  provider: LLMProvider,
  options?: Partial<AgentConfig<I, O>>,
) {
  return createAgent({
    name: "testAgent",
    model: {
      provider,
      model: "test-model",
    },
    ...options,
  });
}

// ------ Common Response Templates ------

/**
 * Standard completion response with text content.
 */
export function textResponse(content: string): ChatResponse {
  return createMockResponse({ content, finishReason: "stop" });
}

/**
 * Standard tool call response.
 */
export function toolCallResponse(
  name: string,
  args: Record<string, unknown>,
  id?: string,
): ChatResponse {
  return createMockResponse({
    content: null,
    toolCalls: [{ id, name, arguments: args }],
    finishReason: "tool_calls",
  });
}

/**
 * Response with multiple tool calls.
 */
export function multiToolCallResponse(
  calls: Array<{ name: string; arguments: Record<string, unknown>; id?: string }>,
): ChatResponse {
  return createMockResponse({
    content: null,
    toolCalls: calls,
    finishReason: "tool_calls",
  });
}

/**
 * Empty response (no choices scenario simulation).
 * Note: This is handled by the provider, not the agent.
 */
export function emptyResponse(): ChatResponse {
  return {
    message: {
      role: "assistant",
      content: null,
    },
    finishReason: "stop",
  };
}

// ------ Streaming Mock Factories ------

/**
 * Options for creating mock streaming chunks
 */
export interface MockStreamChunkOptions {
  content?: string;
  toolCalls?: Array<{
    index: number;
    id?: string;
    name?: string;
    arguments?: string;
  }>;
  finishReason?: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Creates a sequence of streaming chunks that simulate text being streamed.
 * Splits the content into individual character chunks for realistic simulation.
 */
export function createTextStreamChunks(content: string): ChatStreamChunk[] {
  const chunks: ChatStreamChunk[] = [];

  // Stream content character by character (or in small chunks)
  for (let i = 0; i < content.length; i++) {
    chunks.push({ content: content[i] });
  }

  // Add final chunk with finish reason
  chunks.push({ finishReason: "stop" });

  return chunks;
}

/**
 * Creates streaming chunks for a tool call response.
 * Simulates how OpenRouter streams tool calls with incremental arguments.
 */
export function createToolCallStreamChunks(
  name: string,
  args: Record<string, unknown>,
  id?: string,
): ChatStreamChunk[] {
  const argString = JSON.stringify(args);
  const toolCallId = id ?? "call_1";

  const chunks: ChatStreamChunk[] = [];

  // First chunk: tool call ID and name
  chunks.push({
    toolCalls: [
      {
        index: 0,
        id: toolCallId,
        type: "function",
        function: {
          name,
          arguments: "",
        },
      },
    ],
  });

  // Stream arguments incrementally
  for (let i = 0; i < argString.length; i++) {
    chunks.push({
      toolCalls: [
        {
          index: 0,
          function: {
            arguments: argString[i],
          },
        },
      ],
    });
  }

  // Final chunk with finish reason
  chunks.push({ finishReason: "tool_calls" });

  return chunks;
}

/**
 * Creates streaming chunks for multiple tool calls in a single response.
 */
export function createMultiToolCallStreamChunks(
  calls: Array<{ name: string; arguments: Record<string, unknown>; id?: string }>,
): ChatStreamChunk[] {
  const chunks: ChatStreamChunk[] = [];

  // First chunk: all tool call IDs and names
  const initialToolCalls = calls.map((call, index) => ({
    index,
    id: call.id ?? `call_${index}`,
    type: "function" as const,
    function: {
      name: call.name,
      arguments: "",
    },
  }));

  chunks.push({ toolCalls: initialToolCalls });

  // Stream arguments for each tool call
  for (let callIndex = 0; callIndex < calls.length; callIndex++) {
    const argString = JSON.stringify(calls[callIndex].arguments);
    for (let i = 0; i < argString.length; i++) {
      chunks.push({
        toolCalls: [
          {
            index: callIndex,
            function: {
              arguments: argString[i],
            },
          },
        ],
      });
    }
  }

  // Final chunk
  chunks.push({ finishReason: "tool_calls" });

  return chunks;
}

/**
 * Creates a mock streaming provider that returns a sequence of streaming responses.
 * Each call to chatStream() returns the next async iterable in the sequence.
 */
export function createStreamingMockProvider(
  streamSequences: ChatStreamChunk[][],
): LLMProvider {
  let callIndex = 0;

  return {
    async chat(_req: ChatRequest): Promise<ChatResponse> {
      throw new Error("chat() should not be called on streaming provider");
    },
    async *chatStream(_req: ChatRequest): AsyncIterable<ChatStreamChunk> {
      if (callIndex >= streamSequences.length) {
        throw new Error(
          `No more streaming responses available. Called ${callIndex + 1} times but only ${streamSequences.length} sequences provided.`,
        );
      }
      const chunks = streamSequences[callIndex++];
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

/**
 * Creates a capturing streaming provider that records all requests.
 */
export function createCapturingStreamingProvider(
  streamSequences: ChatStreamChunk[][],
): {
  provider: LLMProvider;
  requests: ChatRequest[];
} {
  const requests: ChatRequest[] = [];
  let callIndex = 0;

  const provider: LLMProvider = {
    async chat(_req: ChatRequest): Promise<ChatResponse> {
      throw new Error("chat() should not be called on streaming provider");
    },
    async *chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk> {
      requests.push(req);
      if (callIndex >= streamSequences.length) {
        throw new Error(
          `No more streaming responses available. Called ${callIndex + 1} times but only ${streamSequences.length} sequences provided.`,
        );
      }
      const chunks = streamSequences[callIndex++];
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };

  return { provider, requests };
}

/**
 * Creates a custom streaming provider with full control over behavior.
 */
export function createCustomStreamingProvider(
  impl: (req: ChatRequest, callIndex: number) => AsyncIterable<ChatStreamChunk>,
): LLMProvider {
  let callIndex = 0;
  return {
    async chat(_req: ChatRequest): Promise<ChatResponse> {
      throw new Error("chat() should not be called on streaming provider");
    },
    async *chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk> {
      yield* impl(req, callIndex++);
    },
  };
}
