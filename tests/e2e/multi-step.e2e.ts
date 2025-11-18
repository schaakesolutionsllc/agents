/**
 * E2E test: Multi-step tool calling
 *
 * This test verifies that an agent can:
 * 1. Make a tool call
 * 2. Realize it needs more information
 * 3. Make additional tool calls
 * 4. Finally answer the question
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createAgent, defineTool } from "../../src/index.js";
import { skipIfNoApiKey, createProvider, TEST_MODEL } from "./setup.js";

describe("Multi-Step Tool Calling", () => {
  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  it("should perform multi-step tool calling to answer complex queries", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const provider = createProvider();

    // Tool 1: Look up a user's ID by email
    const getUserId = defineTool(
      {
        name: "getUserId",
        description: "Look up a user's ID by their email address",
        parameters: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "The user's email address",
            },
          },
          required: ["email"],
        },
      },
      async (args) => {
        // Mock database lookup
        const users: Record<string, string> = {
          "john@example.com": "user_123",
          "jane@example.com": "user_456",
          "bob@example.com": "user_789",
        };

        const userId = users[args.email];

        if (!userId) {
          return { error: "User not found" };
        }

        return { userId };
      },
    );

    // Tool 2: Get user's order history by user ID
    const getOrderHistory = defineTool(
      {
        name: "getOrderHistory",
        description: "Get a user's order history by their user ID",
        parameters: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "The user's ID",
            },
          },
          required: ["userId"],
        },
      },
      async (args) => {
        // Mock database lookup
        const orders: Record<string, Array<{
          orderId: string;
          date: string;
          total: number;
          status: string;
        }>> = {
          user_123: [
            {
              orderId: "ORD-001",
              date: "2024-01-15",
              total: 49.99,
              status: "delivered",
            },
            {
              orderId: "ORD-002",
              date: "2024-02-20",
              total: 129.99,
              status: "delivered",
            },
            {
              orderId: "ORD-003",
              date: "2024-03-10",
              total: 79.99,
              status: "shipped",
            },
          ],
          user_456: [
            {
              orderId: "ORD-004",
              date: "2024-01-05",
              total: 199.99,
              status: "delivered",
            },
          ],
          user_789: [
            {
              orderId: "ORD-005",
              date: "2024-02-01",
              total: 59.99,
              status: "delivered",
            },
            {
              orderId: "ORD-006",
              date: "2024-03-15",
              total: 89.99,
              status: "processing",
            },
          ],
        };

        const userOrders = orders[args.userId] || [];

        return { orders: userOrders, count: userOrders.length };
      },
    );

    // Tool 3: Get specific order details
    const getOrderDetails = defineTool(
      {
        name: "getOrderDetails",
        description: "Get detailed information about a specific order",
        parameters: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "The order ID",
            },
          },
          required: ["orderId"],
        },
      },
      async (args) => {
        // Mock order details
        const orderDetails: Record<string, {
          orderId: string;
          items: Array<{ name: string; price: number; quantity: number }>;
          shippingAddress: string;
          trackingNumber: string;
        }> = {
          "ORD-001": {
            orderId: "ORD-001",
            items: [{ name: "Wireless Mouse", price: 24.99, quantity: 2 }],
            shippingAddress: "123 Main St, Anytown, USA",
            trackingNumber: "TRACK123",
          },
          "ORD-002": {
            orderId: "ORD-002",
            items: [{ name: "Mechanical Keyboard", price: 129.99, quantity: 1 }],
            shippingAddress: "123 Main St, Anytown, USA",
            trackingNumber: "TRACK456",
          },
          "ORD-003": {
            orderId: "ORD-003",
            items: [{ name: "USB-C Cable", price: 19.99, quantity: 4 }],
            shippingAddress: "123 Main St, Anytown, USA",
            trackingNumber: "TRACK789",
          },
        };

        return orderDetails[args.orderId] || { error: "Order not found" };
      },
    );

    const agent = createAgent<string, string>({
      name: "multi-step-support",
      systemPrompt: `You are a helpful customer support agent. You have access to tools to look up customer information.

When asked about orders:
1. Use getUserId to find the customer by their email
2. Use getOrderHistory to see their orders
3. Use getOrderDetails to see what's in a specific order

Be thorough and look up all the information needed to fully answer the question.`,
      model: {
        provider,
        model: TEST_MODEL,
        temperature: 0.0,
      },
      tools: [getUserId, getOrderHistory, getOrderDetails],
    });

    const question =
      "What orders has john@example.com placed, and what items are in their most recent order?";

    let toolCallCount = 0;

    const answer = await agent.run(question, {
      maxToolIterations: 10, // Allow more iterations for multi-step
      metadata: {
        logger: (event) => {
          if (event.type === "tool_call") {
            toolCallCount++;
          }
        },
      },
    });

    // Verify we got an answer
    expect(answer).toBeTruthy();
    expect(typeof answer).toBe("string");

    // Verify multi-step reasoning occurred (should be at least 3 tool calls)
    expect(toolCallCount).toBeGreaterThanOrEqual(3);
  });
});
