/**
 * E2E test: Embeddings generation
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  createEmbeddings,
  listEmbeddingModels,
} from "../../src/index.js";
import { skipIfNoApiKey, createProvider } from "./setup.js";

// Use a small, fast embedding model for testing
const TEST_EMBEDDING_MODEL = "openai/text-embedding-3-small";

describe("Embeddings", () => {
  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  it("should generate embeddings for a single text", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();
    const result = await createEmbeddings(
      {
        provider,
        model: TEST_EMBEDDING_MODEL,
      },
      "Hello world",
    );

    expect(result).toBeDefined();
    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toBeInstanceOf(Array);
    expect(result.embeddings[0].length).toBeGreaterThan(0);
    expect(typeof result.embeddings[0][0]).toBe("number");
    expect(result.model).toBeTruthy();
    expect(result.usage.promptTokens).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  it("should generate embeddings for batch texts", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();
    const texts = ["Hello", "World", "Test embeddings"];
    const result = await createEmbeddings(
      {
        provider,
        model: TEST_EMBEDDING_MODEL,
      },
      texts,
    );

    expect(result.embeddings).toHaveLength(3);
    expect(result.embeddings[0]).toBeInstanceOf(Array);
    expect(result.embeddings[1]).toBeInstanceOf(Array);
    expect(result.embeddings[2]).toBeInstanceOf(Array);

    // Each embedding should have the same dimension
    const dimension = result.embeddings[0].length;
    expect(dimension).toBeGreaterThan(0);
    expect(result.embeddings[1].length).toBe(dimension);
    expect(result.embeddings[2].length).toBe(dimension);

    // Verify all values are numbers
    result.embeddings.forEach((embedding) => {
      embedding.forEach((value) => {
        expect(typeof value).toBe("number");
        expect(isFinite(value)).toBe(true);
      });
    });
  });

  it("should handle base64 encoding format", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();
    const result = await createEmbeddings(
      {
        provider,
        model: TEST_EMBEDDING_MODEL,
        encodingFormat: "base64",
      },
      "Test base64 encoding",
    );

    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toBeInstanceOf(Array);
    expect(result.embeddings[0].length).toBeGreaterThan(0);
    expect(typeof result.embeddings[0][0]).toBe("number");
  });

  it("should support provider routing options", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();

    // Test with minimal provider options to avoid API validation issues
    const result = await createEmbeddings(
      {
        provider,
        model: TEST_EMBEDDING_MODEL,
        providerOptions: {
          allowFallbacks: true,
        },
      },
      "Test provider routing",
    );

    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toBeInstanceOf(Array);
    expect(result.model).toBeTruthy();
  });

  it("should calculate usage and cost", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();
    const result = await createEmbeddings(
      {
        provider,
        model: TEST_EMBEDDING_MODEL,
      },
      "Calculate usage statistics",
    );

    expect(result.usage).toBeDefined();
    expect(result.usage.promptTokens).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBeGreaterThanOrEqual(
      result.usage.promptTokens,
    );
    // Cost might be undefined or a number
    if (result.usage.cost !== undefined) {
      expect(typeof result.usage.cost).toBe("number");
      expect(result.usage.cost).toBeGreaterThanOrEqual(0);
    }
  });

  it("should generate different embeddings for different texts", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();
    const result = await createEmbeddings(
      {
        provider,
        model: TEST_EMBEDDING_MODEL,
      },
      ["Hello world", "Completely different text"],
    );

    // The embeddings should be different
    const embedding1 = result.embeddings[0];
    const embedding2 = result.embeddings[1];

    // Calculate cosine similarity to verify they're different
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

    // Similarity should be less than 1 (not identical)
    expect(similarity).toBeLessThan(1.0);
    // But should be a valid similarity score
    expect(similarity).toBeGreaterThan(-1.0);
    expect(similarity).toBeLessThanOrEqual(1.0);
  });

  it("should list available embedding models", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();
    const models = await listEmbeddingModels(provider);

    expect(models).toBeInstanceOf(Array);
    expect(models.length).toBeGreaterThan(0);

    // Check structure of first model
    const firstModel = models[0];
    expect(firstModel.id).toBeTruthy();
    expect(typeof firstModel.id).toBe("string");

    // Verify the test model is in the list
    const testModelExists = models.some(
      (model) => model.id === TEST_EMBEDDING_MODEL,
    );
    expect(testModelExists).toBe(true);
  });
});
