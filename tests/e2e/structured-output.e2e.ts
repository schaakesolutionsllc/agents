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

  it("should return structured output with runWithHistory", async () => {
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
      name: "test-structured-output-history",
      systemPrompt: `Analyze the sentiment of the given text.`,
      model: {
        provider,
        model: TEST_MODEL,
        temperature: 0.3,
      },
      outputSchema,
    });

    const text =
      "This is terrible! I'm very disappointed with the quality.";
    const result = await agent.runWithHistory(text, {
      metadata: {
        testId: "structured-output-test",
        version: "v1.0",
      },
    });

    // Verify it matches our schema
    expect(typeof result.output.sentiment).toBe("string");
    expect(["positive", "negative", "neutral"]).toContain(result.output.sentiment);
    expect(typeof result.output.confidence).toBe("number");
    expect(result.output.confidence).toBeGreaterThanOrEqual(0);
    expect(result.output.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.output.summary).toBe("string");

    // Verify we get message history
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.iterations).toBeGreaterThan(0);
  });

  it("should return structured output with Claude model", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();

    // Define output schema similar to EvaluationOutputSchema
    const outputSchema: Schema<{
      score: number;
      reasoning: string;
      recommendation: "accept" | "reject" | "review";
    }> = z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string(),
      recommendation: z.enum(["accept", "reject", "review"]),
    });

    const agent = createAgent<
      string,
      {
        score: number;
        reasoning: string;
        recommendation: "accept" | "reject" | "review";
      }
    >({
      name: "test-claude-structured-output",
      systemPrompt: `You are an evaluator. Analyze the given application and provide a score, reasoning, and recommendation.`,
      model: {
        provider,
        model: "anthropic/claude-sonnet-4.5", // Same model family as user
        temperature: 0.2,
        maxTokens: 1500,
        topP: 0.9,
      },
      outputSchema,
      buildInputMessages: (input) => {
        return [
          {
            role: "user",
            content: `## APPLICATION TO EVALUATE\n\n${input}\n\nPlease evaluate this application.`,
          },
        ];
      },
    });

    const result = await agent.runWithHistory(
      "Company: TechStartup\nFounder: John Doe\nPitch: We are building an AI-powered solution for automated testing.",
      {
        metadata: {
          applicationId: "test-123",
          promptVersion: "v1.0",
        },
      }
    );

    // Verify it matches our schema
    expect(typeof result.output.score).toBe("number");
    expect(result.output.score).toBeGreaterThanOrEqual(0);
    expect(result.output.score).toBeLessThanOrEqual(100);
    expect(typeof result.output.reasoning).toBe("string");
    expect(["accept", "reject", "review"]).toContain(result.output.recommendation);

    // Verify we get message history
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
  });
});
