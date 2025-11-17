# Examples

This directory contains example implementations using `@schaake/agents`.

## Prerequisites

Before running these examples, make sure you have:

1. Installed the `@schaake/agents` package
2. Set up your OpenRouter API key:
   ```bash
   export OPENROUTER_API_KEY=your_api_key_here
   ```

## Available Examples

### 1. Simple Chat (`simple-chat.ts`)

A basic conversational agent without tools. Great starting point for understanding the basics.

**Features:**
- Simple string input/output
- No tools, just conversation
- Basic configuration

**Run it:**
```bash
tsx examples/simple-chat.ts
# or if built
node examples/simple-chat.js
```

### 2. Customer Support (`customer-support.ts`)

A customer support agent with ticket lookup and knowledge base search.

**Features:**
- Multiple tools (lookupTicket, searchKnowledgeBase)
- Structured output with Zod validation
- Logging and monitoring
- Simulated database interactions

**Run it:**
```bash
tsx examples/customer-support.ts
```

### 3. Research Agent (`research-agent.ts`)

A research agent that can search, fetch articles, and take notes.

**Features:**
- Complex multi-tool workflow
- Nested structured output
- Higher iteration limits for complex tasks
- Demonstrates tool chaining

**Run it:**
```bash
tsx examples/research-agent.ts
```

## Building Your Own Agent

Here's the basic pattern:

```typescript
import { OpenRouterProvider, createAgent, defineTool } from "@schaake/agents";
import { z } from "zod";

// 1. Initialize provider
const provider = new OpenRouterProvider();

// 2. Define tools (optional)
const myTool = defineTool(
  {
    name: "myTool",
    description: "What this tool does",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string" },
      },
      required: ["param1"],
    },
  },
  async (args, ctx) => {
    // Your tool logic
    return { result: "..." };
  }
);

// 3. Define output schema (optional)
const outputSchema = z.object({
  answer: z.string(),
});

// 4. Create agent
const agent = createAgent({
  name: "my-agent",
  systemPrompt: "You are...",
  model: {
    provider,
    model: "meta-llama/llama-3.1-8b-instruct",
  },
  tools: [myTool],
  outputSchema,
});

// 5. Run agent
const result = await agent.run("Your question here");
```

## Tips

1. **API Keys**: Always use environment variables for API keys
2. **Error Handling**: Wrap agent runs in try/catch blocks
3. **Logging**: Use the metadata logger to debug tool calls
4. **Models**: Choose models based on your task complexity and budget
5. **Temperature**: Lower (0.1-0.3) for factual tasks, higher (0.7-1.0) for creative tasks

## Model Recommendations

- **Simple chat**: `meta-llama/llama-3.1-8b-instruct` (fast, cheap)
- **Complex reasoning**: `anthropic/claude-3.5-sonnet` (high quality)
- **Tool use**: `meta-llama/llama-3.1-70b-instruct` (good balance)
- **Coding**: `qwen/qwen-2.5-coder-32b-instruct` (specialized)

See [OpenRouter Models](https://openrouter.ai/models) for the full list.
