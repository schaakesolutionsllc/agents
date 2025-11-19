import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { createAgent, validateToolArguments, ERROR_PREFIXES } from "../src/agent.js";
import { defineTool, defineSyncTool } from "../src/tools.js";
import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  AgentLogEvent,
  AgentEvent,
  Message,
} from "../src/types.js";
import {
  createMockProvider,
  createCapturingProvider,
  createCustomProvider,
  createTestAgent,
  createSuccessTool,
  createFailingTool,
  createSyncTool,
  createSpyTool,
  textResponse,
  toolCallResponse,
  multiToolCallResponse,
  createStreamingMockProvider,
  createCapturingStreamingProvider,
  createTextStreamChunks,
  createToolCallStreamChunks,
  createMultiToolCallStreamChunks,
  createCustomStreamingProvider,
} from "./fixtures/mocks.js";
import type { StreamChunk, ChatStreamChunk } from "../src/types.js";

// ======== Basic Agent Functionality Tests ========

describe("createAgent - Basic Functionality", () => {
  it("should run successfully with no tools", async () => {
    const mockProvider = createMockProvider([
      textResponse("Hello, world!"),
    ]);

    const agent = createTestAgent(mockProvider);
    const result = await agent.run("Say hello");

    expect(result).toBe("Hello, world!");
  });

  it("should execute single tool and return result", async () => {
    const successTool = defineTool(
      {
        name: "successTool",
        description: "A tool that succeeds",
        parameters: {
          type: "object",
          properties: {
            value: { type: "number" },
          },
        },
      },
      async (args) => {
        return { doubled: args.value * 2 };
      },
    );

    const mockProvider = createMockProvider([
      toolCallResponse("successTool", { value: 5 }),
      textResponse("The doubled value is 10"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [successTool],
    });

    const result = await agent.run("Double 5");

    expect(result).toBe("The doubled value is 10");
  });

  it("should handle multi-step tool chains", async () => {
    const fetchTool = createSuccessTool("fetchData", async () => {
      return { data: [1, 2, 3, 4, 5] };
    });

    const processTool = createSuccessTool("processData", async (args) => {
      const data = args.data as number[];
      return { sum: data.reduce((a: number, b: number) => a + b, 0) };
    });

    const mockProvider = createMockProvider([
      // First call: fetch data
      toolCallResponse("fetchData", {}),
      // Second call: process the fetched data
      toolCallResponse("processData", { data: [1, 2, 3, 4, 5] }),
      // Final response
      textResponse("The sum of the data is 15"),
    ]);

    const agent = createAgent({
      name: "multiStepAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [fetchTool, processTool],
    });

    const result = await agent.run("Fetch and sum the data");

    expect(result).toBe("The sum of the data is 15");
  });

  it("should handle multiple tools called in single iteration", async () => {
    const tool1Spy = vi.fn().mockResolvedValue({ result: "tool1" });
    const tool2Spy = vi.fn().mockResolvedValue({ result: "tool2" });

    const tool1 = defineTool(
      {
        name: "tool1",
        description: "First tool",
        parameters: { type: "object", properties: {} },
      },
      tool1Spy,
    );

    const tool2 = defineTool(
      {
        name: "tool2",
        description: "Second tool",
        parameters: { type: "object", properties: {} },
      },
      tool2Spy,
    );

    const mockProvider = createMockProvider([
      multiToolCallResponse([
        { name: "tool1", arguments: {} },
        { name: "tool2", arguments: {} },
      ]),
      textResponse("Both tools executed"),
    ]);

    const agent = createAgent({
      name: "parallelAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool1, tool2],
    });

    const result = await agent.run("Call both tools");

    expect(result).toBe("Both tools executed");
    expect(tool1Spy).toHaveBeenCalledTimes(1);
    expect(tool2Spy).toHaveBeenCalledTimes(1);
  });

  it("should pass correct arguments to tools", async () => {
    const { tool, spy } = createSpyTool("argTool", (args) => {
      return { received: args };
    });

    const mockProvider = createMockProvider([
      toolCallResponse("argTool", { name: "test", count: 42, nested: { a: 1 } }),
      textResponse("Arguments received"),
    ]);

    const agent = createAgent({
      name: "argAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("Test arguments");

    expect(spy).toHaveBeenCalledWith({
      name: "test",
      count: 42,
      nested: { a: 1 },
    });
  });

  it("should use system prompt when provided", async () => {
    const { provider, requests } = createCapturingProvider([
      textResponse("Response with system prompt"),
    ]);

    const agent = createAgent({
      name: "systemPromptAgent",
      systemPrompt: "You are a helpful assistant.",
      model: {
        provider,
        model: "test-model",
      },
    });

    await agent.run("Hello");

    expect(requests[0].messages[0]).toEqual({
      role: "system",
      content: "You are a helpful assistant.",
    });
  });

  it("should use custom buildInputMessages when provided", async () => {
    const { provider, requests } = createCapturingProvider([
      textResponse("Response"),
    ]);

    const agent = createAgent({
      name: "customInputAgent",
      model: {
        provider,
        model: "test-model",
      },
      buildInputMessages: (input: string) => [
        { role: "user", content: `Custom: ${input}` },
        { role: "user", content: "Additional context" },
      ],
    });

    await agent.run("test input");

    const userMessages = requests[0].messages.filter((m: Message) => m.role === "user");
    expect(userMessages).toHaveLength(2);
    expect(userMessages[0].content).toBe("Custom: test input");
    expect(userMessages[1].content).toBe("Additional context");
  });

  it("should handle tool that returns undefined", async () => {
    const voidTool = createSuccessTool("voidTool", async () => {
      // Returns nothing (undefined)
    });

    const mockProvider = createMockProvider([
      toolCallResponse("voidTool", {}),
      textResponse("Tool executed with no return"),
    ]);

    const agent = createAgent({
      name: "voidAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [voidTool],
    });

    const result = await agent.run("Call void tool");

    expect(result).toBe("Tool executed with no return");
  });

  it("should handle tool called with empty arguments", async () => {
    const emptyArgsTool = createSuccessTool("emptyArgsTool", async (args) => {
      return { argsReceived: Object.keys(args).length === 0 };
    });

    const mockProvider = createMockProvider([
      toolCallResponse("emptyArgsTool", {}),
      textResponse("Empty args handled"),
    ]);

    const agent = createAgent({
      name: "emptyArgsAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [emptyArgsTool],
    });

    const result = await agent.run("Test");

    expect(result).toBe("Empty args handled");
  });
});

// ======== Tool Error Handling Tests ========

describe("createAgent - Tool Error Handling", () => {
  it("should catch and report tool handler exceptions", async () => {
    const failingTool = createFailingTool("failingTool", "Tool handler exploded!");

    const mockProvider = createMockProvider([
      toolCallResponse("failingTool", { input: "test" }),
      textResponse("The tool failed, but I handled it gracefully."),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [failingTool],
    });

    // Agent should not throw - it catches the tool error
    const result = await agent.run("test input");

    expect(result).toBe("The tool failed, but I handled it gracefully.");
  });

  it("should format tool errors as proper tool results with error details", async () => {
    const failingTool = createFailingTool("failingTool", "Database connection failed");

    const { provider, requests } = createCapturingProvider([
      toolCallResponse("failingTool", {}),
      textResponse("Error handled"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [failingTool],
    });

    await agent.run("test");

    // Check that the second request contains the error result as a tool message
    expect(requests.length).toBe(2);
    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");

    expect(toolMessage).toBeDefined();
    expect(toolMessage?.content).toBeDefined();

    const toolContent = JSON.parse(toolMessage!.content as string);
    expect(toolContent.error).toContain("failingTool");
    expect(toolContent.error).toContain("Database connection failed");
    expect(toolContent.status).toBe("error");
  });

  it("should allow agent to continue after tool error", async () => {
    let toolCallCount = 0;

    const sometimesFailingTool = defineTool(
      {
        name: "sometimesFailingTool",
        description: "A tool that fails on first call",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      async () => {
        toolCallCount++;
        if (toolCallCount === 1) {
          throw new Error("First call failed");
        }
        return { success: true, attempt: toolCallCount };
      },
    );

    let providerCallIndex = 0;
    const mockProvider: LLMProvider = {
      async chat(_req: ChatRequest): Promise<ChatResponse> {
        providerCallIndex++;
        if (providerCallIndex === 1) {
          return toolCallResponse("sometimesFailingTool", {});
        }
        if (providerCallIndex === 2) {
          return toolCallResponse("sometimesFailingTool", {});
        }
        return textResponse("Completed after retry");
      },
    };

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [sometimesFailingTool],
    });

    const result = await agent.run("test", { maxToolIterations: 5 });

    expect(result).toBe("Completed after retry");
    expect(toolCallCount).toBe(2);
  });

  it("should log errors with tool name, message, stack trace, and arguments", async () => {
    const failingTool = defineTool(
      {
        name: "logTestTool",
        description: "A tool for testing logging",
        parameters: {
          type: "object",
          properties: {
            testArg: { type: "string" },
          },
        },
      },
      async () => {
        throw new Error("Logged error message");
      },
    );

    const logEvents: AgentLogEvent[] = [];
    const logger = (event: AgentLogEvent) => {
      logEvents.push(event);
    };

    const mockProvider = createMockProvider([
      toolCallResponse("logTestTool", { testArg: "test value" }),
      textResponse("Done"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [failingTool],
    });

    await agent.run("test", { metadata: { logger } });

    const errorLogEvent = logEvents.find(
      (e) =>
        e.type === "tool_result" &&
        e.data.error === "Logged error message",
    );

    expect(errorLogEvent).toBeDefined();
    expect(errorLogEvent?.data.name).toBe("logTestTool");
    expect(errorLogEvent?.data.error).toBe("Logged error message");
    expect(errorLogEvent?.data.stack).toBeDefined();
    expect(errorLogEvent?.data.args).toEqual({ testArg: "test value" });
  });

  it("should handle non-Error thrown values", async () => {
    const stringThrowingTool = defineTool(
      {
        name: "stringThrower",
        description: "Throws a string",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      async () => {
        throw "A string error"; // eslint-disable-line no-throw-literal
      },
    );

    const { provider, requests } = createCapturingProvider([
      toolCallResponse("stringThrower", {}),
      textResponse("Handled string error"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [stringThrowingTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Handled string error");

    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");
    const toolContent = JSON.parse(toolMessage!.content as string);

    expect(toolContent.error).toContain("A string error");
    expect(toolContent.status).toBe("error");
  });

  it("should handle unknown thrown values", async () => {
    const unknownThrowingTool = defineTool(
      {
        name: "unknownThrower",
        description: "Throws an unknown value",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      async () => {
        throw { custom: "object" }; // eslint-disable-line no-throw-literal
      },
    );

    const { provider, requests } = createCapturingProvider([
      toolCallResponse("unknownThrower", {}),
      textResponse("Handled unknown error"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [unknownThrowingTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Handled unknown error");

    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");
    const toolContent = JSON.parse(toolMessage!.content as string);

    expect(toolContent.error).toContain("Unknown error occurred");
    expect(toolContent.status).toBe("error");
  });

  it("should handle sync tools that throw", async () => {
    const failingSyncTool = defineSyncTool(
      {
        name: "failingSyncTool",
        description: "A sync tool that throws",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      () => {
        throw new Error("Sync tool error");
      },
    );

    const mockProvider = createMockProvider([
      toolCallResponse("failingSyncTool", {}),
      textResponse("Sync error handled"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [failingSyncTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Sync error handled");
  });

  it("should handle tool not found", async () => {
    const existingTool = createSuccessTool("existingTool", () => ({ ok: true }));

    const { provider, requests } = createCapturingProvider([
      // Model calls a tool that doesn't exist
      toolCallResponse("nonExistentTool", {}),
      textResponse("Handled missing tool"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [existingTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Handled missing tool");

    // Verify error message was sent back
    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");
    const toolContent = JSON.parse(toolMessage!.content as string);

    expect(toolContent.error).toBe("Tool not found");
  });

  it("should handle invalid JSON arguments from model", async () => {
    const validTool = createSuccessTool("validTool", () => ({ ok: true }));

    // Custom provider that returns malformed arguments
    const { provider, requests } = createCapturingProvider([
      {
        message: {
          role: "assistant",
          content: null,
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "validTool",
                arguments: "not valid json {",
              },
            },
          ],
        },
        finishReason: "tool_calls",
      },
      textResponse("Handled invalid JSON"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [validTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Handled invalid JSON");

    // Verify error message was sent back
    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");
    const toolContent = JSON.parse(toolMessage!.content as string);

    expect(toolContent.error).toContain("Invalid arguments JSON");
  });
});

// ======== Max Iterations and Edge Cases ========

describe("createAgent - Max Iterations", () => {
  it("should throw on max iterations exceeded", async () => {
    const infiniteTool = createSuccessTool("infiniteTool", () => ({ continue: true }));

    // Provider always returns tool calls
    const mockProvider = createCustomProvider(() => {
      return toolCallResponse("infiniteTool", {});
    });

    const agent = createAgent({
      name: "infiniteAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [infiniteTool],
    });

    await expect(agent.run("test", { maxToolIterations: 3 })).rejects.toThrow(
      "Agent exceeded maxToolIterations without finishing",
    );
  });

  it("should track iteration count correctly", async () => {
    const tool = createSuccessTool("countTool", () => ({ ok: true }));

    let callCount = 0;
    const mockProvider = createCustomProvider(() => {
      callCount++;
      if (callCount < 3) {
        return toolCallResponse("countTool", {});
      }
      return textResponse("Done after 3 iterations");
    });

    const agent = createAgent({
      name: "countAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    const result = await agent.run("test", { maxToolIterations: 5 });

    expect(result).toBe("Done after 3 iterations");
    expect(callCount).toBe(3);
  });

  it("should use default maxToolIterations of 4", async () => {
    const tool = createSuccessTool("defaultIterTool", () => ({ ok: true }));

    let callCount = 0;
    const mockProvider = createCustomProvider(() => {
      callCount++;
      return toolCallResponse("defaultIterTool", {});
    });

    const agent = createAgent({
      name: "defaultIterAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    await expect(agent.run("test")).rejects.toThrow(
      "Agent exceeded maxToolIterations without finishing",
    );

    // Default is 4, so should have been called 4 times
    expect(callCount).toBe(4);
  });
});

// ======== Structured Output Tests ========

describe("createAgent - Structured Output", () => {
  it("should validate structured output against schema", async () => {
    const outputSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const mockProvider = createMockProvider([
      textResponse(JSON.stringify({ name: "Alice", age: 30 })),
    ]);

    const agent = createAgent({
      name: "structuredAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      outputSchema,
    });

    const result = await agent.run("Get user info");

    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("should throw on schema validation failure", async () => {
    const outputSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const mockProvider = createMockProvider([
      // Missing 'age' field
      textResponse(JSON.stringify({ name: "Alice" })),
    ]);

    const agent = createAgent({
      name: "strictAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      outputSchema,
    });

    await expect(agent.run("Get user info")).rejects.toThrow();
  });

  it("should throw on invalid JSON from model", async () => {
    const outputSchema = z.object({
      data: z.string(),
    });

    const mockProvider = createMockProvider([
      textResponse("This is not JSON"),
    ]);

    const agent = createAgent({
      name: "jsonAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      outputSchema,
    });

    await expect(agent.run("Get data")).rejects.toThrow(
      /Failed to parse structured output as JSON/,
    );
  });

  it("should extract JSON from markdown code blocks", async () => {
    const outputSchema = z.object({
      result: z.string(),
    });

    const mockProvider = createMockProvider([
      textResponse('Here is the result:\n```json\n{"result": "success"}\n```'),
    ]);

    const agent = createAgent({
      name: "markdownAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      outputSchema,
    });

    const result = await agent.run("Get result");

    expect(result).toEqual({ result: "success" });
  });

  it("should handle deeply nested schemas", async () => {
    const outputSchema = z.object({
      level1: z.object({
        level2: z.object({
          level3: z.object({
            value: z.string(),
          }),
        }),
      }),
    });

    const mockProvider = createMockProvider([
      textResponse(
        JSON.stringify({
          level1: {
            level2: {
              level3: {
                value: "deep",
              },
            },
          },
        }),
      ),
    ]);

    const agent = createAgent({
      name: "deepAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      outputSchema,
    });

    const result = await agent.run("Get deep value");

    expect(result).toEqual({
      level1: {
        level2: {
          level3: {
            value: "deep",
          },
        },
      },
    });
  });

  it("should pass responseFormat to provider when outputSchema is defined", async () => {
    const outputSchema = z.object({
      name: z.string(),
    });

    const { provider, requests } = createCapturingProvider([
      textResponse(JSON.stringify({ name: "test" })),
    ]);

    const agent = createAgent({
      name: "formatAgent",
      model: {
        provider,
        model: "test-model",
      },
      outputSchema,
    });

    await agent.run("test");

    expect(requests[0].responseFormat).toBeDefined();
    expect(requests[0].responseFormat?.type).toBe("json_schema");
    expect(requests[0].responseFormat?.jsonSchema.strict).toBe(true);
  });
});

// ======== Input Schema Tests ========

describe("createAgent - Input Schema", () => {
  it("should validate input against schema", async () => {
    const inputSchema = z.object({
      query: z.string(),
      limit: z.number().default(10),
    });

    const { provider, requests } = createCapturingProvider([
      textResponse("Search results"),
    ]);

    const agent = createAgent({
      name: "inputAgent",
      model: {
        provider,
        model: "test-model",
      },
      inputSchema,
    });

    await agent.run({ query: "test" });

    // Check the user message content
    const userMessage = requests[0].messages.find((m: Message) => m.role === "user");
    const content = JSON.parse(userMessage!.content as string);
    expect(content.query).toBe("test");
    expect(content.limit).toBe(10); // Default applied
  });

  it("should throw on invalid input", async () => {
    const inputSchema = z.object({
      query: z.string(),
    });

    const mockProvider = createMockProvider([
      textResponse("Result"),
    ]);

    const agent = createAgent({
      name: "strictInputAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      inputSchema,
    });

    // @ts-expect-error - Testing runtime validation
    await expect(agent.run({ invalid: "input" })).rejects.toThrow();
  });
});

// ======== Logging and Events Tests ========

describe("createAgent - Logging", () => {
  it("should call logger with model_call events", async () => {
    const logEvents: AgentLogEvent[] = [];
    const logger = (event: AgentLogEvent) => {
      logEvents.push(event);
    };

    const mockProvider = createMockProvider([
      textResponse("Response"),
    ]);

    const agent = createTestAgent(mockProvider);
    await agent.run("test", { metadata: { logger } });

    const modelCallEvents = logEvents.filter((e) => e.type === "model_call");
    expect(modelCallEvents.length).toBeGreaterThan(0);
  });

  it("should call logger with tool_call and tool_result events", async () => {
    const logEvents: AgentLogEvent[] = [];
    const logger = (event: AgentLogEvent) => {
      logEvents.push(event);
    };

    const tool = createSuccessTool("loggedTool", () => ({ result: "success" }));

    const mockProvider = createMockProvider([
      toolCallResponse("loggedTool", { arg: "value" }),
      textResponse("Done"),
    ]);

    const agent = createAgent({
      name: "loggingAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("test", { metadata: { logger } });

    const toolCallEvent = logEvents.find((e) => e.type === "tool_call");
    expect(toolCallEvent).toBeDefined();
    expect(toolCallEvent?.data.name).toBe("loggedTool");
    expect(toolCallEvent?.data.args).toEqual({ arg: "value" });

    const toolResultEvent = logEvents.find(
      (e) => e.type === "tool_result" && e.data.result,
    );
    expect(toolResultEvent).toBeDefined();
    expect(toolResultEvent?.data.result).toEqual({ result: "success" });
  });

  it("should call logger with final event", async () => {
    const logEvents: AgentLogEvent[] = [];
    const logger = (event: AgentLogEvent) => {
      logEvents.push(event);
    };

    const mockProvider = createMockProvider([
      textResponse("Final response"),
    ]);

    const agent = createTestAgent(mockProvider);
    await agent.run("test", { metadata: { logger } });

    const finalEvent = logEvents.find((e) => e.type === "final");
    expect(finalEvent).toBeDefined();
    expect(finalEvent?.data.content).toBe("Final response");
  });
});

// ======== Message History Tests ========

describe("createAgent - Message History", () => {
  it("should build correct message history with tool calls", async () => {
    const tool = createSuccessTool("historyTool", () => ({ data: "result" }));

    const { provider, requests } = createCapturingProvider([
      toolCallResponse("historyTool", { input: "test" }),
      textResponse("Final answer"),
    ]);

    const agent = createAgent({
      name: "historyAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("Initial prompt");

    // Second request should have history from first iteration
    const secondRequest = requests[1];
    const messages = secondRequest.messages;

    // Should have: user, assistant (with tool call), tool result
    // Note: The capturing provider captures the request BEFORE the response is added
    expect(messages.length).toBeGreaterThanOrEqual(3);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].toolCalls).toBeDefined();
    expect(messages[2].role).toBe("tool");
  });

  it("should include all tool interactions in history for multi-step chains", async () => {
    const tool = createSuccessTool("chainTool", () => ({ next: true }));

    const { provider, requests } = createCapturingProvider([
      toolCallResponse("chainTool", { step: 1 }),
      toolCallResponse("chainTool", { step: 2 }),
      textResponse("Done"),
    ]);

    const agent = createAgent({
      name: "chainAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("Start chain");

    // Third request should have full history from two iterations
    const thirdRequest = requests[2];
    const messages = thirdRequest.messages;

    // Should have: user, assistant+tool call, tool result, assistant+tool call, tool result
    // Note: The capturing provider captures the request which includes all previous messages
    // There may be additional assistant messages from previous iterations being included
    expect(messages.length).toBeGreaterThanOrEqual(5);
    expect(messages.filter((m: Message) => m.role === "tool")).toHaveLength(2);
    // At least 2 assistant messages (one per tool call iteration), possibly more
    expect(messages.filter((m: Message) => m.role === "assistant").length).toBeGreaterThanOrEqual(2);
  });
});

// ======== runWithHistory Tests ========

describe("createAgent - runWithHistory", () => {
  it("should return full message history", async () => {
    const mockProvider = createMockProvider([
      textResponse("Final response"),
    ]);

    const agent = createAgent({
      name: "historyAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      systemPrompt: "You are a test agent.",
    });

    const result = await agent.runWithHistory("Test input");

    expect(result.output).toBe("Final response");
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThanOrEqual(2);

    // Should have system and user messages
    expect(result.messages[0].role).toBe("system");
    expect(result.messages[1].role).toBe("user");

    // Should have assistant message
    const assistantMsg = result.messages.find((m: Message) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toBe("Final response");
  });

  it("should include all tool calls and results", async () => {
    const tool = createSuccessTool("historyTool", () => ({ data: "result" }));

    const mockProvider = createMockProvider([
      toolCallResponse("historyTool", { input: "test" }),
      textResponse("Final answer based on tool result"),
    ]);

    const agent = createAgent({
      name: "toolHistoryAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    const result = await agent.runWithHistory("Use the tool");

    expect(result.output).toBe("Final answer based on tool result");

    // Should include tool messages in history
    const toolMessages = result.messages.filter((m: Message) => m.role === "tool");
    expect(toolMessages).toHaveLength(1);

    // Should include assistant message with tool calls
    const assistantWithToolCalls = result.messages.find(
      (m: Message) => m.role === "assistant" && m.toolCalls
    );
    expect(assistantWithToolCalls).toBeDefined();
  });

  it("should track iteration count", async () => {
    const tool = createSuccessTool("iterTool", () => ({ ok: true }));

    const mockProvider = createMockProvider([
      toolCallResponse("iterTool", {}),
      toolCallResponse("iterTool", {}),
      textResponse("Done after 3 iterations"),
    ]);

    const agent = createAgent({
      name: "iterAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    const result = await agent.runWithHistory("Count iterations");

    expect(result.output).toBe("Done after 3 iterations");
    expect(result.iterations).toBe(3);
  });

  it("should track single iteration without tools", async () => {
    const mockProvider = createMockProvider([
      textResponse("Quick response"),
    ]);

    const agent = createTestAgent(mockProvider);
    const result = await agent.runWithHistory("Simple query");

    expect(result.output).toBe("Quick response");
    expect(result.iterations).toBe(1);
  });

  it("should throw error when stream option is true", async () => {
    const mockProvider = createMockProvider([
      textResponse("Response"),
    ]);

    const agent = createTestAgent(mockProvider);

    await expect(agent.runWithHistory("test", { stream: true })).rejects.toThrow(
      "createAgent: Streaming not implemented yet in runWithHistory",
    );
  });

  it("should throw on max iterations exceeded", async () => {
    const tool = createSuccessTool("infiniteTool", () => ({ continue: true }));

    const mockProvider = createCustomProvider(() => {
      return toolCallResponse("infiniteTool", {});
    });

    const agent = createAgent({
      name: "infiniteAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    await expect(agent.runWithHistory("test", { maxToolIterations: 3 })).rejects.toThrow(
      "Agent exceeded maxToolIterations without finishing",
    );
  });

  it("should validate structured output and return parsed result", async () => {
    const outputSchema = z.object({
      name: z.string(),
      count: z.number(),
    });

    const mockProvider = createMockProvider([
      textResponse(JSON.stringify({ name: "test", count: 42 })),
    ]);

    const agent = createAgent({
      name: "structuredHistoryAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      outputSchema,
    });

    const result = await agent.runWithHistory("Get structured data");

    expect(result.output).toEqual({ name: "test", count: 42 });
    expect(result.iterations).toBe(1);
    expect(result.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("should extract JSON from markdown in runWithHistory", async () => {
    const outputSchema = z.object({
      value: z.string(),
    });

    const mockProvider = createMockProvider([
      textResponse('```json\n{"value": "extracted"}\n```'),
    ]);

    const agent = createAgent({
      name: "markdownHistoryAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      outputSchema,
    });

    const result = await agent.runWithHistory("Get data");

    expect(result.output).toEqual({ value: "extracted" });
  });

  it("should throw on invalid JSON in runWithHistory with outputSchema", async () => {
    const outputSchema = z.object({
      data: z.string(),
    });

    const mockProvider = createMockProvider([
      textResponse("Not JSON content"),
    ]);

    const agent = createAgent({
      name: "invalidJsonAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      outputSchema,
    });

    await expect(agent.runWithHistory("Get data")).rejects.toThrow(
      /Failed to parse structured output as JSON/,
    );
  });

  it("should call logger with events during runWithHistory", async () => {
    const logEvents: AgentLogEvent[] = [];
    const logger = (event: AgentLogEvent) => {
      logEvents.push(event);
    };

    const mockProvider = createMockProvider([
      textResponse("Logged response"),
    ]);

    const agent = createTestAgent(mockProvider);
    await agent.runWithHistory("test", { metadata: { logger } });

    const modelCallEvents = logEvents.filter((e) => e.type === "model_call");
    const finalEvent = logEvents.find((e) => e.type === "final");

    expect(modelCallEvents.length).toBeGreaterThan(0);
    expect(finalEvent).toBeDefined();
  });

  it("should handle multi-step tool chains with full history", async () => {
    const tool1 = createSuccessTool("tool1", () => ({ step: 1 }));
    const tool2 = createSuccessTool("tool2", () => ({ step: 2 }));

    const mockProvider = createMockProvider([
      toolCallResponse("tool1", {}),
      toolCallResponse("tool2", {}),
      textResponse("Both tools executed"),
    ]);

    const agent = createAgent({
      name: "multiToolAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool1, tool2],
    });

    const result = await agent.runWithHistory("Execute tools");

    expect(result.output).toBe("Both tools executed");
    expect(result.iterations).toBe(3);

    // Should have all tool messages
    const toolMessages = result.messages.filter((m: Message) => m.role === "tool");
    expect(toolMessages).toHaveLength(2);
  });

  it("should include toolCallId on tool result messages", async () => {
    const tool = createSuccessTool("idTool", () => ({ result: "success" }));

    const mockProvider = createMockProvider([
      {
        message: {
          role: "assistant",
          content: null,
          toolCalls: [
            {
              id: "specific_call_id_123",
              type: "function",
              function: {
                name: "idTool",
                arguments: "{}",
              },
            },
          ],
        },
        finishReason: "tool_calls",
      },
      textResponse("Tool completed"),
    ]);

    const agent = createAgent({
      name: "toolIdAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    const result = await agent.runWithHistory("Call tool");

    // Find the tool message and verify toolCallId
    const toolMessage = result.messages.find((m: Message) => m.role === "tool");
    expect(toolMessage).toBeDefined();
    expect(toolMessage?.toolCallId).toBe("specific_call_id_123");

    // Verify tool result content
    const toolContent = JSON.parse(toolMessage!.content as string);
    expect(toolContent.result).toBe("success");
  });

  it("should contain all message types: system, user, assistant, tool", async () => {
    const tool = createSuccessTool("allTypesTool", () => ({ data: "test" }));

    const mockProvider = createMockProvider([
      toolCallResponse("allTypesTool", { input: "value" }),
      textResponse("Final answer"),
    ]);

    const agent = createAgent({
      name: "allTypesAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      systemPrompt: "System instructions here",
      tools: [tool],
    });

    const result = await agent.runWithHistory("User query");

    // Verify all message types are present
    const systemMessages = result.messages.filter((m: Message) => m.role === "system");
    const userMessages = result.messages.filter((m: Message) => m.role === "user");
    const assistantMessages = result.messages.filter((m: Message) => m.role === "assistant");
    const toolMessages = result.messages.filter((m: Message) => m.role === "tool");

    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0].content).toBe("System instructions here");

    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].content).toBe("User query");

    // 2 assistant messages: one with tool call, one with final response
    expect(assistantMessages).toHaveLength(2);
    expect(assistantMessages[0].toolCalls).toBeDefined();
    expect(assistantMessages[1].content).toBe("Final answer");

    expect(toolMessages).toHaveLength(1);
    expect(toolMessages[0].toolCallId).toBeDefined();
  });

  it("should handle multiple parallel tool calls in single iteration", async () => {
    const tool1 = createSuccessTool("parallelTool1", () => ({ a: 1 }));
    const tool2 = createSuccessTool("parallelTool2", () => ({ b: 2 }));

    const mockProvider = createMockProvider([
      multiToolCallResponse([
        { name: "parallelTool1", arguments: {}, id: "call_a" },
        { name: "parallelTool2", arguments: {}, id: "call_b" },
      ]),
      textResponse("Both tools called in parallel"),
    ]);

    const agent = createAgent({
      name: "parallelHistoryAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool1, tool2],
    });

    const result = await agent.runWithHistory("Call tools in parallel");

    expect(result.output).toBe("Both tools called in parallel");
    expect(result.iterations).toBe(2);

    // Should have 2 tool messages with correct IDs
    const toolMessages = result.messages.filter((m: Message) => m.role === "tool");
    expect(toolMessages).toHaveLength(2);

    const toolCallIds = toolMessages.map((m: Message) => m.toolCallId);
    expect(toolCallIds).toContain("call_a");
    expect(toolCallIds).toContain("call_b");

    // Verify tool results
    const tool1Result = toolMessages.find((m: Message) => m.toolCallId === "call_a");
    const tool2Result = toolMessages.find((m: Message) => m.toolCallId === "call_b");

    expect(JSON.parse(tool1Result!.content as string)).toEqual({ a: 1 });
    expect(JSON.parse(tool2Result!.content as string)).toEqual({ b: 2 });
  });

  it("should return correct message order in history", async () => {
    const tool = createSuccessTool("orderTool", () => ({ step: "done" }));

    const mockProvider = createMockProvider([
      toolCallResponse("orderTool", {}),
      textResponse("Complete"),
    ]);

    const agent = createAgent({
      name: "orderAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      systemPrompt: "Be helpful",
      tools: [tool],
    });

    const result = await agent.runWithHistory("Test order");

    // Verify exact message order: system, user, assistant (tool call), tool, assistant (final)
    expect(result.messages.length).toBe(5);
    expect(result.messages[0].role).toBe("system");
    expect(result.messages[1].role).toBe("user");
    expect(result.messages[2].role).toBe("assistant");
    expect(result.messages[2].toolCalls).toBeDefined();
    expect(result.messages[3].role).toBe("tool");
    expect(result.messages[4].role).toBe("assistant");
    expect(result.messages[4].content).toBe("Complete");
  });

  it("should handle tool errors and include error in history", async () => {
    const failingTool = createFailingTool("errorTool", "Tool execution failed");

    const mockProvider = createMockProvider([
      toolCallResponse("errorTool", {}),
      textResponse("Handled the error gracefully"),
    ]);

    const agent = createAgent({
      name: "errorHistoryAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [failingTool],
    });

    const result = await agent.runWithHistory("Call failing tool");

    expect(result.output).toBe("Handled the error gracefully");
    expect(result.iterations).toBe(2);

    // Verify error is in the tool message
    const toolMessage = result.messages.find((m: Message) => m.role === "tool");
    expect(toolMessage).toBeDefined();

    const toolContent = JSON.parse(toolMessage!.content as string);
    expect(toolContent.status).toBe("error");
    expect(toolContent.error).toContain("Tool execution failed");
  });

  it("should work without system prompt", async () => {
    const mockProvider = createMockProvider([
      textResponse("Response without system"),
    ]);

    const agent = createAgent({
      name: "noSystemAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      // No systemPrompt
    });

    const result = await agent.runWithHistory("User input only");

    expect(result.output).toBe("Response without system");
    expect(result.iterations).toBe(1);

    // Should not have system message
    const systemMessages = result.messages.filter((m: Message) => m.role === "system");
    expect(systemMessages).toHaveLength(0);

    // Should have user and assistant
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[1].role).toBe("assistant");
  });

  it("should track five iterations correctly", async () => {
    const tool = createSuccessTool("manyIterTool", () => ({ continue: true }));

    const mockProvider = createMockProvider([
      toolCallResponse("manyIterTool", {}),
      toolCallResponse("manyIterTool", {}),
      toolCallResponse("manyIterTool", {}),
      toolCallResponse("manyIterTool", {}),
      textResponse("Done after 5 iterations"),
    ]);

    const agent = createAgent({
      name: "manyIterAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    const result = await agent.runWithHistory("Run many iterations", { maxToolIterations: 10 });

    expect(result.output).toBe("Done after 5 iterations");
    expect(result.iterations).toBe(5);

    // Should have 4 tool messages (4 tool calls)
    const toolMessages = result.messages.filter((m: Message) => m.role === "tool");
    expect(toolMessages).toHaveLength(4);

    // Should have 5 assistant messages (one per iteration)
    const assistantMessages = result.messages.filter((m: Message) => m.role === "assistant");
    expect(assistantMessages).toHaveLength(5);
  });
});

// ======== Provider Configuration Tests ========

describe("createAgent - Provider Configuration", () => {
  it("should pass temperature to provider", async () => {
    const { provider, requests } = createCapturingProvider([
      textResponse("Response"),
    ]);

    const agent = createAgent({
      name: "tempAgent",
      model: {
        provider,
        model: "test-model",
        temperature: 0.7,
      },
    });

    await agent.run("test");

    expect(requests[0].temperature).toBe(0.7);
  });

  it("should pass maxTokens to provider", async () => {
    const { provider, requests } = createCapturingProvider([
      textResponse("Response"),
    ]);

    const agent = createAgent({
      name: "tokensAgent",
      model: {
        provider,
        model: "test-model",
        maxTokens: 1000,
      },
    });

    await agent.run("test");

    expect(requests[0].maxTokens).toBe(1000);
  });

  it("should pass metadata to provider", async () => {
    const { provider, requests } = createCapturingProvider([
      textResponse("Response"),
    ]);

    const agent = createTestAgent(provider);
    await agent.run("test", { metadata: { customKey: "customValue" } });

    expect(requests[0].metadata).toEqual({ customKey: "customValue" });
  });

  it("should convert tools to chat tools format", async () => {
    const tool = defineTool(
      {
        name: "formattedTool",
        description: "A properly formatted tool",
        parameters: {
          type: "object",
          properties: {
            input: { type: "string" },
          },
          required: ["input"],
        },
      },
      async () => ({}),
    );

    const { provider, requests } = createCapturingProvider([
      textResponse("Response"),
    ]);

    const agent = createAgent({
      name: "formatAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("test");

    expect(requests[0].tools).toEqual([
      {
        type: "function",
        function: {
          name: "formattedTool",
          description: "A properly formatted tool",
          parameters: {
            type: "object",
            properties: {
              input: { type: "string" },
            },
            required: ["input"],
          },
        },
      },
    ]);
  });
});

// ======== Streaming Tests ========

describe("createAgent - Streaming", () => {
  it("should throw error when stream option is true in run()", async () => {
    const mockProvider = createMockProvider([
      textResponse("Response"),
    ]);

    const agent = createTestAgent(mockProvider);

    await expect(agent.run("test", { stream: true })).rejects.toThrow(
      "createAgent: Streaming not implemented yet in run",
    );
  });

  // ======== Basic Streaming Tests ========

  describe("stream() - Basic Functionality", () => {
    it("should stream basic response content", async () => {
      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks("Hello, world!"),
      ]);

      const agent = createAgent({
        name: "streamAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
      });

      const stream = agent.stream("Say hello");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should have content chunks and a done chunk
      const contentChunks = chunks.filter((c) => c.type === "content");
      const doneChunks = chunks.filter((c) => c.type === "done");

      expect(contentChunks.length).toBe(13); // "Hello, world!" = 13 chars
      expect(doneChunks.length).toBe(1);

      // Verify content accumulates correctly
      const fullContent = contentChunks
        .map((c) => (c.type === "content" ? c.content : ""))
        .join("");
      expect(fullContent).toBe("Hello, world!");
    });

    it("should emit done chunk when stream completes", async () => {
      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks("Response"),
      ]);

      const agent = createTestAgent(mockProvider);
      const stream = agent.stream("test");

      let lastChunk: StreamChunk | undefined;
      for await (const chunk of stream) {
        lastChunk = chunk;
      }

      expect(lastChunk).toBeDefined();
      expect(lastChunk?.type).toBe("done");
    });

    it("should return async iterable from stream()", async () => {
      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks("Test"),
      ]);

      const agent = createTestAgent(mockProvider);
      const stream = agent.stream("test");

      // Verify it's an async iterable
      expect(stream[Symbol.asyncIterator]).toBeDefined();
      expect(typeof stream[Symbol.asyncIterator]).toBe("function");

      // Consume the stream
      const chunks: StreamChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle empty content response", async () => {
      const mockProvider = createStreamingMockProvider([
        [{ finishReason: "stop" }],
      ]);

      const agent = createTestAgent(mockProvider);
      const stream = agent.stream("test");

      const chunks: StreamChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should only have done chunk
      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe("done");

      const result = await stream.finalResult();
      expect(result.output).toBe("");
    });
  });

  // ======== finalResult() Tests ========

  describe("stream() - finalResult()", () => {
    it("should provide finalResult() with complete history", async () => {
      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks("The answer is 42"),
      ]);

      const agent = createAgent({
        name: "historyAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        systemPrompt: "You are a test agent.",
      });

      const stream = agent.stream("What is the meaning of life?");

      // Consume the stream
      for await (const _chunk of stream) {
        // Just consume
      }

      const result = await stream.finalResult();

      expect(result.output).toBe("The answer is 42");
      expect(result.messages).toBeDefined();
      expect(result.iterations).toBe(1);

      // Verify message structure
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[1].role).toBe("user");
      expect(result.messages[2].role).toBe("assistant");
      expect(result.messages[2].content).toBe("The answer is 42");
    });

    it("should wait for stream to complete if finalResult() called early", async () => {
      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks("Delayed result"),
      ]);

      const agent = createTestAgent(mockProvider);
      const stream = agent.stream("test");

      // Call finalResult() without consuming the stream
      const result = await stream.finalResult();

      expect(result.output).toBe("Delayed result");
      expect(result.iterations).toBe(1);
    });

    it("should track iteration count correctly", async () => {
      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks("First response"),
      ]);

      const agent = createTestAgent(mockProvider);
      const stream = agent.stream("test");

      for await (const _chunk of stream) {
        // Consume
      }

      const result = await stream.finalResult();
      expect(result.iterations).toBe(1);
    });

    it("should include all tool messages in history", async () => {
      const tool = createSuccessTool("dataTool", () => ({ data: "result" }));

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("dataTool", { query: "test" }),
        createTextStreamChunks("Here is your data"),
      ]);

      const agent = createAgent({
        name: "toolHistoryAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [tool],
      });

      const stream = agent.stream("Get data");
      for await (const _chunk of stream) {
        // Consume
      }

      const result = await stream.finalResult();

      // Should have: user, assistant (with tool call), tool result, assistant (final)
      expect(result.messages.length).toBeGreaterThanOrEqual(4);

      const toolMessages = result.messages.filter((m: Message) => m.role === "tool");
      expect(toolMessages).toHaveLength(1);

      const assistantMessages = result.messages.filter((m: Message) => m.role === "assistant");
      expect(assistantMessages).toHaveLength(2);
      expect(assistantMessages[0].toolCalls).toBeDefined();
    });

    it("should accumulate usage stats when available", async () => {
      const chunks: ChatStreamChunk[] = [
        { content: "Test" },
        {
          finishReason: "stop",
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
        },
      ];

      const mockProvider = createStreamingMockProvider([chunks]);
      const agent = createTestAgent(mockProvider);
      const stream = agent.stream("test");

      for await (const _chunk of stream) {
        // Consume
      }

      const result = await stream.finalResult();
      expect(result.usage).toBeDefined();
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(5);
      expect(result.usage?.totalTokens).toBe(15);
    });
  });

  // ======== Tool Calling During Streaming Tests ========

  describe("stream() - Tool Calling", () => {
    it("should emit tool_call chunks during streaming", async () => {
      const tool = createSuccessTool("testTool", () => ({ result: "ok" }));

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("testTool", { arg: "value" }),
        createTextStreamChunks("Tool executed"),
      ]);

      const agent = createAgent({
        name: "toolCallAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [tool],
      });

      const stream = agent.stream("Call the tool");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const toolCallChunks = chunks.filter((c) => c.type === "tool_call");
      expect(toolCallChunks).toHaveLength(1);

      if (toolCallChunks[0].type === "tool_call") {
        expect(toolCallChunks[0].toolCall.function.name).toBe("testTool");
      }
    });

    it("should execute tools during streaming", async () => {
      const toolSpy = vi.fn().mockResolvedValue({ executed: true });
      const tool = defineTool(
        {
          name: "spyTool",
          description: "Test spy tool",
          parameters: {
            type: "object",
            properties: {
              input: { type: "string" },
            },
          },
        },
        toolSpy,
      );

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("spyTool", { input: "test" }),
        createTextStreamChunks("Done"),
      ]);

      const agent = createAgent({
        name: "execAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [tool],
      });

      const stream = agent.stream("Execute tool");
      for await (const _chunk of stream) {
        // Consume
      }

      expect(toolSpy).toHaveBeenCalledTimes(1);
      expect(toolSpy).toHaveBeenCalledWith({ input: "test" }, expect.any(Object));
    });

    it("should emit tool_result chunks after tool execution", async () => {
      const tool = createSuccessTool("resultTool", () => ({ data: "tool result" }));

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("resultTool", {}),
        createTextStreamChunks("Got result"),
      ]);

      const agent = createAgent({
        name: "resultAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [tool],
      });

      const stream = agent.stream("Get result");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const toolResultChunks = chunks.filter((c) => c.type === "tool_result");
      expect(toolResultChunks).toHaveLength(1);

      if (toolResultChunks[0].type === "tool_result") {
        expect(toolResultChunks[0].toolResult.name).toBe("resultTool");
        expect(toolResultChunks[0].toolResult.result).toEqual({ data: "tool result" });
      }
    });

    it("should continue streaming after tool execution", async () => {
      const tool = createSuccessTool("continueTool", () => ({ ok: true }));

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("continueTool", {}),
        createTextStreamChunks("Continued after tool"),
      ]);

      const agent = createAgent({
        name: "continueAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [tool],
      });

      const stream = agent.stream("test");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // After tool_call and tool_result, should have content chunks
      const toolResultIndex = chunks.findIndex((c) => c.type === "tool_result");
      const contentAfterTool = chunks
        .slice(toolResultIndex + 1)
        .filter((c) => c.type === "content");

      expect(contentAfterTool.length).toBe(20); // "Continued after tool" = 20 chars
    });

    it("should handle multi-step tool chains during streaming", async () => {
      const tool1 = createSuccessTool("step1Tool", () => ({ step: 1 }));
      const tool2 = createSuccessTool("step2Tool", () => ({ step: 2 }));

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("step1Tool", {}),
        createToolCallStreamChunks("step2Tool", {}),
        createTextStreamChunks("Both tools executed"),
      ]);

      const agent = createAgent({
        name: "multiStepAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [tool1, tool2],
      });

      const stream = agent.stream("Run both tools");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const toolCallChunks = chunks.filter((c) => c.type === "tool_call");
      const toolResultChunks = chunks.filter((c) => c.type === "tool_result");

      expect(toolCallChunks).toHaveLength(2);
      expect(toolResultChunks).toHaveLength(2);

      const result = await stream.finalResult();
      expect(result.iterations).toBe(3);
    });

    it("should handle multiple parallel tool calls in single iteration", async () => {
      const tool1 = createSuccessTool("parallelTool1", () => ({ t1: "result1" }));
      const tool2 = createSuccessTool("parallelTool2", () => ({ t2: "result2" }));

      const mockProvider = createStreamingMockProvider([
        createMultiToolCallStreamChunks([
          { name: "parallelTool1", arguments: {} },
          { name: "parallelTool2", arguments: {} },
        ]),
        createTextStreamChunks("Both executed"),
      ]);

      const agent = createAgent({
        name: "parallelAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [tool1, tool2],
      });

      const stream = agent.stream("Call both tools");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const toolCallChunks = chunks.filter((c) => c.type === "tool_call");
      const toolResultChunks = chunks.filter((c) => c.type === "tool_result");

      expect(toolCallChunks).toHaveLength(2);
      expect(toolResultChunks).toHaveLength(2);

      const result = await stream.finalResult();
      expect(result.iterations).toBe(2);
    });
  });

  // ======== Error Handling During Streaming Tests ========

  describe("stream() - Error Handling", () => {
    it("should handle tool execution errors gracefully", async () => {
      const failingTool = createFailingTool("failTool", "Tool crashed!");

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("failTool", {}),
        createTextStreamChunks("Handled the error"),
      ]);

      const agent = createAgent({
        name: "errorAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [failingTool],
      });

      const stream = agent.stream("Call failing tool");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should still complete despite error
      const doneChunks = chunks.filter((c) => c.type === "done");
      expect(doneChunks).toHaveLength(1);

      const result = await stream.finalResult();
      expect(result.output).toBe("Handled the error");
    });

    it("should emit tool_result with error info when tool fails", async () => {
      const failingTool = createFailingTool("errorTool", "Execution failed");

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("errorTool", {}),
        createTextStreamChunks("Recovered"),
      ]);

      const agent = createAgent({
        name: "errorResultAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [failingTool],
      });

      const stream = agent.stream("test");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const toolResultChunks = chunks.filter((c) => c.type === "tool_result");
      expect(toolResultChunks).toHaveLength(1);

      if (toolResultChunks[0].type === "tool_result") {
        expect(toolResultChunks[0].toolResult.result.status).toBe("error");
        expect(toolResultChunks[0].toolResult.result.error).toContain("Execution failed");
      }
    });

    it("should continue streaming after tool error", async () => {
      const failingTool = createFailingTool("failTool", "Error occurred");

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("failTool", {}),
        createTextStreamChunks("Continued after error"),
      ]);

      const agent = createAgent({
        name: "continueAfterErrorAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [failingTool],
      });

      const stream = agent.stream("test");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const contentChunks = chunks.filter((c) => c.type === "content");
      const content = contentChunks
        .map((c) => (c.type === "content" ? c.content : ""))
        .join("");

      expect(content).toBe("Continued after error");
    });

    it("should handle tool not found during streaming", async () => {
      const existingTool = createSuccessTool("existingTool", () => ({ ok: true }));

      // Provider returns call for non-existent tool
      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("nonExistentTool", {}),
        createTextStreamChunks("Handled missing tool"),
      ]);

      const agent = createAgent({
        name: "missingToolAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [existingTool],
      });

      const stream = agent.stream("test");
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const result = await stream.finalResult();
      expect(result.output).toBe("Handled missing tool");
    });

    it("should throw on max iterations exceeded during streaming", async () => {
      const tool = createSuccessTool("infiniteTool", () => ({ continue: true }));

      // Provider always returns tool calls
      let callIndex = 0;
      const mockProvider = createCustomStreamingProvider(() => {
        callIndex++;
        return (async function* () {
          yield* createToolCallStreamChunks("infiniteTool", {});
        })();
      });

      const agent = createAgent({
        name: "infiniteStreamAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [tool],
      });

      const stream = agent.stream("test", { maxToolIterations: 3 });

      await expect(async () => {
        for await (const _chunk of stream) {
          // Consume
        }
      }).rejects.toThrow("Agent exceeded maxToolIterations without finishing");
    });
  });

  // ======== Streaming Events Tests ========

  describe("stream() - Events", () => {
    it("should emit onEvent callbacks during streaming", async () => {
      const events: AgentEvent[] = [];
      const onEvent = (event: AgentEvent) => events.push(event);

      const tool = createSuccessTool("eventTool", () => ({ ok: true }));

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("eventTool", { arg: "value" }),
        createTextStreamChunks("Done"),
      ]);

      const agent = createAgent({
        name: "eventStreamAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [tool],
      });

      const stream = agent.stream("test", { onEvent });
      for await (const _chunk of stream) {
        // Consume
      }

      // Check for model_call, tool_call, tool_result, model_call, complete
      expect(events.length).toBe(5);
      expect(events[0].type).toBe("model_call");
      expect(events[1].type).toBe("tool_call");
      expect(events[2].type).toBe("tool_result");
      expect(events[3].type).toBe("model_call");
      expect(events[4].type).toBe("complete");
    });

    it("should emit complete event with final output", async () => {
      const events: AgentEvent[] = [];
      const onEvent = (event: AgentEvent) => events.push(event);

      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks("Final output"),
      ]);

      const agent = createTestAgent(mockProvider);
      const stream = agent.stream("test", { onEvent });

      for await (const _chunk of stream) {
        // Consume
      }

      const completeEvent = events.find((e) => e.type === "complete");
      expect(completeEvent).toBeDefined();
      if (completeEvent?.type === "complete") {
        expect(completeEvent.output).toBe("Final output");
      }
    });

    it("should emit tool_error event when tool throws", async () => {
      const events: AgentEvent[] = [];
      const onEvent = (event: AgentEvent) => events.push(event);

      const failingTool = createFailingTool("failTool", "Stream error");

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("failTool", {}),
        createTextStreamChunks("Handled"),
      ]);

      const agent = createAgent({
        name: "errorEventAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [failingTool],
      });

      const stream = agent.stream("test", { onEvent });
      for await (const _chunk of stream) {
        // Consume
      }

      const toolErrorEvent = events.find((e) => e.type === "tool_error");
      expect(toolErrorEvent).toBeDefined();
      if (toolErrorEvent?.type === "tool_error") {
        expect(toolErrorEvent.name).toBe("failTool");
        expect(toolErrorEvent.error).toBe("Stream error");
      }
    });
  });

  // ======== Structured Output Streaming Tests ========

  describe("stream() - Structured Output", () => {
    it("should parse structured output from stream", async () => {
      const outputSchema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const jsonContent = JSON.stringify({ name: "test", value: 42 });
      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks(jsonContent),
      ]);

      const agent = createAgent({
        name: "structuredStreamAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        outputSchema,
      });

      const stream = agent.stream("Get structured data");
      for await (const _chunk of stream) {
        // Consume
      }

      const result = await stream.finalResult();
      expect(result.output).toEqual({ name: "test", value: 42 });
    });

    it("should extract JSON from markdown in streaming output", async () => {
      const outputSchema = z.object({
        result: z.string(),
      });

      const content = '```json\n{"result": "extracted"}\n```';
      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks(content),
      ]);

      const agent = createAgent({
        name: "markdownStreamAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        outputSchema,
      });

      const stream = agent.stream("test");
      for await (const _chunk of stream) {
        // Consume
      }

      const result = await stream.finalResult();
      expect(result.output).toEqual({ result: "extracted" });
    });

    it("should throw on invalid JSON in structured streaming output", async () => {
      const outputSchema = z.object({
        data: z.string(),
      });

      const mockProvider = createStreamingMockProvider([
        createTextStreamChunks("Not valid JSON"),
      ]);

      const agent = createAgent({
        name: "invalidJsonStreamAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        outputSchema,
      });

      const stream = agent.stream("test");

      await expect(async () => {
        for await (const _chunk of stream) {
          // Consume
        }
      }).rejects.toThrow(/Failed to parse structured output as JSON/);
    });
  });

  // ======== Request Capturing Tests ========

  describe("stream() - Request Verification", () => {
    it("should pass correct request parameters to provider", async () => {
      const { provider, requests } = createCapturingStreamingProvider([
        createTextStreamChunks("Response"),
      ]);

      const agent = createAgent({
        name: "paramAgent",
        model: {
          provider,
          model: "test-model",
          temperature: 0.5,
          maxTokens: 100,
        },
      });

      const stream = agent.stream("test");
      for await (const _chunk of stream) {
        // Consume
      }

      expect(requests.length).toBe(1);
      expect(requests[0].model).toBe("test-model");
      expect(requests[0].temperature).toBe(0.5);
      expect(requests[0].maxTokens).toBe(100);
      expect(requests[0].stream).toBe(true);
    });

    it("should include tools in streaming request", async () => {
      const tool = createSuccessTool("testTool", () => ({}));

      const { provider, requests } = createCapturingStreamingProvider([
        createTextStreamChunks("Response"),
      ]);

      const agent = createAgent({
        name: "toolRequestAgent",
        model: {
          provider,
          model: "test-model",
        },
        tools: [tool],
      });

      const stream = agent.stream("test");
      for await (const _chunk of stream) {
        // Consume
      }

      expect(requests[0].tools).toBeDefined();
      expect(requests[0].tools?.length).toBe(1);
      expect(requests[0].tools?.[0].function.name).toBe("testTool");
    });

    it("should build correct message history in streaming requests", async () => {
      const tool = createSuccessTool("historyTool", () => ({ data: "result" }));

      const { provider, requests } = createCapturingStreamingProvider([
        createToolCallStreamChunks("historyTool", {}),
        createTextStreamChunks("Final"),
      ]);

      const agent = createAgent({
        name: "historyRequestAgent",
        model: {
          provider,
          model: "test-model",
        },
        systemPrompt: "System prompt",
        tools: [tool],
      });

      const stream = agent.stream("User input");
      for await (const _chunk of stream) {
        // Consume
      }

      // First request: system + user
      expect(requests[0].messages[0].role).toBe("system");
      expect(requests[0].messages[1].role).toBe("user");

      // Second request: should include assistant with tool call and tool result
      expect(requests[1].messages.length).toBeGreaterThanOrEqual(4);
      const toolMessage = requests[1].messages.find((m: Message) => m.role === "tool");
      expect(toolMessage).toBeDefined();
    });
  });
});

// ======== Additional Error Handling Tests ========

describe("createAgent - Additional Error Handling", () => {
  it("should not leak stack traces in error results sent to model", async () => {
    const failingTool = defineTool(
      {
        name: "stackTraceTool",
        description: "Tool that throws with stack",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      async () => {
        // Create error with predictable stack trace content
        const error = new Error("Sensitive internal error");
        error.stack = "Error: Sensitive internal error\n    at secretFunction (/internal/path.ts:123:45)\n    at another (/private/file.ts:456:78)";
        throw error;
      },
    );

    const { provider, requests } = createCapturingProvider([
      toolCallResponse("stackTraceTool", {}),
      textResponse("Handled"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [failingTool],
    });

    await agent.run("test");

    // Verify error was sent but stack trace was not included
    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");
    const toolContent = JSON.parse(toolMessage!.content as string);

    // Error message should be present
    expect(toolContent.error).toContain("Sensitive internal error");
    // But stack trace details should NOT be in the content sent to model
    expect(toolContent.error).not.toContain("secretFunction");
    expect(toolContent.error).not.toContain("/internal/path.ts");
  });

  it("should handle tool name mismatch case-sensitively", async () => {
    const lowercaseTool = createSuccessTool("calculator", () => ({ result: 42 }));

    const { provider, requests } = createCapturingProvider([
      // Model requests uppercase version
      toolCallResponse("Calculator", {}),
      textResponse("Handled case mismatch"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [lowercaseTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Handled case mismatch");

    // Verify error message was sent for tool not found
    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");
    const toolContent = JSON.parse(toolMessage!.content as string);

    expect(toolContent.error).toBe("Tool not found");
  });

  it("should handle empty string in tool arguments", async () => {
    const validTool = createSuccessTool("validTool", () => ({ ok: true }));

    const { provider, requests } = createCapturingProvider([
      {
        message: {
          role: "assistant",
          content: null,
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "validTool",
                arguments: "", // Empty string - should be treated as empty object
              },
            },
          ],
        },
        finishReason: "tool_calls",
      },
      textResponse("Handled empty args"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [validTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Handled empty args");

    // Empty string is now treated as empty object, tool should execute successfully
    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");
    const toolContent = JSON.parse(toolMessage!.content as string);

    // Tool should have succeeded with empty args
    expect(toolContent).toEqual({ ok: true });
  });

  it("should handle null content in tool response gracefully", async () => {
    // When model returns null content but no tool calls, we should handle it
    const mockProvider = createMockProvider([
      {
        message: {
          role: "assistant",
          content: null, // Null content, no tool calls
          toolCalls: undefined,
        },
        finishReason: "stop",
      },
    ]);

    const agent = createTestAgent(mockProvider);
    const result = await agent.run("test");

    // Should return empty string when content is null
    expect(result).toBe("");
  });

  it("should handle missing finish reason gracefully", async () => {
    const mockProvider = createMockProvider([
      {
        message: {
          role: "assistant",
          content: "Response with missing finishReason",
        },
        finishReason: null, // Missing finish reason
      },
    ]);

    const agent = createTestAgent(mockProvider);
    const result = await agent.run("test");

    expect(result).toBe("Response with missing finishReason");
  });

  it("should include tool name in error message for failing tools", async () => {
    const failingTool = createFailingTool("specificToolName", "Custom error message");

    const { provider, requests } = createCapturingProvider([
      toolCallResponse("specificToolName", {}),
      textResponse("Done"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [failingTool],
    });

    await agent.run("test");

    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");
    const toolContent = JSON.parse(toolMessage!.content as string);

    // Error should contain both tool name and error message
    expect(toolContent.error).toContain("specificToolName");
    expect(toolContent.error).toContain("Custom error message");
  });

  it("should handle provider errors gracefully", async () => {
    const errorProvider: LLMProvider = {
      async chat(_req: ChatRequest): Promise<ChatResponse> {
        throw new Error("Network connection failed");
      },
    };

    const agent = createTestAgent(errorProvider);

    await expect(agent.run("test")).rejects.toThrow("Network connection failed");
  });

  it("should handle multiple errors in parallel tool calls", async () => {
    const errorCounts = { tool1: 0, tool2: 0 };

    const tool1 = defineTool(
      {
        name: "failTool1",
        description: "First failing tool",
        parameters: { type: "object", properties: {} },
      },
      async () => {
        errorCounts.tool1++;
        throw new Error("Tool 1 failed");
      },
    );

    const tool2 = defineTool(
      {
        name: "failTool2",
        description: "Second failing tool",
        parameters: { type: "object", properties: {} },
      },
      async () => {
        errorCounts.tool2++;
        throw new Error("Tool 2 failed");
      },
    );

    const { provider, requests } = createCapturingProvider([
      multiToolCallResponse([
        { name: "failTool1", arguments: {} },
        { name: "failTool2", arguments: {} },
      ]),
      textResponse("Both tools failed but agent continued"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [tool1, tool2],
    });

    const result = await agent.run("test");

    expect(result).toBe("Both tools failed but agent continued");
    expect(errorCounts.tool1).toBe(1);
    expect(errorCounts.tool2).toBe(1);

    // Verify both errors were reported
    const secondRequest = requests[1];
    const toolMessages = secondRequest.messages.filter((m: Message) => m.role === "tool");
    expect(toolMessages).toHaveLength(2);

    const toolContents = toolMessages.map((m: Message) => JSON.parse(m.content as string));
    expect(toolContents[0].status).toBe("error");
    expect(toolContents[1].status).toBe("error");
  });

  it("should log error with context during tool handler failure", async () => {
    const logEvents: AgentLogEvent[] = [];
    const logger = (event: AgentLogEvent) => {
      logEvents.push(event);
    };

    const failingTool = defineTool(
      {
        name: "contextLogTool",
        description: "Tool for testing error logging context",
        parameters: {
          type: "object",
          properties: {
            importantArg: { type: "string" },
          },
        },
      },
      async () => {
        throw new Error("Contextual error");
      },
    );

    const mockProvider = createMockProvider([
      toolCallResponse("contextLogTool", { importantArg: "testValue" }),
      textResponse("Done"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [failingTool],
    });

    await agent.run("test", { metadata: { logger } });

    // Find the error log event
    const errorEvent = logEvents.find(
      (e) => e.type === "tool_result" && e.data.error,
    );

    expect(errorEvent).toBeDefined();
    expect(errorEvent?.data.name).toBe("contextLogTool");
    expect(errorEvent?.data.error).toBe("Contextual error");
    expect(errorEvent?.data.args).toEqual({ importantArg: "testValue" });
    // Stack should be logged (for debugging) but not sent to model
    expect(errorEvent?.data.stack).toBeDefined();
  });

  it("should handle deeply nested JSON parsing errors", async () => {
    const validTool = createSuccessTool("validTool", () => ({ ok: true }));

    const { provider, requests } = createCapturingProvider([
      {
        message: {
          role: "assistant",
          content: null,
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "validTool",
                arguments: '{"nested": {"deeply": {"broken": }}}', // Invalid nested JSON
              },
            },
          ],
        },
        finishReason: "tool_calls",
      },
      textResponse("Handled nested JSON error"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider,
        model: "test-model",
      },
      tools: [validTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Handled nested JSON error");

    const secondRequest = requests[1];
    const toolMessage = secondRequest.messages.find((m: Message) => m.role === "tool");
    const toolContent = JSON.parse(toolMessage!.content as string);

    expect(toolContent.error).toContain("Invalid arguments JSON");
  });

  it("should handle async rejection in tool handler", async () => {
    const asyncRejectTool = defineTool(
      {
        name: "asyncRejectTool",
        description: "Tool that rejects asynchronously",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      async () => {
        return Promise.reject(new Error("Async rejection"));
      },
    );

    const mockProvider = createMockProvider([
      toolCallResponse("asyncRejectTool", {}),
      textResponse("Async rejection handled"),
    ]);

    const agent = createAgent({
      name: "testAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [asyncRejectTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Async rejection handled");
  });
});

// ======== Edge Cases ========

describe("createAgent - Edge Cases", () => {
  it("should handle empty string response", async () => {
    const mockProvider = createMockProvider([
      textResponse(""),
    ]);

    const agent = createTestAgent(mockProvider);
    const result = await agent.run("test");

    expect(result).toBe("");
  });

  it("should handle model returning content with tool calls", async () => {
    // Some models return both content and tool calls
    const tool = createSuccessTool("mixedTool", () => ({ ok: true }));

    const mockProvider = createMockProvider([
      {
        message: {
          role: "assistant",
          content: "I'll call a tool",
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "mixedTool",
                arguments: "{}",
              },
            },
          ],
        },
        finishReason: "tool_calls",
      },
      textResponse("Tool executed"),
    ]);

    const agent = createAgent({
      name: "mixedAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Tool executed");
  });

  it("should handle same tool called multiple times in one iteration", async () => {
    let callCount = 0;
    const countingTool = defineTool(
      {
        name: "countingTool",
        description: "Counts calls",
        parameters: { type: "object", properties: {} },
      },
      async () => {
        callCount++;
        return { callNumber: callCount };
      },
    );

    const mockProvider = createMockProvider([
      multiToolCallResponse([
        { name: "countingTool", arguments: {}, id: "call_1" },
        { name: "countingTool", arguments: {}, id: "call_2" },
        { name: "countingTool", arguments: {}, id: "call_3" },
      ]),
      textResponse("Three calls made"),
    ]);

    const agent = createAgent({
      name: "multiCallAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [countingTool],
    });

    const result = await agent.run("test");

    expect(result).toBe("Three calls made");
    expect(callCount).toBe(3);
  });

  it("should generate unique runId for each run", async () => {
    const runIds: string[] = [];

    const tool = defineTool(
      {
        name: "idCaptureTool",
        description: "Captures run ID",
        parameters: { type: "object", properties: {} },
      },
      async (_args, ctx) => {
        runIds.push(ctx.runId);
        return {};
      },
    );

    const mockProvider = createCustomProvider((_, index) => {
      if (index % 2 === 0) {
        return toolCallResponse("idCaptureTool", {});
      }
      return textResponse("Done");
    });

    const agent = createAgent({
      name: "idAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("test1");
    await agent.run("test2");

    expect(runIds.length).toBe(2);
    expect(runIds[0]).not.toBe(runIds[1]);
    expect(runIds[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

// ======== onEvent Callback Tests ========

describe("createAgent - onEvent Callback", () => {
  it("should emit model_call event before each LLM call", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const mockProvider = createMockProvider([
      textResponse("Response"),
    ]);

    const agent = createTestAgent(mockProvider);
    await agent.run("test", { onEvent });

    const modelCallEvents = events.filter((e) => e.type === "model_call");
    expect(modelCallEvents).toHaveLength(1);
    expect(modelCallEvents[0].type).toBe("model_call");
    if (modelCallEvents[0].type === "model_call") {
      expect(modelCallEvents[0].iteration).toBe(0);
      expect(modelCallEvents[0].messages.length).toBeGreaterThan(0);
    }
  });

  it("should emit tool_call event before tool execution", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const tool = createSuccessTool("eventTool", () => ({ result: "success" }));

    const mockProvider = createMockProvider([
      toolCallResponse("eventTool", { arg: "value" }),
      textResponse("Done"),
    ]);

    const agent = createAgent({
      name: "eventAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("test", { onEvent });

    const toolCallEvent = events.find((e) => e.type === "tool_call");
    expect(toolCallEvent).toBeDefined();
    if (toolCallEvent?.type === "tool_call") {
      expect(toolCallEvent.name).toBe("eventTool");
      expect(toolCallEvent.args).toEqual({ arg: "value" });
    }
  });

  it("should emit tool_result event after successful tool execution", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const tool = createSuccessTool("resultTool", () => ({ data: "result" }));

    const mockProvider = createMockProvider([
      toolCallResponse("resultTool", {}),
      textResponse("Done"),
    ]);

    const agent = createAgent({
      name: "resultAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("test", { onEvent });

    const toolResultEvent = events.find((e) => e.type === "tool_result");
    expect(toolResultEvent).toBeDefined();
    if (toolResultEvent?.type === "tool_result") {
      expect(toolResultEvent.name).toBe("resultTool");
      expect(toolResultEvent.result).toEqual({ data: "result" });
    }
  });

  it("should emit tool_error event when tool handler throws", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const failingTool = createFailingTool("errorTool", "Tool execution failed");

    const mockProvider = createMockProvider([
      toolCallResponse("errorTool", {}),
      textResponse("Handled error"),
    ]);

    const agent = createAgent({
      name: "errorAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [failingTool],
    });

    await agent.run("test", { onEvent });

    const toolErrorEvent = events.find((e) => e.type === "tool_error");
    expect(toolErrorEvent).toBeDefined();
    if (toolErrorEvent?.type === "tool_error") {
      expect(toolErrorEvent.name).toBe("errorTool");
      expect(toolErrorEvent.error).toBe("Tool execution failed");
    }
  });

  it("should emit complete event at end of run", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const mockProvider = createMockProvider([
      textResponse("Final response"),
    ]);

    const agent = createTestAgent(mockProvider);
    await agent.run("test", { onEvent });

    const completeEvent = events.find((e) => e.type === "complete");
    expect(completeEvent).toBeDefined();
    if (completeEvent?.type === "complete") {
      expect(completeEvent.output).toBe("Final response");
    }
  });

  it("should emit complete event with structured output", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const outputSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    const mockProvider = createMockProvider([
      textResponse(JSON.stringify({ name: "test", value: 42 })),
    ]);

    const agent = createAgent({
      name: "structuredEventAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      outputSchema,
    });

    await agent.run("test", { onEvent });

    const completeEvent = events.find((e) => e.type === "complete");
    expect(completeEvent).toBeDefined();
    if (completeEvent?.type === "complete") {
      expect(completeEvent.output).toEqual({ name: "test", value: 42 });
    }
  });

  it("should emit events in correct order", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const tool = createSuccessTool("orderTool", () => ({ ok: true }));

    const mockProvider = createMockProvider([
      toolCallResponse("orderTool", {}),
      textResponse("Done"),
    ]);

    const agent = createAgent({
      name: "orderAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("test", { onEvent });

    // Expected order: model_call -> tool_call -> tool_result -> model_call -> complete
    expect(events.length).toBe(5);
    expect(events[0].type).toBe("model_call");
    expect(events[1].type).toBe("tool_call");
    expect(events[2].type).toBe("tool_result");
    expect(events[3].type).toBe("model_call");
    expect(events[4].type).toBe("complete");
  });

  it("should emit multiple model_call events with correct iteration numbers", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const tool = createSuccessTool("iterTool", () => ({ ok: true }));

    const mockProvider = createMockProvider([
      toolCallResponse("iterTool", {}),
      toolCallResponse("iterTool", {}),
      textResponse("Done"),
    ]);

    const agent = createAgent({
      name: "iterEventAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    await agent.run("test", { onEvent });

    const modelCallEvents = events.filter((e) => e.type === "model_call");
    expect(modelCallEvents).toHaveLength(3);

    // Check iteration numbers
    if (modelCallEvents[0].type === "model_call") {
      expect(modelCallEvents[0].iteration).toBe(0);
    }
    if (modelCallEvents[1].type === "model_call") {
      expect(modelCallEvents[1].iteration).toBe(1);
    }
    if (modelCallEvents[2].type === "model_call") {
      expect(modelCallEvents[2].iteration).toBe(2);
    }
  });

  it("should work correctly when onEvent is not provided", async () => {
    const mockProvider = createMockProvider([
      textResponse("Response"),
    ]);

    const agent = createTestAgent(mockProvider);

    // Should not throw when onEvent is not provided
    const result = await agent.run("test");
    expect(result).toBe("Response");
  });

  it("should emit events during runWithHistory", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const tool = createSuccessTool("historyEventTool", () => ({ data: "result" }));

    const mockProvider = createMockProvider([
      toolCallResponse("historyEventTool", {}),
      textResponse("Final answer"),
    ]);

    const agent = createAgent({
      name: "historyEventAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool],
    });

    const result = await agent.runWithHistory("test", { onEvent });

    expect(result.output).toBe("Final answer");

    // Should have model_call, tool_call, tool_result, model_call, complete
    expect(events.length).toBe(5);
    expect(events[0].type).toBe("model_call");
    expect(events[1].type).toBe("tool_call");
    expect(events[2].type).toBe("tool_result");
    expect(events[3].type).toBe("model_call");
    expect(events[4].type).toBe("complete");
  });

  it("should work with both onEvent and legacy logger", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const logEvents: AgentLogEvent[] = [];
    const logger = (event: AgentLogEvent) => logEvents.push(event);

    const mockProvider = createMockProvider([
      textResponse("Response"),
    ]);

    const agent = createTestAgent(mockProvider);
    await agent.run("test", { onEvent, metadata: { logger } });

    // Both should receive events
    expect(events.length).toBeGreaterThan(0);
    expect(logEvents.length).toBeGreaterThan(0);

    // onEvent should have typed events
    const completeEvent = events.find((e) => e.type === "complete");
    expect(completeEvent).toBeDefined();

    // logger should have legacy events
    const finalEvent = logEvents.find((e) => e.type === "final");
    expect(finalEvent).toBeDefined();
  });

  it("should emit tool_error for non-Error thrown values", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const stringThrowingTool = defineTool(
      {
        name: "stringErrorTool",
        description: "Throws a string",
        parameters: { type: "object", properties: {} },
      },
      async () => {
        throw "A string error"; // eslint-disable-line no-throw-literal
      },
    );

    const mockProvider = createMockProvider([
      toolCallResponse("stringErrorTool", {}),
      textResponse("Handled"),
    ]);

    const agent = createAgent({
      name: "stringErrorAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [stringThrowingTool],
    });

    await agent.run("test", { onEvent });

    const toolErrorEvent = events.find((e) => e.type === "tool_error");
    expect(toolErrorEvent).toBeDefined();
    if (toolErrorEvent?.type === "tool_error") {
      expect(toolErrorEvent.name).toBe("stringErrorTool");
      expect(toolErrorEvent.error).toBe("A string error");
    }
  });

  it("should emit events for multiple tools in single iteration", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const tool1 = createSuccessTool("multiTool1", () => ({ t1: true }));
    const tool2 = createSuccessTool("multiTool2", () => ({ t2: true }));

    const mockProvider = createMockProvider([
      multiToolCallResponse([
        { name: "multiTool1", arguments: {} },
        { name: "multiTool2", arguments: {} },
      ]),
      textResponse("Both done"),
    ]);

    const agent = createAgent({
      name: "multiToolEventAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      tools: [tool1, tool2],
    });

    await agent.run("test", { onEvent });

    // Should have 2 tool_call events and 2 tool_result events
    const toolCallEvents = events.filter((e) => e.type === "tool_call");
    const toolResultEvents = events.filter((e) => e.type === "tool_result");

    expect(toolCallEvents).toHaveLength(2);
    expect(toolResultEvents).toHaveLength(2);
  });

  it("should include message copy in model_call event", async () => {
    const events: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => events.push(event);

    const mockProvider = createMockProvider([
      textResponse("Response"),
    ]);

    const agent = createAgent({
      name: "messageCopyAgent",
      model: {
        provider: mockProvider,
        model: "test-model",
      },
      systemPrompt: "You are a test agent.",
    });

    await agent.run("Test input", { onEvent });

    const modelCallEvent = events.find((e) => e.type === "model_call");
    expect(modelCallEvent).toBeDefined();
    if (modelCallEvent?.type === "model_call") {
      // Should have system and user messages
      expect(modelCallEvent.messages.length).toBe(2);
      expect(modelCallEvent.messages[0].role).toBe("system");
      expect(modelCallEvent.messages[1].role).toBe("user");
    }
  });
});

// ======== Tool Argument Validation Tests ========

describe("createAgent - Tool Argument Validation", () => {
  // Tests for argument parsing (before validation)
  describe("argument parsing", () => {
    it("should handle tool calls with undefined arguments", async () => {
      const toolSpy = vi.fn().mockReturnValue({ status: "ok" });
      const noArgsTool = defineTool(
        {
          name: "noArgsTool",
          description: "A tool that requires no arguments",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        toolSpy,
      );

      // Create a raw response that bypasses the mock helper
      // This simulates what happens when OpenRouter SDK returns undefined arguments
      const rawResponse: ChatResponse = {
        message: {
          role: "assistant",
          content: null,
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "noArgsTool",
                arguments: undefined as unknown as string, // Simulating undefined arguments
              },
            },
          ],
        },
        finishReason: "tool_calls",
      };

      const mockProvider = createMockProvider([
        rawResponse,
        textResponse("Tool executed successfully"),
      ]);

      const agent = createAgent({
        name: "testAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [noArgsTool],
      });

      const result = await agent.run("Run the tool");

      // The tool should be called with empty object
      expect(toolSpy).toHaveBeenCalledTimes(1);
      expect(toolSpy).toHaveBeenCalledWith({}, expect.any(Object));
      expect(result).toBe("Tool executed successfully");
    });

    it("should handle tool calls with empty string arguments", async () => {
      const toolSpy = vi.fn().mockReturnValue({ status: "ok" });
      const noArgsTool = defineTool(
        {
          name: "noArgsTool",
          description: "A tool that requires no arguments",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        toolSpy,
      );

      // Create a raw response with empty string arguments
      const rawResponse: ChatResponse = {
        message: {
          role: "assistant",
          content: null,
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "noArgsTool",
                arguments: "", // Empty string - invalid JSON
              },
            },
          ],
        },
        finishReason: "tool_calls",
      };

      const mockProvider = createMockProvider([
        rawResponse,
        textResponse("Tool executed successfully"),
      ]);

      const agent = createAgent({
        name: "testAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [noArgsTool],
      });

      const result = await agent.run("Run the tool");

      // The tool should be called with empty object
      expect(toolSpy).toHaveBeenCalledTimes(1);
      expect(toolSpy).toHaveBeenCalledWith({}, expect.any(Object));
      expect(result).toBe("Tool executed successfully");
    });

    it("should handle tool calls with valid empty object arguments", async () => {
      const toolSpy = vi.fn().mockReturnValue({ status: "ok" });
      const noArgsTool = defineTool(
        {
          name: "noArgsTool",
          description: "A tool that requires no arguments",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        toolSpy,
      );

      // This is the correct format - "{}" as a JSON string
      const mockProvider = createMockProvider([
        toolCallResponse("noArgsTool", {}),
        textResponse("Tool executed successfully"),
      ]);

      const agent = createAgent({
        name: "testAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [noArgsTool],
      });

      const result = await agent.run("Run the tool");

      // The tool should be called with empty object
      expect(toolSpy).toHaveBeenCalledTimes(1);
      expect(toolSpy).toHaveBeenCalledWith({}, expect.any(Object));
      expect(result).toBe("Tool executed successfully");
    });
  });

  // Direct validation function tests
  describe("validateToolArguments", () => {
    it("should pass validation with correct arguments", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            count: { type: "number" },
          },
          required: ["name"],
        },
      };

      // Should not throw
      expect(() => {
        validateToolArguments("testTool", { name: "test", count: 42 }, schema);
      }).not.toThrow();
    });

    it("should fail validation with missing required field", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            count: { type: "number" },
          },
          required: ["name", "count"],
        },
      };

      expect(() => {
        validateToolArguments("testTool", { name: "test" }, schema);
      }).toThrow(/count: Missing required field/);
    });

    it("should fail validation with wrong type", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {
            count: { type: "number" },
          },
        },
      };

      expect(() => {
        validateToolArguments("testTool", { count: "not a number" }, schema);
      }).toThrow(/count: Invalid type.*expected number.*received string/);
    });

    it("should fail validation with invalid integer type", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {
            count: { type: "integer" },
          },
        },
      };

      expect(() => {
        validateToolArguments("testTool", { count: 3.14 }, schema);
      }).toThrow(/count: Invalid type.*expected integer.*received number/);
    });

    it("should pass validation with valid integer", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {
            count: { type: "integer" },
          },
        },
      };

      expect(() => {
        validateToolArguments("testTool", { count: 42 }, schema);
      }).not.toThrow();
    });

    it("should fail validation when args is null", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {},
        },
      };

      expect(() => {
        validateToolArguments("testTool", null, schema);
      }).toThrow(/Expected object, received null/);
    });

    it("should fail validation when args is not an object", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {},
        },
      };

      expect(() => {
        validateToolArguments("testTool", "string", schema);
      }).toThrow(/Expected object, received string/);
    });

    it("should handle arrays correctly", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {
            items: { type: "array" },
          },
        },
      };

      // Valid array
      expect(() => {
        validateToolArguments("testTool", { items: [1, 2, 3] }, schema);
      }).not.toThrow();

      // Invalid - not an array
      expect(() => {
        validateToolArguments("testTool", { items: "not array" }, schema);
      }).toThrow(/items: Invalid type.*expected array.*received string/);
    });

    it("should include tool name in error message", () => {
      const schema = {
        name: "mySpecialTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {},
          required: ["missing"],
        },
      };

      expect(() => {
        validateToolArguments("mySpecialTool", {}, schema);
      }).toThrow(/mySpecialTool/);
    });

    it("should report multiple errors", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            count: { type: "number" },
          },
          required: ["name", "count"],
        },
      };

      expect(() => {
        validateToolArguments("testTool", { name: 123 }, schema);
      }).toThrow(/count: Missing required field.*name: Invalid type|name: Invalid type.*count: Missing required field/);
    });

    it("should allow extra fields not in schema", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
      };

      // Should not throw for extra fields
      expect(() => {
        validateToolArguments("testTool", { name: "test", extra: "field" }, schema);
      }).not.toThrow();
    });

    it("should handle empty object arguments", () => {
      const schema = {
        name: "testTool",
        description: "Test",
        parameters: {
          type: "object",
          properties: {},
        },
      };

      expect(() => {
        validateToolArguments("testTool", {}, schema);
      }).not.toThrow();
    });
  });

  // Integration tests with agent
  describe("Agent integration", () => {
    it("should validate tool arguments before execution", async () => {
      const toolSpy = vi.fn().mockResolvedValue({ result: "success" });

      const strictTool = defineTool(
        {
          name: "strictTool",
          description: "Tool with strict schema",
          parameters: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
          },
        },
        toolSpy,
      );

      const mockProvider = createMockProvider([
        // First call with invalid arguments (string instead of number)
        toolCallResponse("strictTool", { value: "not a number" }),
        textResponse("Handled validation error"),
      ]);

      const agent = createAgent({
        name: "validationAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [strictTool],
      });

      const result = await agent.run("Test");

      // Tool handler should NOT be called due to validation failure
      expect(toolSpy).not.toHaveBeenCalled();
      expect(result).toBe("Handled validation error");
    });

    it("should return validation error to model", async () => {
      const { provider, requests } = createCapturingProvider([
        toolCallResponse("strictTool", { value: "invalid" }),
        textResponse("Error handled"),
      ]);

      const strictTool = defineTool(
        {
          name: "strictTool",
          description: "Tool with strict schema",
          parameters: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
          },
        },
        async () => ({ result: "success" }),
      );

      const agent = createAgent({
        name: "validationAgent",
        model: {
          provider,
          model: "test-model",
        },
        tools: [strictTool],
      });

      await agent.run("Test");

      // Check that the second request includes the validation error
      expect(requests.length).toBe(2);
      const toolMessage = requests[1].messages.find((m: Message) => m.role === "tool");
      expect(toolMessage).toBeDefined();
      expect(toolMessage?.content).toContain("error");
      expect(toolMessage?.content).toContain("validation");
    });

    it("should continue agent loop after validation error", async () => {
      const events: AgentEvent[] = [];
      const onEvent = (event: AgentEvent) => events.push(event);

      const strictTool = defineTool(
        {
          name: "strictTool",
          description: "Tool with strict schema",
          parameters: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
          },
        },
        async () => ({ result: "success" }),
      );

      const mockProvider = createMockProvider([
        toolCallResponse("strictTool", {}), // Missing required field
        textResponse("Completed after error"),
      ]);

      const agent = createAgent({
        name: "validationAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [strictTool],
      });

      const result = await agent.run("Test", { onEvent });

      // Agent should complete successfully
      expect(result).toBe("Completed after error");

      // Should have tool_error event
      const toolErrorEvent = events.find((e) => e.type === "tool_error");
      expect(toolErrorEvent).toBeDefined();
      if (toolErrorEvent?.type === "tool_error") {
        expect(toolErrorEvent.error).toContain("validation");
      }

      // Should have complete event
      const completeEvent = events.find((e) => e.type === "complete");
      expect(completeEvent).toBeDefined();
    });

    it("should emit tool_error event for validation failures", async () => {
      const events: AgentEvent[] = [];
      const onEvent = (event: AgentEvent) => events.push(event);

      const strictTool = defineTool(
        {
          name: "strictTool",
          description: "Tool with strict schema",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            required: ["name"],
          },
        },
        async () => ({ result: "success" }),
      );

      const mockProvider = createMockProvider([
        toolCallResponse("strictTool", { name: 123 }), // Wrong type
        textResponse("Done"),
      ]);

      const agent = createAgent({
        name: "eventAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [strictTool],
      });

      await agent.run("Test", { onEvent });

      const toolErrorEvent = events.find((e) => e.type === "tool_error");
      expect(toolErrorEvent).toBeDefined();
      if (toolErrorEvent?.type === "tool_error") {
        expect(toolErrorEvent.name).toBe("strictTool");
        expect(toolErrorEvent.error).toContain("validation");
        expect(toolErrorEvent.error).toContain("name");
      }
    });

    it("should execute tool when validation passes", async () => {
      const toolSpy = vi.fn().mockResolvedValue({ doubled: 84 });

      const strictTool = defineTool(
        {
          name: "strictTool",
          description: "Tool with strict schema",
          parameters: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
          },
        },
        toolSpy,
      );

      const mockProvider = createMockProvider([
        toolCallResponse("strictTool", { value: 42 }),
        textResponse("Result is 84"),
      ]);

      const agent = createAgent({
        name: "validAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [strictTool],
      });

      const result = await agent.run("Double 42");

      // Tool should be called with valid arguments
      expect(toolSpy).toHaveBeenCalledTimes(1);
      expect(toolSpy).toHaveBeenCalledWith({ value: 42 }, expect.anything());
      expect(result).toBe("Result is 84");
    });

    it("should use ERROR_PREFIXES.AGENT for validation errors", async () => {
      const { provider, requests } = createCapturingProvider([
        toolCallResponse("testTool", {}),
        textResponse("Done"),
      ]);

      const testTool = defineTool(
        {
          name: "testTool",
          description: "Test",
          parameters: {
            type: "object",
            properties: {},
            required: ["missing"],
          },
        },
        async () => ({ result: "success" }),
      );

      const agent = createAgent({
        name: "prefixAgent",
        model: {
          provider,
          model: "test-model",
        },
        tools: [testTool],
      });

      await agent.run("Test");

      // Check the tool result message contains the error prefix
      const toolMessage = requests[1].messages.find((m: Message) => m.role === "tool");
      expect(toolMessage?.content).toContain(ERROR_PREFIXES.AGENT);
    });

    it("should validate arguments in streaming mode", async () => {
      const toolSpy = vi.fn().mockResolvedValue({ result: "success" });

      const strictTool = defineTool(
        {
          name: "strictTool",
          description: "Tool with strict schema",
          parameters: {
            type: "object",
            properties: {
              value: { type: "number" },
            },
            required: ["value"],
          },
        },
        toolSpy,
      );

      const mockProvider = createStreamingMockProvider([
        createToolCallStreamChunks("strictTool", { value: "invalid" }),
        createTextStreamChunks("Handled"),
      ]);

      const agent = createAgent({
        name: "streamValidationAgent",
        model: {
          provider: mockProvider,
          model: "test-model",
        },
        tools: [strictTool],
      });

      const stream = agent.stream("Test");
      const chunks: StreamChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Tool should not be called
      expect(toolSpy).not.toHaveBeenCalled();

      // Should complete successfully
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
    });
  });
});
