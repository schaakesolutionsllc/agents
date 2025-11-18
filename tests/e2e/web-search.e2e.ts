/**
 * E2E test: Web search with structured output
 */

import { describe, it, expect, beforeAll } from "vitest";
import { searchWithWeb } from "../../src/index.js";
import { z } from "zod";
import { skipIfNoApiKey, createProvider, TEST_MODEL } from "./setup.js";

describe("Web Search", () => {
  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  it("should search web and return structured results", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();

    // Define schema for structured web search results
    const searchResultSchema = z.object({
      summary: z.string(),
      keyPoints: z.array(z.string()),
      sources: z.array(z.string()).optional(),
    });

    const query = "What are the main features of TypeScript 5.0?";

    // Search with structured output
    const result = await searchWithWeb(provider, {
      query,
      model: TEST_MODEL,
      schema: searchResultSchema,
      engine: "exa",
      maxResults: 5,
      searchContextSize: "medium",
    });

    // Verify structure
    expect(typeof result.data.summary).toBe("string");
    expect(Array.isArray(result.data.keyPoints)).toBe(true);
    expect(result.data.keyPoints.length).toBeGreaterThan(0);
  });
});
