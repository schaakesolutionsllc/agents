import { describe, it, expect } from "vitest";
import { defineTool, defineSyncTool } from "../src/tools.js";
import type { AgentContext } from "../src/types.js";

describe("defineTool", () => {
  it("should create a tool definition with async handler", async () => {
    const tool = defineTool(
      {
        name: "testTool",
        description: "A test tool",
        parameters: {
          type: "object",
          properties: {
            input: { type: "string" },
          },
        },
      },
      async (args) => {
        return { output: args.input.toUpperCase() };
      },
    );

    expect(tool.schema.name).toBe("testTool");
    expect(tool.schema.description).toBe("A test tool");

    const ctx: AgentContext = {
      runId: "test-run",
    };

    const result = await tool.handler({ input: "hello" }, ctx);
    expect(result).toEqual({ output: "HELLO" });
  });
});

describe("defineSyncTool", () => {
  it("should create a tool definition with sync handler wrapped in async", async () => {
    const tool = defineSyncTool(
      {
        name: "syncTool",
        description: "A synchronous tool",
        parameters: {
          type: "object",
          properties: {
            value: { type: "number" },
          },
        },
      },
      (args) => {
        return { doubled: args.value * 2 };
      },
    );

    expect(tool.schema.name).toBe("syncTool");

    const ctx: AgentContext = {
      runId: "test-run",
    };

    const result = await tool.handler({ value: 5 }, ctx);
    expect(result).toEqual({ doubled: 10 });
  });
});
