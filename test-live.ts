#!/usr/bin/env tsx
/**
 * Live test script for OpenRouter SDK integration
 *
 * Usage:
 *   OPENROUTER_API_KEY=your_key tsx test-live.ts
 *
 * This script tests:
 * 1. Basic chat completion
 * 2. Tool calling
 * 3. Structured output with Zod
 */

import {
  OpenRouterProvider,
  createAgent,
  defineTool,
  type Schema,
} from "./src/index.js";
import { z } from "zod";

const DIVIDER = "\n" + "=".repeat(80) + "\n";

async function testBasicChat() {
  console.log(DIVIDER);
  console.log("TEST 1: Basic Chat Completion");
  console.log(DIVIDER);

  const provider = new OpenRouterProvider();

  const agent = createAgent<string, string>({
    name: "test-basic-chat",
    systemPrompt: "You are a helpful assistant. Keep responses brief.",
    model: {
      provider,
      model: "google/gemini-2.5-flash",
      temperature: 0.7,
    },
  });

  const question = "What is 2+2? Answer in one sentence.";
  console.log(`Question: ${question}\n`);

  const answer = await agent.run(question);
  console.log(`Answer: ${answer}\n`);

  console.log("✓ Basic chat test passed!");
}

async function testToolCalling() {
  console.log(DIVIDER);
  console.log("TEST 2: Tool Calling");
  console.log(DIVIDER);

  const provider = new OpenRouterProvider();

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
    async (args, ctx) => {
      console.log(`[TOOL CALLED] calculator: ${JSON.stringify(args)}`);

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
      model: "google/gemini-2.5-flash",
      temperature: 0.2,
    },
    tools: [calculatorTool],
  });

  const question = "What is 157 multiplied by 23?";
  console.log(`Question: ${question}\n`);

  const answer = await agent.run(question, {
    metadata: {
      logger: (event) => {
        if (event.type === "tool_call") {
          console.log(`→ Tool called: ${event.data.name}`);
        } else if (event.type === "tool_result") {
          console.log(`← Tool result: ${JSON.stringify(event.data.result)}`);
        }
      },
    },
  });

  console.log(`\nAnswer: ${answer}\n`);
  console.log("✓ Tool calling test passed!");
}

async function testStructuredOutput() {
  console.log(DIVIDER);
  console.log("TEST 3: Structured Output with Zod");
  console.log(DIVIDER);

  const provider = new OpenRouterProvider();

  // Define output schema
  const outputSchema: Schema<{
    sentiment: "positive" | "negative" | "neutral";
    confidence: number;
    summary: string;
  }> = z.object({
    sentiment: z.enum(["positive", "negative", "neutral"]),
    confidence: z.number().min(0).max(1),
    summary: z.string(),
  });

  const agent = createAgent<
    string,
    {
      sentiment: "positive" | "negative" | "neutral";
      confidence: number;
      summary: string;
    }
  >({
    name: "test-structured-output",
    systemPrompt: `Analyze the sentiment of the given text.
Respond ONLY with JSON in this format:
{
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": 0.0-1.0,
  "summary": "brief explanation"
}`,
    model: {
      provider,
      model: "google/gemini-2.5-flash",
      temperature: 0.3,
    },
    outputSchema,
  });

  const text =
    "I absolutely love this product! It exceeded all my expectations.";
  console.log(`Text: "${text}"\n`);

  const result = await agent.run(text);
  console.log("Analysis:");
  console.log(JSON.stringify(result, null, 2));
  console.log();

  // Verify it matches our schema
  if (
    typeof result.sentiment === "string" &&
    typeof result.confidence === "number" &&
    typeof result.summary === "string"
  ) {
    console.log("✓ Structured output test passed!");
  } else {
    throw new Error("Output doesn't match expected schema!");
  }
}

async function main() {
  console.log("\n🧪 Live Testing @schaake/agents with OpenRouter SDK\n");

  // Check for API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ Error: OPENROUTER_API_KEY environment variable not set");
    console.error("\nUsage:");
    console.error("  OPENROUTER_API_KEY=your_key tsx test-live.ts");
    process.exit(1);
  }

  console.log("✓ API key found");

  try {
    await testBasicChat();
    await testToolCalling();
    await testStructuredOutput();

    console.log(DIVIDER);
    console.log("🎉 All tests passed!");
    console.log(DIVIDER);
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
