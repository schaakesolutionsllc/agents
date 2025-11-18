/**
 * E2E test: Basic chat completion
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createAgent } from "../../src/index.js";
import { skipIfNoApiKey, createProvider, TEST_MODEL } from "./setup.js";

describe("Basic Chat", () => {
  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  it("should complete a basic chat", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();
    const agent = createAgent<string, string>({
      name: "test-basic-chat",
      systemPrompt: "You are a helpful assistant. Keep responses brief.",
      model: {
        provider,
        model: TEST_MODEL,
        temperature: 0.7,
      },
    });

    const question = "What is 2+2? Answer in one sentence.";
    const answer = await agent.run(question);

    expect(answer).toBeTruthy();
    expect(typeof answer).toBe("string");
  });
});
