/**
 * Example: Research Agent
 *
 * This example demonstrates:
 * - Multiple tools working together
 * - More complex tool interactions
 * - Structured output with nested data
 */

import {
  OpenRouterProvider,
  createAgent,
  defineTool,
  type Schema,
} from "@schaake-solutions/agents";
import { z } from "zod";

// Initialize OpenRouter provider
const openRouter = new OpenRouterProvider();

// Tool 1: Search the web (mocked)
const webSearch = defineTool(
  {
    name: "webSearch",
    description: "Search the web for information",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
          default: 5,
        },
      },
      required: ["query"],
    },
  },
  async (args, ctx) => {
    console.log(`[${ctx.runId}] Searching web: "${args.query}"`);

    // Mock search results
    return {
      query: args.query,
      results: [
        {
          title: "Introduction to AI Agents",
          url: "https://example.com/ai-agents-intro",
          snippet:
            "AI agents are autonomous systems that can perceive, reason, and act...",
        },
        {
          title: "Building Intelligent Systems",
          url: "https://example.com/intelligent-systems",
          snippet: "Learn how to build systems that can make decisions autonomously...",
        },
      ],
    };
  },
);

// Tool 2: Fetch article content (mocked)
const fetchArticle = defineTool(
  {
    name: "fetchArticle",
    description: "Fetch the full content of an article given its URL",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the article to fetch",
        },
      },
      required: ["url"],
    },
  },
  async (args, ctx) => {
    console.log(`[${ctx.runId}] Fetching article: ${args.url}`);

    // Mock article content
    return {
      url: args.url,
      title: "Introduction to AI Agents",
      author: "Jane Smith",
      published: "2024-01-15",
      content: `
AI agents represent a significant advancement in artificial intelligence.
These systems can autonomously perceive their environment, make decisions,
and take actions to achieve specific goals.

Key characteristics of AI agents:
1. Autonomy - operate without human intervention
2. Reactivity - respond to environmental changes
3. Pro-activeness - take initiative to achieve goals
4. Social ability - interact with other agents and humans

Modern AI agents leverage large language models to understand context,
reason about complex scenarios, and communicate naturally.
      `.trim(),
    };
  },
);

// Tool 3: Take notes (mocked)
const takeNotes = defineTool(
  {
    name: "takeNotes",
    description: "Save research notes for later reference",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "The topic of the notes",
        },
        notes: {
          type: "string",
          description: "The notes to save",
        },
      },
      required: ["topic", "notes"],
    },
  },
  async (args, ctx) => {
    console.log(`[${ctx.runId}] Saving notes on: ${args.topic}`);

    // In a real app, save to database
    return {
      saved: true,
      topic: args.topic,
      timestamp: new Date().toISOString(),
    };
  },
);

// Define structured output schema
const researchOutputSchema: Schema<{
  summary: string;
  keyFindings: string[];
  sources: Array<{ title: string; url: string }>;
  confidence: number;
}> = z.object({
  summary: z.string().describe("A comprehensive summary of the research"),
  keyFindings: z
    .array(z.string())
    .describe("List of key findings from the research"),
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
      }),
    )
    .describe("Sources used in the research"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence level in the findings (0-1)"),
});

// Create the research agent
export const researchAgent = createAgent<
  string,
  {
    summary: string;
    keyFindings: string[];
    sources: Array<{ title: string; url: string }>;
    confidence: number;
  }
>({
  name: "research-agent",
  description: "Conducts research on topics using web search and article analysis",
  systemPrompt: `
You are a research assistant. When given a research question:

1. Use webSearch to find relevant sources
2. Use fetchArticle to get detailed content from promising sources
3. Use takeNotes to save important findings
4. Synthesize the information into a clear summary

Always respond as JSON with:
{
  "summary": "Comprehensive summary of findings",
  "keyFindings": ["Finding 1", "Finding 2", ...],
  "sources": [{"title": "...", "url": "..."}, ...],
  "confidence": 0.0-1.0
}

Be thorough but concise. Cite your sources.
`.trim(),
  model: {
    provider: openRouter,
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.3,
    maxTokens: 2000,
  },
  tools: [webSearch, fetchArticle, takeNotes],
  outputSchema: researchOutputSchema,
});

// Example usage
async function main() {
  console.log("Research Agent Example\n");

  try {
    const question = "What are AI agents and how do they work?";
    console.log(`Research Question: ${question}\n`);

    const result = await researchAgent.run(question, {
      maxToolIterations: 6, // Allow more iterations for complex research
      metadata: {
        userId: "demo-user",
        logger: (event) => {
          if (event.type === "tool_call") {
            console.log(`\n[TOOL] ${event.data.name}`);
          } else if (event.type === "model_call") {
            console.log(
              `\n[MODEL] Iteration ${event.data.iteration}`,
            );
          }
        },
      },
    });

    console.log("\n\nResearch Results:");
    console.log("=================");
    console.log(`\nSummary:\n${result.summary}`);
    console.log(`\nKey Findings:`);
    result.keyFindings.forEach((finding, i) => {
      console.log(`${i + 1}. ${finding}`);
    });
    console.log(`\nSources:`);
    result.sources.forEach((source) => {
      console.log(`- ${source.title} (${source.url})`);
    });
    console.log(`\nConfidence: ${(result.confidence * 100).toFixed(0)}%`);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
