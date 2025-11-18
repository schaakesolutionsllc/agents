# @schaakesolutionsllc/agents

[![CI](https://github.com/schaakesolutionsllc/agents/actions/workflows/ci.yml/badge.svg)](https://github.com/schaakesolutionsllc/agents/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/schaakesolutionsllc/agents)](https://github.com/schaakesolutionsllc/agents/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org)

A type-safe, provider-agnostic AI agent framework with built-in OpenRouter support. Build intelligent agents with tools, structured outputs, and flexible schema validation.

## Features

- **Type-safe**: Full TypeScript support with strict typing
- **Provider-agnostic**: Interface-based design allows for any LLM provider
- **OpenRouter integration**: Uses the official `@openrouter/sdk` for accessing 200+ models
- **Tool calling**: Define and use tools with automatic execution loops
- **Structured output**: Support for Zod and other schema validators
- **Minimal dependencies**: Built on official SDKs with Zod for schema validation
- **ESM-first**: Modern ES modules with proper imports

## Installation

### From GitHub Packages

1. Create or update `.npmrc` in your project:

```bash
@schaakesolutionsllc:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

2. Install the package:

```bash
pnpm add @schaakesolutionsllc/agents
# or
npm install @schaakesolutionsllc/agents
# or
yarn add @schaakesolutionsllc/agents
```

### Local Development

```bash
# Clone and install
git clone <repo-url>
cd schaake-agents
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Link locally
pnpm link --global
```

## Quick Start

```typescript
import {
  OpenRouterProvider,
  createAgent,
  defineTool,
} from "@schaakesolutionsllc/agents";
import { z } from "zod";

// 1. Create an OpenRouter provider
const openRouter = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// 2. Define tools your agent can use
const weatherTool = defineTool(
  {
    name: "getWeather",
    description: "Get current weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name" },
      },
      required: ["location"],
    },
  },
  async (args) => {
    // Your implementation here
    return {
      location: args.location,
      temperature: 72,
      condition: "sunny",
    };
  },
);

// 3. Define output schema (optional)
const outputSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
});

// 4. Create your agent
const weatherAgent = createAgent({
  name: "weather-assistant",
  description: "Helps answer weather questions",
  systemPrompt: "You are a helpful weather assistant. Always respond as JSON.",
  model: {
    provider: openRouter,
    model: "meta-llama/llama-3.1-8b-instruct",
    temperature: 0.2,
  },
  tools: [weatherTool],
  outputSchema,
});

// 5. Run your agent
const result = await weatherAgent.run("What's the weather in San Francisco?");
console.log(result);
// { answer: "It's sunny in San Francisco with a temperature of 72°F", confidence: 0.95 }
```

## Core Concepts

### Providers

Providers implement the `LLMProvider` interface and handle communication with LLM APIs:

```typescript
interface LLMProvider {
  chat(req: ChatRequest): Promise<ChatResponse>;
}
```

The package includes `OpenRouterProvider` which connects to OpenRouter's API, giving you access to 200+ models from various providers.

### Agents

Agents are configured with:
- System prompts
- Model configuration
- Optional tools
- Optional input/output schemas

```typescript
const agent = createAgent({
  name: "my-agent",
  systemPrompt: "You are a helpful assistant",
  model: {
    provider: openRouter,
    model: "anthropic/claude-3.5-sonnet",
  },
  tools: [tool1, tool2],
  outputSchema: myZodSchema,
});
```

### Tools

Tools allow agents to perform actions. Define them with a JSON Schema and async handler:

```typescript
const searchTool = defineTool(
  {
    name: "search",
    description: "Search for information",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
  async (args, ctx) => {
    // ctx includes runId, metadata, and optional logger
    const results = await mySearchFunction(args.query);
    return results;
  },
);
```

### Logging

Pass a logger function to track agent execution:

```typescript
const result = await agent.run(input, {
  metadata: {
    logger: (event) => {
      if (event.type === "model_call") {
        console.log("Model called:", event.data);
      } else if (event.type === "tool_call") {
        console.log("Tool called:", event.data);
      }
    },
  },
});
```

## Error Handling

The framework provides comprehensive error handling to ensure agents fail gracefully and provide actionable feedback. Errors are categorized into three types: validation errors (caught at setup time), API errors (from the LLM provider), and tool execution errors (from tool handlers).

### API Key Validation

The `OpenRouterProvider` validates the API key at construction time, failing fast with clear resolution steps:

```typescript
import { OpenRouterProvider } from "@schaakesolutionsllc/agents";

try {
  const openRouter = new OpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
} catch (error) {
  console.error("Failed to initialize provider:", error.message);
  process.exit(1);
}
```

If the API key is missing, you'll receive a detailed error message:

```
OpenRouterProvider: API key is required but not provided.

Resolution steps:
1. Pass apiKey option: new OpenRouterProvider({ apiKey: 'your-key' })
2. Set OPENROUTER_API_KEY environment variable: export OPENROUTER_API_KEY=your-key
3. Get your API key from: https://openrouter.ai/keys

Choose one method and try again.
```

### Tool Handler Errors

The framework automatically wraps all tool handler executions in try-catch blocks. When a tool throws an exception, the error is caught, logged with full context, and reported back to the model as a tool result so the agent can continue:

```typescript
const searchTool = defineTool(
  {
    name: "search",
    description: "Search for information",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
  async (args) => {
    // If this throws, the framework catches it
    const results = await externalAPI.search(args.query);
    return results;
  },
);
```

When a tool handler throws an error:

1. The error is logged with full context (including stack trace for debugging)
2. A sanitized error message is sent to the model as the tool result
3. The agent continues execution, allowing the model to try a different approach

The error message sent to the model has this format:

```json
{
  "error": "Tool 'search' failed: Connection timeout",
  "status": "error"
}
```

This allows the model to understand what went wrong and potentially:
- Retry with different parameters
- Use an alternative tool
- Provide a helpful response explaining the issue

### Error Recovery Patterns

The framework supports several error recovery patterns:

**Automatic Recovery**: The agent continues after tool failures, giving the model a chance to adapt:

```typescript
const result = await agent.run("Search for recent news about AI");
// If searchTool fails, model receives error and can respond appropriately
// e.g., "I couldn't search for news due to a connection error. Please try again later."
```

**Monitoring Errors**: Use the logger to track and analyze tool failures:

```typescript
const result = await agent.run(userQuery, {
  metadata: {
    logger: (event) => {
      if (event.type === "tool_result" && event.data.error) {
        // Log tool failure for monitoring
        console.error(`Tool ${event.data.name} failed:`, event.data.error);
        // Stack trace available in event.data.stack
      }
    },
  },
});
```

**Multiple Tools with Fallback**: When you have multiple tools that might fail, the agent can gracefully degrade:

```typescript
const agent = createAgent({
  name: "resilient-agent",
  // ...
  tools: [primarySearchTool, backupSearchTool, cacheTool],
});

// If primary search fails, model can use backup or cache
```

### Security Considerations

When implementing tool handlers, follow these security best practices:

**Avoid Storing Sensitive Data in Context**

Tool handlers receive context that may be logged or persisted. Never store sensitive information like passwords, API keys, or personal data in the context:

```typescript
// BAD: Don't store sensitive data in context
const badTool = defineTool(schema, async (args, ctx) => {
  ctx.metadata = { ...ctx.metadata, userPassword: args.password }; // Don't do this!
  // ...
});

// GOOD: Process sensitive data without storing
const goodTool = defineTool(schema, async (args, ctx) => {
  const hashedPassword = await hashPassword(args.password);
  return { success: true, userId: "123" };
});
```

**Stack Traces in Logs Only**

The framework logs full stack traces for debugging but sends only sanitized error messages to the model. This prevents information leakage while maintaining debuggability:

- **Logged**: Full error message, stack trace, and arguments
- **Sent to model**: `Tool 'name' failed: error message` (no stack trace)

**Validate Tool Arguments**

The framework validates that tool arguments can be parsed as JSON, but you should validate the content within your handler:

```typescript
const userTool = defineTool(
  {
    name: "getUser",
    // ...
  },
  async (args) => {
    // Validate input before processing
    if (!args.userId || typeof args.userId !== "string") {
      throw new Error("Invalid userId: must be a non-empty string");
    }
    // Process with validated input
    return await fetchUser(args.userId);
  },
);
```

**Best Practices Checklist**:
- Never log or store raw passwords or API keys
- Validate tool arguments before processing
- Sanitize error messages to avoid exposing internal details
- Use environment variables for sensitive configuration
- Don't include sensitive data in error messages thrown from handlers

### Common Error Scenarios

| Scenario | Error Message | Solution |
|----------|--------------|----------|
| Missing API key | `OpenRouterProvider: API key is required but not provided` | Set `OPENROUTER_API_KEY` environment variable or pass `apiKey` option |
| Tool not found | `Tool not found` (in tool result) | Check tool name matches definition exactly |
| Invalid JSON arguments | `Invalid arguments JSON` (in tool result) | Model provided malformed JSON; will retry automatically |
| Tool handler throws | `Tool 'name' failed: message` (in tool result) | Agent continues; model can try alternative approach |
| Output schema parse failure | `Failed to parse structured output as JSON` | Ensure model returns valid JSON matching schema |
| Max iterations exceeded | `Agent exceeded maxToolIterations without finishing` | Increase `maxToolIterations` option or simplify task |

## Streaming Usage

The framework provides a streaming API for real-time responses. Streaming allows you to process content as it arrives from the model, provide immediate feedback to users, and handle tool calls during the stream.

### Basic Streaming

Use `agent.stream()` to get real-time content as it's generated:

```typescript
import { OpenRouterProvider, createAgent } from "@schaakesolutionsllc/agents";

const openRouter = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const agent = createAgent({
  name: "streaming-assistant",
  systemPrompt: "You are a helpful assistant.",
  model: {
    provider: openRouter,
    model: "anthropic/claude-3.5-sonnet",
  },
});

// Start streaming
const stream = agent.stream("Explain how async iterators work in JavaScript");

// Process chunks as they arrive
for await (const chunk of stream) {
  if (chunk.type === "content") {
    // Write content to stdout as it streams in
    process.stdout.write(chunk.content);
  } else if (chunk.type === "done") {
    // Stream completed
    console.log("\n\nStream finished!");
  }
}
```

### Handling All Chunk Types

The `StreamChunk` type is a discriminated union with four variants:

- `content` - Streamed text content from the model
- `tool_call` - A tool invocation call from the model
- `tool_result` - The result of a tool execution
- `done` - Terminal event indicating stream completion

```typescript
const stream = agent.stream(userQuery);

for await (const chunk of stream) {
  switch (chunk.type) {
    case "content":
      // Incremental text content
      process.stdout.write(chunk.content);
      break;

    case "tool_call":
      // Tool is being called - chunk.toolCall contains the full ChatToolCall
      console.log(`\nCalling tool: ${chunk.toolCall.function.name}`);
      console.log(`Arguments: ${chunk.toolCall.function.arguments}`);
      break;

    case "tool_result":
      // Tool execution completed - chunk.toolResult has name and result
      console.log(`\nTool ${chunk.toolResult.name} returned:`);
      console.log(JSON.stringify(chunk.toolResult.result, null, 2));
      break;

    case "done":
      // Stream completed successfully
      console.log("\nDone!");
      break;
  }
}
```

### Using finalResult()

After consuming the stream, call `finalResult()` to get the complete execution result including the final output, full message history, and usage statistics:

```typescript
const stream = agent.stream("Search for information about TypeScript generics");

// Consume the stream
for await (const chunk of stream) {
  if (chunk.type === "content") {
    process.stdout.write(chunk.content);
  }
}

// Get the complete result after streaming
const result = await stream.finalResult();

console.log("\n\nFinal output:", result.output);
console.log("Total iterations:", result.iterations);
console.log("Message history length:", result.messages.length);

// Usage statistics (if available)
if (result.usage) {
  console.log("Tokens used:", result.usage.totalTokens);
}

// Access full conversation history for logging or continuation
for (const message of result.messages) {
  console.log(`[${message.role}]: ${message.content?.substring(0, 100)}...`);
}
```

Note: You can call `finalResult()` at any time - if the stream hasn't completed yet, it will automatically consume the remaining chunks before returning.

### Streaming with Tool Calls

Streaming works seamlessly with tools. The framework automatically executes tools and continues streaming the response:

```typescript
import {
  OpenRouterProvider,
  createAgent,
  defineTool,
} from "@schaakesolutionsllc/agents";
import { z } from "zod";

const openRouter = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Define a search tool
const searchTool = defineTool(
  {
    name: "search",
    description: "Search for information on a topic",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  async (args) => {
    // Simulate search
    return {
      results: [
        { title: "Result 1", snippet: `Information about ${args.query}` },
        { title: "Result 2", snippet: `More details on ${args.query}` },
      ],
    };
  },
);

// Define a calculator tool
const calculatorTool = defineTool(
  {
    name: "calculator",
    description: "Perform mathematical calculations",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression to evaluate" },
      },
      required: ["expression"],
    },
  },
  async (args) => {
    // Simple eval for demo - use a proper math parser in production
    const result = Function(`"use strict"; return (${args.expression})`)();
    return { result };
  },
);

const agent = createAgent({
  name: "research-assistant",
  systemPrompt: "You are a helpful research assistant with access to search and calculation tools.",
  model: {
    provider: openRouter,
    model: "anthropic/claude-3.5-sonnet",
  },
  tools: [searchTool, calculatorTool],
});

// Stream with tools
const stream = agent.stream(
  "Search for the population of Tokyo and calculate what percentage it is of Japan's total population (126 million)"
);

for await (const chunk of stream) {
  switch (chunk.type) {
    case "content":
      process.stdout.write(chunk.content);
      break;

    case "tool_call":
      console.log(`\n[Tool Call] ${chunk.toolCall.function.name}`);
      break;

    case "tool_result":
      console.log(`[Tool Result] ${chunk.toolResult.name}: ${JSON.stringify(chunk.toolResult.result)}`);
      break;

    case "done":
      console.log("\n[Complete]");
      break;
  }
}

// Get final result with full history
const { output, messages, iterations } = await stream.finalResult();
console.log(`\nCompleted in ${iterations} iteration(s)`);
console.log(`Total messages in history: ${messages.length}`);
```

### Streaming with Structured Output

Streaming also works with structured output schemas. The stream yields content chunks during generation, and the final output is parsed and validated:

```typescript
import { z } from "zod";

const outputSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const agent = createAgent({
  name: "summarizer",
  systemPrompt: "Summarize the given text. Return JSON with summary, keyPoints array, and confidence score.",
  model: {
    provider: openRouter,
    model: "anthropic/claude-3.5-sonnet",
  },
  outputSchema,
});

const stream = agent.stream("Explain the benefits of TypeScript...");

// Stream the raw content as it arrives
for await (const chunk of stream) {
  if (chunk.type === "content") {
    process.stdout.write(chunk.content);
  }
}

// Get the parsed and validated output
const { output } = await stream.finalResult();

// output is fully typed as { summary: string; keyPoints: string[]; confidence: number }
console.log("\n\nSummary:", output.summary);
console.log("Key points:", output.keyPoints);
console.log("Confidence:", output.confidence);
```

## Examples

See the [`examples/`](./examples) directory for complete working examples:

- `customer-support.ts`: Agent with database lookups and structured responses
- `research-agent.ts`: Multi-tool agent for research tasks
- `simple-chat.ts`: Basic conversational agent

## Development

```bash
# Install dependencies
pnpm install

# Build the library
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests (requires OPENROUTER_API_KEY)
pnpm test:e2e

# Run E2E tests in watch mode
pnpm test:e2e:watch

# Lint code
pnpm lint

# Format code
pnpm format
```

## Publishing

### To GitHub Packages

1. Ensure you're authenticated with GitHub Packages
2. Update version in `package.json`
3. Build and publish:

```bash
pnpm build
pnpm publish
```

### To NPM (if migrating later)

1. Update `publishConfig` in `package.json`:
```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  }
}
```

2. Publish:
```bash
npm publish --access public
```

## API Reference

### OpenRouterProvider

```typescript
class OpenRouterProvider implements LLMProvider {
  constructor(opts?: {
    apiKey?: string;
    baseUrl?: string;
    debugLogger?: typeof console; // Enable SDK debug logging
  });
}
```

The provider uses the official `@openrouter/sdk` under the hood.

### createAgent

```typescript
function createAgent<I = unknown, O = unknown>(
  config: AgentConfig<I, O>
): Agent<I, O>
```

### defineTool

```typescript
function defineTool(
  schema: ToolSchema,
  handler: ToolHandler
): ToolDefinition
```

### defineSyncTool

```typescript
function defineSyncTool(
  schema: ToolSchema,
  handler: (args: Record<string, unknown>, ctx: AgentContext) => unknown
): ToolDefinition
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or PR.
