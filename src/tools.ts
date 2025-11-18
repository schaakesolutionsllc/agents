// src/tools.ts
import type {
  AgentContext,
  ToolDefinition,
  ToolHandler,
  ToolSchema,
} from "./types.js";

/**
 * Creates a tool definition from a schema and async handler.
 *
 * Tools define capabilities that agents can invoke during execution.
 * The schema describes the tool's name, purpose, and parameters,
 * while the handler implements the tool's functionality.
 *
 * @param schema - The tool schema with name, description, and parameters
 * @param handler - Async function that executes the tool logic
 * @returns A complete tool definition ready for agent configuration
 *
 * @example
 * ```typescript
 * const weatherTool = defineTool(
 *   {
 *     name: "get_weather",
 *     description: "Get current weather for a location",
 *     parameters: {
 *       type: "object",
 *       properties: {
 *         location: {
 *           type: "string",
 *           description: "City and state, e.g., San Francisco, CA"
 *         }
 *       },
 *       required: ["location"]
 *     }
 *   },
 *   async (args, ctx) => {
 *     const weather = await fetchWeather(args.location);
 *     return {
 *       temperature: weather.temp,
 *       condition: weather.condition
 *     };
 *   }
 * );
 *
 * const agent = createAgent({
 *   name: "weather-agent",
 *   model: modelConfig,
 *   tools: [weatherTool]
 * });
 * ```
 *
 * @see defineSyncTool - For synchronous tool handlers
 * @see ToolDefinition - The returned type structure
 */
export function defineTool(
  schema: ToolSchema,
  handler: ToolHandler,
): ToolDefinition {
  return { schema, handler };
}

/**
 * Creates a tool definition from a schema and synchronous handler.
 *
 * This is a convenience wrapper for tools that don't need async operations.
 * The synchronous handler is automatically wrapped with Promise.resolve().
 *
 * @param schema - The tool schema with name, description, and parameters
 * @param handler - Synchronous function that executes the tool logic
 * @returns A complete tool definition with an async-wrapped handler
 *
 * @example
 * ```typescript
 * const calculatorTool = defineSyncTool(
 *   {
 *     name: "calculate",
 *     description: "Perform basic arithmetic",
 *     parameters: {
 *       type: "object",
 *       properties: {
 *         operation: {
 *           type: "string",
 *           enum: ["add", "subtract", "multiply", "divide"]
 *         },
 *         a: { type: "number" },
 *         b: { type: "number" }
 *       },
 *       required: ["operation", "a", "b"]
 *     }
 *   },
 *   (args) => {
 *     const { operation, a, b } = args;
 *     switch (operation) {
 *       case "add": return { result: a + b };
 *       case "subtract": return { result: a - b };
 *       case "multiply": return { result: a * b };
 *       case "divide": return { result: a / b };
 *     }
 *   }
 * );
 * ```
 *
 * @see defineTool - For async tool handlers
 */
export function defineSyncTool(
  schema: ToolSchema,
  handler: (args: any, ctx: AgentContext) => any,
): ToolDefinition {
  const asyncHandler: ToolHandler = (args, ctx) =>
    Promise.resolve(handler(args, ctx));
  return { schema, handler: asyncHandler };
}
