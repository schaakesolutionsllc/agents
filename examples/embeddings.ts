/**
 * Example: Vector Embeddings for Semantic Search
 *
 * This example demonstrates:
 * - Generating embeddings for single and multiple texts
 * - Building a simple semantic search system
 * - Calculating cosine similarity between vectors
 * - Listing available embedding models
 */

import {
  OpenRouterProvider,
  createEmbeddings,
  listEmbeddingModels,
} from "@schaake-solutions/agents";

// Initialize OpenRouter provider
const openRouter = new OpenRouterProvider({
  // apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Example 1: Generate embeddings for a single text
 */
async function singleTextExample() {
  console.log("Example 1: Single Text Embedding\n");

  const text = "TypeScript is a typed superset of JavaScript";

  const result = await createEmbeddings(
    {
      provider: openRouter,
      model: "openai/text-embedding-3-small",
    },
    text,
  );

  console.log(`Text: "${text}"`);
  console.log(`Embedding dimensions: ${result.embeddings[0].length}`);
  console.log(`First 5 values: ${result.embeddings[0].slice(0, 5).map(v => v.toFixed(4)).join(", ")}`);
  console.log(`Tokens used: ${result.usage.totalTokens}`);
  if (result.usage.cost) {
    console.log(`Cost: $${result.usage.cost.toFixed(6)}`);
  }
}

/**
 * Example 2: Batch processing multiple texts
 */
async function batchProcessingExample() {
  console.log("\n\nExample 2: Batch Processing\n");

  const texts = [
    "What is machine learning?",
    "How do neural networks work?",
    "Explain transformers in AI",
    "What are large language models?",
  ];

  const result = await createEmbeddings(
    {
      provider: openRouter,
      model: "openai/text-embedding-3-small",
    },
    texts,
  );

  console.log(`Generated ${result.embeddings.length} embeddings`);
  texts.forEach((text, i) => {
    console.log(`  ${i + 1}. "${text}" -> ${result.embeddings[i].length} dimensions`);
  });
  console.log(`Total tokens: ${result.usage.totalTokens}`);
}

/**
 * Example 3: Semantic search - find similar documents
 */
async function semanticSearchExample() {
  console.log("\n\nExample 3: Semantic Search\n");

  // Sample knowledge base
  const documents = [
    "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript",
    "Python is a high-level, interpreted programming language known for its simplicity",
    "React is a JavaScript library for building user interfaces, maintained by Meta",
    "Machine learning is a subset of AI that enables systems to learn from data",
    "Docker is a platform for developing, shipping, and running applications in containers",
    "Git is a distributed version control system for tracking changes in source code",
    "PostgreSQL is a powerful, open-source relational database system",
    "Redis is an in-memory data structure store used as a database and cache",
  ];

  console.log(`Indexing ${documents.length} documents...`);

  // Generate embeddings for all documents
  const docResult = await createEmbeddings(
    {
      provider: openRouter,
      model: "openai/text-embedding-3-small",
    },
    documents,
  );

  // Search query
  const query = "What is TypeScript?";
  console.log(`\nSearch query: "${query}"\n`);

  // Generate embedding for the query
  const queryResult = await createEmbeddings(
    {
      provider: openRouter,
      model: "openai/text-embedding-3-small",
    },
    query,
  );

  const queryEmbedding = queryResult.embeddings[0];

  // Calculate similarity scores
  const similarities = docResult.embeddings.map((docEmbedding, i) => ({
    document: documents[i],
    similarity: cosineSimilarity(queryEmbedding, docEmbedding),
  }));

  // Sort by similarity (highest first)
  similarities.sort((a, b) => b.similarity - a.similarity);

  // Show top 3 results
  console.log("Top 3 most relevant documents:\n");
  similarities.slice(0, 3).forEach(({ document, similarity }, i) => {
    console.log(`${i + 1}. [Score: ${similarity.toFixed(4)}]`);
    console.log(`   ${document}\n`);
  });

  console.log(`Total tokens used: ${docResult.usage.totalTokens + queryResult.usage.totalTokens}`);
}

/**
 * Example 4: Using provider options for optimization
 */
async function providerOptionsExample() {
  console.log("\n\nExample 4: Provider Options\n");

  const text = "Sensitive data that should not be retained";

  const result = await createEmbeddings(
    {
      provider: openRouter,
      model: "openai/text-embedding-3-small",
      providerOptions: {
        sort: "cost", // Optimize for lowest cost
        order: "asc",
        allowFallbacks: true,
        zdr: true, // Zero data retention - don't store inputs
      },
    },
    text,
  );

  console.log("Generated embedding with privacy settings:");
  console.log(`  - Zero data retention: enabled`);
  console.log(`  - Cost optimization: enabled`);
  console.log(`  - Dimensions: ${result.embeddings[0].length}`);
  console.log(`  - Model used: ${result.model}`);
}

/**
 * Example 5: List available embedding models
 */
async function listModelsExample() {
  console.log("\n\nExample 5: Available Embedding Models\n");

  const models = await listEmbeddingModels(openRouter);

  console.log(`Found ${models.length} embedding models:\n`);

  // Show first 5 models with details
  models.slice(0, 5).forEach((model) => {
    console.log(`- ${model.id}`);
    if (model.name) {
      console.log(`  Name: ${model.name}`);
    }
    if (model.pricing?.prompt) {
      console.log(`  Cost: $${model.pricing.prompt} per 1K tokens`);
    }
    console.log();
  });

  if (models.length > 5) {
    console.log(`... and ${models.length - 5} more models`);
  }
}

/**
 * Example 6: Compare similarity between different text pairs
 */
async function similarityComparisonExample() {
  console.log("\n\nExample 6: Similarity Comparison\n");

  const texts = [
    "The cat sat on the mat",
    "A feline rested on the rug",
    "JavaScript is a programming language",
  ];

  const result = await createEmbeddings(
    {
      provider: openRouter,
      model: "openai/text-embedding-3-small",
    },
    texts,
  );

  console.log("Comparing similarities:\n");

  // Compare first two texts (similar meaning)
  const sim1 = cosineSimilarity(result.embeddings[0], result.embeddings[1]);
  console.log(`"${texts[0]}"`);
  console.log(`  vs.`);
  console.log(`"${texts[1]}"`);
  console.log(`  Similarity: ${sim1.toFixed(4)} (similar meaning)\n`);

  // Compare first and third texts (different meaning)
  const sim2 = cosineSimilarity(result.embeddings[0], result.embeddings[2]);
  console.log(`"${texts[0]}"`);
  console.log(`  vs.`);
  console.log(`"${texts[2]}"`);
  console.log(`  Similarity: ${sim2.toFixed(4)} (different meaning)\n`);
}

// Main function to run all examples
async function main() {
  console.log("=".repeat(60));
  console.log("Vector Embeddings Examples");
  console.log("=".repeat(60));

  try {
    await singleTextExample();
    await batchProcessingExample();
    await semanticSearchExample();
    await providerOptionsExample();
    await listModelsExample();
    await similarityComparisonExample();

    console.log("\n" + "=".repeat(60));
    console.log("All examples completed successfully!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nError running examples:", error);
    process.exit(1);
  }
}

// Run the examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
