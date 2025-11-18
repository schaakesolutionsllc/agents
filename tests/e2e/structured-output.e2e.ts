/**
 * E2E test: Structured output with Zod
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createAgent, type Schema } from "../../src/index.js";
import { z } from "zod";
import { skipIfNoApiKey, createProvider, TEST_MODEL } from "./setup.js";

describe("Structured Output", () => {
  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  it("should return structured output matching schema", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();

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
        model: TEST_MODEL,
        temperature: 0.3,
      },
      outputSchema,
    });

    const text =
      "I absolutely love this product! It exceeded all my expectations.";
    const result = await agent.run(text);

    // Verify it matches our schema
    expect(typeof result.sentiment).toBe("string");
    expect(["positive", "negative", "neutral"]).toContain(result.sentiment);
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.summary).toBe("string");
  });
});
