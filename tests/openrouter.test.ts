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
  });
});
