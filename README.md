# @schaake/agents

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
@schaake:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

2. Install the package:

```bash
pnpm add @schaake/agents
# or
npm install @schaake/agents
# or
yarn add @schaake/agents
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
} from "@schaake/agents";
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
  handler: (args: any, ctx: AgentContext) => any
): ToolDefinition
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or PR.
