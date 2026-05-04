/**
 * Example: Simple Chat Agent
 *
 * This example demonstrates:
 * - Creating a basic conversational agent without tools
 * - Simple string input/output
 * - Basic configuration
 */

import { OpenRouterProvider, createAgent } from "@schaake-solutions/agents";

// Initialize OpenRouter provider
const openRouter = new OpenRouterProvider({
  // apiKey: process.env.OPENROUTER_API_KEY,
});

// Create a simple chat agent
export const chatAgent = createAgent<string, string>({
  name: "simple-chat",
  description: "A simple conversational assistant",
  systemPrompt: `
You are a helpful, friendly assistant. Provide clear and concise answers.
Be conversational but professional.
`.trim(),
  model: {
    provider: openRouter,
    model: "meta-llama/llama-3.1-8b-instruct",
    temperature: 0.7,
  },
  // No tools - just conversational
  // No output schema - returns raw string
});

// Example usage
async function main() {
  console.log("Simple Chat Agent Example\n");

  const questions = [
    "What is TypeScript?",
    "How does it differ from JavaScript?",
    "What are the main benefits?",
  ];

  for (const question of questions) {
    console.log(`\nUser: ${question}`);

    try {
      const answer = await chatAgent.run(question, {
        metadata: {
          conversationId: "demo-123",
        },
      });

      console.log(`Assistant: ${answer}`);
    } catch (error) {
      console.error("Error:", error);
    }
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
