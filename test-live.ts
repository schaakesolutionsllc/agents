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
 * 4. Streaming with tool calls
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
    systemPrompt: `Analyze the sentiment of the given text.`,
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

async function testStreaming() {
  console.log(DIVIDER);
  console.log("TEST 4: Streaming with Tool Calls");
  console.log(DIVIDER);

  const provider = new OpenRouterProvider();

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
      model: "google/gemini-2.5-flash",
      temperature: 0.3,
    },
    tools: [weatherTool],
  });

  const question = "What's the weather like in San Francisco? And when is the best time of year to visit (and why)?";
  console.log(`Question: ${question}\n`);

  // Track events separately from stream output
  const events: string[] = [];

  const stream = agent.stream(question, {
    onEvent: (event) => {
      switch (event.type) {
        case "model_call":
          events.push(`Model call #${event.iteration + 1}`);
          break;
        case "tool_call":
          events.push(`Tool: ${event.name}(${JSON.stringify(event.args)})`);
          break;
        case "tool_result":
          events.push(`Result: ${JSON.stringify(event.result)}`);
          break;
        case "tool_error":
          events.push(`Error: ${event.name} - ${event.error}`);
          break;
        case "complete":
          events.push(`Complete`);
          break;
      }
    },
  });

  let chunkCount = 0;
  let fullContent = "";

  console.log("--- Streaming chunks ---\n");

  for await (const chunk of stream) {
    switch (chunk.type) {
      case "content":
        // Show each chunk with a marker to visualize streaming
        const preview = chunk.content.length > 50
          ? chunk.content.substring(0, 50) + "..."
          : chunk.content;
        console.log(`[chunk ${++chunkCount}] "${preview.replace(/\n/g, "\\n")}"`);
        fullContent += chunk.content;
        break;
      case "tool_call":
        console.log(`[tool_call] ${chunk.toolCall.function.name}(${chunk.toolCall.function.arguments})`);
        break;
      case "tool_result":
        console.log(`[tool_result] ${chunk.toolResult.name} → ${JSON.stringify(chunk.toolResult.result)}`);
        break;
      case "done":
        console.log(`[done]`);
        break;
    }
  }

  console.log("\n--- Full response ---\n");
  console.log(fullContent);

  console.log("\n--- Events log ---\n");
  events.forEach((e, i) => console.log(`${i + 1}. ${e}`));

  // Get final result with history
  const result = await stream.finalResult();
  console.log(`\nIterations: ${result.iterations}`);
  console.log(`Messages in history: ${result.messages.length}`);

  if (result.usage) {
    console.log(
      `Tokens used: ${result.usage.promptTokens} prompt + ${result.usage.completionTokens} completion = ${result.usage.totalTokens} total`,
    );
  }

  console.log("\n✓ Streaming test passed!");
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
    await testStreaming();

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
