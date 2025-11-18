/**
 * E2E test: Tool calling
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createAgent, defineTool } from "../../src/index.js";
import { skipIfNoApiKey, createProvider, TEST_MODEL } from "./setup.js";

describe("Tool Calling", () => {
  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  it("should call tools and return results", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();

    // Define a simple calculator tool
    const calculatorTool = defineTool(
      {
        name: "calculator",
        description: "Performs basic arithmetic operations",
        parameters: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["add", "subtract", "multiply", "divide"],
              description: "The operation to perform",
            },
            a: {
              type: "number",
              description: "First number",
            },
            b: {
              type: "number",
              description: "Second number",
            },
          },
          required: ["operation", "a", "b"],
        },
      },
      async (args) => {
        const { operation, a, b } = args;
        let result: number;

        switch (operation) {
          case "add":
            result = a + b;
            break;
          case "subtract":
            result = a - b;
            break;
          case "multiply":
            result = a * b;
            break;
          case "divide":
            result = a / b;
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        return { result };
      },
    );

    const agent = createAgent<string, string>({
      name: "test-tool-calling",
      systemPrompt:
        "You are a helpful assistant. Use the calculator tool when needed.",
      model: {
        provider,
        model: TEST_MODEL,
        temperature: 0.2,
      },
      tools: [calculatorTool],
    });

    const question = "What is 157 multiplied by 23?";
    const answer = await agent.run(question);

    expect(answer).toBeTruthy();
    expect(typeof answer).toBe("string");
    // The answer should mention the result (3611)
    expect(answer).toMatch(/3611|three thousand six hundred/i);
  });
});
