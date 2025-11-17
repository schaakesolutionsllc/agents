/**
 * Example: Customer Support Agent
 *
 * This example demonstrates:
 * - Defining tools for database lookups
 * - Using Zod for structured output validation
 * - Configuring an agent with system prompts
 * - Running an agent with logging
 */

import {
  OpenRouterProvider,
  createAgent,
  defineTool,
  type Schema,
} from "@schaake/agents";
import { z } from "zod";

// Initialize OpenRouter provider
const openRouter = new OpenRouterProvider({
  // apiKey: process.env.OPENROUTER_API_KEY, // or pass explicitly
});

// Define a tool to look up support tickets
const lookupTicket = defineTool(
  {
    name: "lookupTicket",
    description: "Fetch a support ticket by its ID from the database",
    parameters: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: "The unique ticket identifier",
        },
      },
      required: ["ticketId"],
      additionalProperties: false,
    },
  },
  async (args, ctx) => {
    // In a real application, you would query your database here
    console.log(`[${ctx.runId}] Looking up ticket: ${args.ticketId}`);

    // Simulated database response
    const mockTickets: Record<string, any> = {
      "T-123": {
        id: "T-123",
        status: "open",
        priority: "high",
        subject: "Cannot login to account",
        description: "User reports password reset not working",
        created: "2024-01-15",
        customer: "john@example.com",
      },
      "T-456": {
        id: "T-456",
        status: "resolved",
        priority: "low",
        subject: "Feature request: Dark mode",
        description: "Customer would like dark mode option",
        created: "2024-01-10",
        resolved: "2024-01-12",
        customer: "jane@example.com",
      },
    };

    const ticket = mockTickets[args.ticketId];

    if (!ticket) {
      return {
        error: "Ticket not found",
        ticketId: args.ticketId,
      };
    }

    return ticket;
  },
);

// Define a tool to search knowledge base
const searchKnowledgeBase = defineTool(
  {
    name: "searchKnowledgeBase",
    description: "Search the knowledge base for relevant articles",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
      },
      required: ["query"],
    },
  },
  async (args, ctx) => {
    console.log(`[${ctx.runId}] Searching knowledge base: ${args.query}`);

    // Mock knowledge base results
    return {
      results: [
        {
          title: "How to Reset Your Password",
          url: "https://help.example.com/password-reset",
          summary: "Step-by-step guide to resetting your password",
        },
        {
          title: "Account Security Best Practices",
          url: "https://help.example.com/security",
          summary: "Tips for keeping your account secure",
        },
      ],
    };
  },
);

// Define the output schema using Zod
const ticketResponseSchema: Schema<{
  summary: string;
  nextSteps: string[];
  relatedArticles?: string[];
}> = z.object({
  summary: z.string().describe("A concise summary of the ticket status"),
  nextSteps: z
    .array(z.string())
    .describe("Recommended next steps for the customer"),
  relatedArticles: z
    .array(z.string())
    .optional()
    .describe("URLs of related help articles"),
});

// Create the customer support agent
export const customerSupportAgent = createAgent<
  string,
  {
    summary: string;
    nextSteps: string[];
    relatedArticles?: string[];
  }
>({
  name: "customer-support",
  description: "Helps answer customer support questions using ticket data",
  systemPrompt: `
You are a helpful customer support agent. When asked about tickets:
1. Use the lookupTicket tool to fetch ticket details
2. Use searchKnowledgeBase to find relevant help articles
3. Provide a clear summary and actionable next steps

Always respond as JSON with this structure:
{
  "summary": "Brief summary of the situation",
  "nextSteps": ["Step 1", "Step 2", ...],
  "relatedArticles": ["url1", "url2", ...] (optional)
}
`.trim(),
  model: {
    provider: openRouter,
    model: "meta-llama/llama-3.1-70b-instruct",
    temperature: 0.2,
    maxTokens: 1000,
  },
  tools: [lookupTicket, searchKnowledgeBase],
  outputSchema: ticketResponseSchema,
});

// Example usage
async function main() {
  console.log("Customer Support Agent Example\n");

  try {
    const question = "What's the status of ticket T-123?";
    console.log(`Question: ${question}\n`);

    const answer = await customerSupportAgent.run(question, {
      metadata: {
        endpoint: "/api/support",
        logger: (event) => {
          if (event.type === "tool_call") {
            console.log(
              `[TOOL CALL] ${event.data.name}:`,
              JSON.stringify(event.data.args, null, 2),
            );
          } else if (event.type === "tool_result") {
            console.log(
              `[TOOL RESULT] ${event.data.name}:`,
              JSON.stringify(event.data.result, null, 2),
            );
          }
        },
      },
    });

    console.log("\nAgent Response:");
    console.log(JSON.stringify(answer, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
