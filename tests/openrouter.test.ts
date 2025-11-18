import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenRouterProvider } from "../src/openrouter.js";
import type { ChatRequest } from "../src/types.js";

// Mock the OpenRouter SDK
const mockSend = vi.fn();

vi.mock("@openrouter/sdk", () => {
  return {
    OpenRouter: class {
      chat = {
        send: mockSend,
      };
    },
  };
});

export { mockSend };

describe("OpenRouterProvider", () => {
  let provider: OpenRouterProvider;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create provider with mock API key
    provider = new OpenRouterProvider({
      apiKey: "test-api-key",
    });
  });

  describe("constructor", () => {
    it("should throw when apiKey is not provided and OPENROUTER_API_KEY is not set", () => {
      // Clear environment variable if set
      const original = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        expect(() => {
          new OpenRouterProvider({});
        }).toThrow();
      } finally {
        // Restore
        if (original) {
          process.env.OPENROUTER_API_KEY = original;
        }
      }
    });

    it("should throw when apiKey option is empty string", () => {
      const original = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        expect(() => {
          new OpenRouterProvider({ apiKey: "" });
        }).toThrow();
      } finally {
        if (original) {
          process.env.OPENROUTER_API_KEY = original;
        }
      }
    });

    it("should throw with descriptive error message containing resolution steps", () => {
      const original = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        expect(() => {
          new OpenRouterProvider({});
        }).toThrow(/API key is required but not provided/);

        expect(() => {
          new OpenRouterProvider({});
        }).toThrow(/Resolution steps:/);

        expect(() => {
          new OpenRouterProvider({});
        }).toThrow(/https:\/\/openrouter\.ai\/keys/);
      } finally {
        if (original) {
          process.env.OPENROUTER_API_KEY = original;
        }
      }
    });

    it("should not throw when apiKey option is provided", () => {
      expect(() => {
        new OpenRouterProvider({ apiKey: "valid-test-key" });
      }).not.toThrow();
    });

    it("should not throw when OPENROUTER_API_KEY environment variable is set", () => {
      const original = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = "env-test-key";

      try {
        expect(() => {
          new OpenRouterProvider({});
        }).not.toThrow();
      } finally {
        if (original) {
          process.env.OPENROUTER_API_KEY = original;
        } else {
          delete process.env.OPENROUTER_API_KEY;
        }
      }
    });

    it("should prioritize apiKey option over environment variable", () => {
      const original = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = "env-key";

      try {
        expect(() => {
          new OpenRouterProvider({ apiKey: "option-key" });
        }).not.toThrow();
        // Both should be valid, just verifying no throw
      } finally {
        if (original) {
          process.env.OPENROUTER_API_KEY = original;
        } else {
          delete process.env.OPENROUTER_API_KEY;
        }
      }
    });
  });

  describe("chat", () => {
    it("should send a basic chat request without tools", async () => {
      // Mock SDK response
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "stop",
            message: {
              role: "assistant",
              content: "Hello! How can I help you?",
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [
          {
            role: "user",
            content: "Hello",
          },
        ],
      };

      const response = await provider.chat(request);

      // Verify SDK was called correctly
      expect(mockSend).toHaveBeenCalledWith({
        model: "test-model",
        messages: request.messages,
        tools: undefined,
        toolChoice: undefined,
        temperature: undefined,
        maxTokens: undefined,
        stream: false,
      });

      // Verify response format
      expect(response).toEqual({
        message: {
          role: "assistant",
          content: "Hello! How can I help you?",
          toolCalls: undefined,
        },
        finishReason: "stop",
        raw: expect.any(Object),
      });
    });

    it("should send a chat request with tools", async () => {
      // Mock SDK response with tool calls
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              toolCalls: [
                {
                  id: "call_123",
                  type: "function",
                  function: {
                    name: "testTool",
                    arguments: '{"arg":"value"}',
                  },
                },
              ],
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [{ role: "user", content: "Use a tool" }],
        tools: [
          {
            type: "function",
            function: {
              name: "testTool",
              description: "A test tool",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      };

      const response = await provider.chat(request);

      // Verify tools were passed to SDK
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            {
              type: "function",
              function: {
                name: "testTool",
                description: "A test tool",
                parameters: { type: "object", properties: {} },
              },
            },
          ],
          toolChoice: "auto",
        }),
      );

      // Verify tool calls in response
      expect(response.message.toolCalls).toEqual([
        {
          id: "call_123",
          type: "function",
          function: {
            name: "testTool",
            arguments: '{"arg":"value"}',
          },
        },
      ]);
      expect(response.finishReason).toBe("tool_calls");
    });

    it("should handle multimodal content (array of content items)", async () => {
      // Mock SDK response with array content
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "stop",
            message: {
              role: "assistant",
              content: [
                { type: "text", text: "Here is " },
                { type: "text", text: "the answer" },
              ],
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [{ role: "user", content: "Question" }],
      };

      const response = await provider.chat(request);

      // Verify content was concatenated
      expect(response.message.content).toBe("Here is the answer");
    });

    it("should pass temperature and maxTokens to SDK", async () => {
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "stop",
            message: {
              role: "assistant",
              content: "Response",
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [{ role: "user", content: "Test" }],
        temperature: 0.7,
        maxTokens: 1000,
      };

      await provider.chat(request);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 1000,
        }),
      );
    });

    it("should throw error when no choices in response", async () => {
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [{ role: "user", content: "Test" }],
      };

      await expect(provider.chat(request)).rejects.toThrow(
        "OpenRouterProvider: No choices in response",
      );
    });

    it("should throw error when tool message is missing toolCallId", async () => {
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "stop",
            message: {
              role: "assistant",
              content: "Done",
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [
          { role: "user", content: "Test" },
          // Tool message without toolCallId - this should cause an error
          { role: "tool", content: "Tool result" },
        ],
      };

      await expect(provider.chat(request)).rejects.toThrow(
        "OpenRouterProvider: Tool message missing required toolCallId",
      );
    });

    it("should handle system message with null content", async () => {
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "stop",
            message: {
              role: "assistant",
              content: "Response",
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [
          { role: "system", content: null },
          { role: "user", content: "Test" },
        ],
      };

      const response = await provider.chat(request);

      expect(response.message.content).toBe("Response");
      // Verify system message was converted with empty string
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "system", content: "" }),
          ]),
        }),
      );
    });

    it("should handle user message with null content", async () => {
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "stop",
            message: {
              role: "assistant",
              content: "Response",
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [{ role: "user", content: null }],
      };

      const response = await provider.chat(request);

      expect(response.message.content).toBe("Response");
      // Verify user message was converted with empty string
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "" }],
        }),
      );
    });

    it("should handle assistant message with name field", async () => {
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "stop",
            message: {
              role: "assistant",
              content: "Response",
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [
          { role: "user", content: "Test" },
          { role: "assistant", content: "Previous response", name: "assistant1" },
          { role: "user", content: "Follow up" },
        ],
      };

      const response = await provider.chat(request);

      expect(response.message.content).toBe("Response");
      // Verify assistant message name was passed
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "assistant",
              content: "Previous response",
              name: "assistant1",
            }),
          ]),
        }),
      );
    });

    it("should handle tool message with proper toolCallId", async () => {
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "stop",
            message: {
              role: "assistant",
              content: "Done",
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [
          { role: "user", content: "Test" },
          {
            role: "assistant",
            content: null,
            toolCalls: [
              {
                id: "call_123",
                type: "function",
                function: { name: "myTool", arguments: "{}" },
              },
            ],
          },
          { role: "tool", content: "Tool result", toolCallId: "call_123" },
        ],
      };

      const response = await provider.chat(request);

      expect(response.message.content).toBe("Done");
      // Verify tool message was converted correctly with toolCallId
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "tool",
              content: "Tool result",
              toolCallId: "call_123",
            }),
          ]),
        }),
      );
    });

    it("should handle null content in response", async () => {
      mockSend.mockResolvedValue({
        id: "test-id",
        choices: [
          {
            index: 0,
            finishReason: "stop",
            message: {
              role: "assistant",
              content: null,
            },
          },
        ],
        created: Date.now(),
        model: "test-model",
        object: "chat.completion",
      });

      const request: ChatRequest = {
        model: "test-model",
        messages: [{ role: "user", content: "Test" }],
      };

      const response = await provider.chat(request);

      // Null content should be returned as null
      expect(response.message.content).toBeNull();
    });
  });
});
