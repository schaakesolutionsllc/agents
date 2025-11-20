import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEmbeddings, listEmbeddingModels } from "../src/embeddings.js";
import type { OpenRouterProvider } from "../src/openrouter.js";

/**
 * Creates a mock OpenRouter provider with mocked embeddings methods
 */
function createMockEmbeddingsProvider() {
  const generateMock = vi.fn();
  const listModelsMock = vi.fn();

  const provider = {
    client: {
      embeddings: {
        generate: generateMock,
        listModels: listModelsMock,
      },
    },
  } as unknown as OpenRouterProvider;

  return { provider, generateMock, listModelsMock };
}

describe("createEmbeddings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate embeddings for a single text", async () => {
    const { provider, generateMock } = createMockEmbeddingsProvider();

    // Mock response
    generateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
      model: "openai/text-embedding-3-small",
      usage: {
        promptTokens: 5,
        totalTokens: 5,
        cost: 0.0001,
      },
    });

    const result = await createEmbeddings(
      {
        provider,
        model: "openai/text-embedding-3-small",
      },
      "Hello world",
    );

    expect(result).toEqual({
      embeddings: [[0.1, 0.2, 0.3]],
      model: "openai/text-embedding-3-small",
      usage: {
        promptTokens: 5,
        totalTokens: 5,
        cost: 0.0001,
      },
    });

    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(generateMock).toHaveBeenCalledWith({
      input: "Hello world",
      model: "openai/text-embedding-3-small",
      provider: undefined,
      encodingFormat: undefined,
      user: undefined,
    });
  });

  it("should generate embeddings for batch texts", async () => {
    const { provider, generateMock } = createMockEmbeddingsProvider();

    // Mock response for batch
    generateMock.mockResolvedValue({
      data: [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [0.4, 0.5, 0.6] },
        { embedding: [0.7, 0.8, 0.9] },
      ],
      model: "openai/text-embedding-3-small",
      usage: {
        promptTokens: 10,
        totalTokens: 10,
      },
    });

    const texts = ["Hello", "World", "Test"];
    const result = await createEmbeddings(
      {
        provider,
        model: "openai/text-embedding-3-small",
      },
      texts,
    );

    expect(result.embeddings).toHaveLength(3);
    expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    expect(result.embeddings[1]).toEqual([0.4, 0.5, 0.6]);
    expect(result.embeddings[2]).toEqual([0.7, 0.8, 0.9]);

    expect(generateMock).toHaveBeenCalledWith({
      input: texts,
      model: "openai/text-embedding-3-small",
      provider: undefined,
      encodingFormat: undefined,
      user: undefined,
    });
  });

  it("should decode base64-encoded embeddings", async () => {
    const { provider, generateMock } = createMockEmbeddingsProvider();

    // Create a base64-encoded float array
    // [1.0, 2.0, 3.0] as little-endian floats
    const buffer = Buffer.alloc(12);
    buffer.writeFloatLE(1.0, 0);
    buffer.writeFloatLE(2.0, 4);
    buffer.writeFloatLE(3.0, 8);
    const base64Encoded = buffer.toString("base64");

    generateMock.mockResolvedValue({
      data: [{ embedding: base64Encoded }],
      model: "openai/text-embedding-3-small",
      usage: {
        promptTokens: 5,
        totalTokens: 5,
      },
    });

    const result = await createEmbeddings(
      {
        provider,
        model: "openai/text-embedding-3-small",
        encodingFormat: "base64",
      },
      "Test base64",
    );

    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toHaveLength(3);
    expect(result.embeddings[0][0]).toBeCloseTo(1.0);
    expect(result.embeddings[0][1]).toBeCloseTo(2.0);
    expect(result.embeddings[0][2]).toBeCloseTo(3.0);

    expect(generateMock).toHaveBeenCalledWith({
      input: "Test base64",
      model: "openai/text-embedding-3-small",
      provider: undefined,
      encodingFormat: "base64",
      user: undefined,
    });
  });

  it("should pass provider options correctly", async () => {
    const { provider, generateMock } = createMockEmbeddingsProvider();

    generateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
      model: "openai/text-embedding-3-small",
      usage: {
        promptTokens: 5,
        totalTokens: 5,
      },
    });

    await createEmbeddings(
      {
        provider,
        model: "openai/text-embedding-3-small",
        providerOptions: {
          sort: "cost",
          order: ["openai", "google"],
          only: ["openai"],
          ignore: ["anthropic"],
          zdr: true,
          dataCollection: "deny",
          allowFallbacks: true,
          requireParameters: false,
          maxPrice: 0.001,
          quantizations: "int8",
        },
      },
      "Test provider options",
    );

    expect(generateMock).toHaveBeenCalledWith({
      input: "Test provider options",
      model: "openai/text-embedding-3-small",
      provider: {
        sort: "cost",
        order: ["openai", "google"],
        only: ["openai"],
        ignore: ["anthropic"],
        zdr: true,
        dataCollection: "deny",
        allowFallbacks: true,
        requireParameters: false,
        maxPrice: 0.001,
        quantizations: "int8",
      },
      encodingFormat: undefined,
      user: undefined,
    });
  });

  it("should pass user identifier when provided", async () => {
    const { provider, generateMock } = createMockEmbeddingsProvider();

    generateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
      model: "openai/text-embedding-3-small",
      usage: {
        promptTokens: 5,
        totalTokens: 5,
      },
    });

    await createEmbeddings(
      {
        provider,
        model: "openai/text-embedding-3-small",
        user: "user-123",
      },
      "Test user tracking",
    );

    expect(generateMock).toHaveBeenCalledWith({
      input: "Test user tracking",
      model: "openai/text-embedding-3-small",
      provider: undefined,
      encodingFormat: undefined,
      user: "user-123",
    });
  });

  it("should handle missing usage data gracefully", async () => {
    const { provider, generateMock } = createMockEmbeddingsProvider();

    generateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
      model: "openai/text-embedding-3-small",
      // No usage field
    });

    const result = await createEmbeddings(
      {
        provider,
        model: "openai/text-embedding-3-small",
      },
      "Test missing usage",
    );

    expect(result.usage).toEqual({
      promptTokens: 0,
      totalTokens: 0,
      cost: undefined,
    });
  });

  it("should handle empty response data", async () => {
    const { provider, generateMock } = createMockEmbeddingsProvider();

    generateMock.mockResolvedValue({
      model: "openai/text-embedding-3-small",
      usage: {
        promptTokens: 0,
        totalTokens: 0,
      },
    });

    const result = await createEmbeddings(
      {
        provider,
        model: "openai/text-embedding-3-small",
      },
      "Test empty response",
    );

    expect(result.embeddings).toEqual([]);
  });

  it("should use fallback model when response model is missing", async () => {
    const { provider, generateMock } = createMockEmbeddingsProvider();

    generateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
      // No model field
      usage: {
        promptTokens: 5,
        totalTokens: 5,
      },
    });

    const result = await createEmbeddings(
      {
        provider,
        model: "openai/text-embedding-3-small",
      },
      "Test fallback model",
    );

    expect(result.model).toBe("openai/text-embedding-3-small");
  });

  it("should include cost when available", async () => {
    const { provider, generateMock } = createMockEmbeddingsProvider();

    generateMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
      model: "openai/text-embedding-3-small",
      usage: {
        promptTokens: 5,
        totalTokens: 5,
        cost: 0.0002,
      },
    });

    const result = await createEmbeddings(
      {
        provider,
        model: "openai/text-embedding-3-small",
      },
      "Test cost tracking",
    );

    expect(result.usage.cost).toBe(0.0002);
  });
});

describe("listEmbeddingModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list available embedding models", async () => {
    const { provider, listModelsMock } = createMockEmbeddingsProvider();

    listModelsMock.mockResolvedValue({
      data: [
        {
          id: "openai/text-embedding-3-small",
          name: "Text Embedding 3 Small",
          pricing: {
            prompt: "0.00002",
            completion: "0",
          },
        },
        {
          id: "openai/text-embedding-3-large",
          name: "Text Embedding 3 Large",
          pricing: {
            prompt: "0.00013",
            completion: "0",
          },
        },
      ],
    });

    const result = await listEmbeddingModels(provider);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "openai/text-embedding-3-small",
      name: "Text Embedding 3 Small",
      pricing: {
        prompt: "0.00002",
        completion: "0",
      },
    });
    expect(result[1]).toEqual({
      id: "openai/text-embedding-3-large",
      name: "Text Embedding 3 Large",
      pricing: {
        prompt: "0.00013",
        completion: "0",
      },
    });

    expect(listModelsMock).toHaveBeenCalledTimes(1);
  });

  it("should handle models without name or pricing", async () => {
    const { provider, listModelsMock } = createMockEmbeddingsProvider();

    listModelsMock.mockResolvedValue({
      data: [
        {
          id: "custom/embedding-model",
          // No name or pricing
        },
      ],
    });

    const result = await listEmbeddingModels(provider);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "custom/embedding-model",
      name: undefined,
      pricing: undefined,
    });
  });

  it("should handle empty model list", async () => {
    const { provider, listModelsMock } = createMockEmbeddingsProvider();

    listModelsMock.mockResolvedValue({
      data: [],
    });

    const result = await listEmbeddingModels(provider);

    expect(result).toEqual([]);
  });
});
