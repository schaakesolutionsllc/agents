/**
 * E2E test: Streaming with tool calls
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createAgent, defineTool } from "../../src/index.js";
import { skipIfNoApiKey, createProvider, TEST_MODEL } from "./setup.js";

describe("Streaming", () => {
  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  it("should stream responses with tool calls", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();

    // Define a weather tool
    const weatherTool = defineTool(
      {
        name: "get_weather",
        description: "Gets the current weather for a city",
        parameters: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "The city name",
            },
          },
          required: ["city"],
        },
      },
      async (args) => {
        // Simulate weather lookup
        const weather = {
          city: args.city,
          temperature: 72,
          conditions: "sunny",
        };
        return weather;
      },
    );

    const agent = createAgent<string, string>({
      name: "test-streaming",
      systemPrompt:
        "You are a helpful weather assistant. Use the get_weather tool to check weather.",
      model: {
        provider,
        model: TEST_MODEL,
        temperature: 0.3,
      },
      tools: [weatherTool],
    });

    const question =
      "What's the weather like in San Francisco? And when is the best time of year to visit (and why)?";

    // Track events
    const events: string[] = [];

    const stream = agent.stream(question, {
      onEvent: (event) => {
        switch (event.type) {
          case "model_call":
            events.push(`Model call #${event.iteration + 1}`);
            break;
          case "tool_call":
            events.push(`Tool: ${event.name}`);
            break;
          case "tool_result":
            events.push(`Result received`);
            break;
          case "complete":
            events.push(`Complete`);
            break;
        }
      },
    });

    let chunkCount = 0;
    let fullContent = "";

    for await (const chunk of stream) {
      switch (chunk.type) {
        case "content":
          chunkCount++;
          fullContent += chunk.content;
          break;
        case "done":
          break;
      }
    }

    // Get final result with history
    const result = await stream.finalResult();

    // Verify streaming worked
    expect(chunkCount).toBeGreaterThan(0);
    expect(fullContent).toBeTruthy();
    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.messages.length).toBeGreaterThan(0);

    // Verify tool was called
    expect(events).toContain("Tool: get_weather");
    expect(events).toContain("Result received");
  });
});
