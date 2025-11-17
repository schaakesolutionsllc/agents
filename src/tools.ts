// src/tools.ts
import type {
  AgentContext,
  ToolDefinition,
  ToolHandler,
  ToolSchema,
} from "./types.js";

export function defineTool(
  schema: ToolSchema,
  handler: ToolHandler,
): ToolDefinition {
  return { schema, handler };
}

// Optional: helper to wrap sync fns
export function defineSyncTool(
  schema: ToolSchema,
  handler: (args: any, ctx: AgentContext) => any,
): ToolDefinition {
  const asyncHandler: ToolHandler = async (args, ctx) => handler(args, ctx);
  return { schema, handler: asyncHandler };
}
