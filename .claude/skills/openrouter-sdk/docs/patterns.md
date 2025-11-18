# OpenRouter SDK Usage Patterns

Common patterns and examples for @openrouter/sdk.

## Basic Chat

### Simple Request

```typescript
import OpenRouter from "@openrouter/sdk";

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});

const response = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" }
  ]
});

console.log(response.choices[0].message.content);
```

### With Parameters

```typescript
const response = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Write a haiku" }],
  temperature: 0.7,
  maxTokens: 100,
  topP: 0.9
});
```

## Streaming

### Basic Streaming

```typescript
const stream = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Count to 10" }],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

### Streaming with Tool Calls

```typescript
const stream = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
  tools: [weatherTool],
  stream: true
});

let toolCallId = "";
let toolName = "";
let toolArgs = "";

for await (const chunk of stream) {
  const choice = chunk.choices[0];

  // Handle text content
  if (choice.delta.content) {
    process.stdout.write(choice.delta.content);
  }

  // Handle tool calls (accumulate chunks)
  if (choice.delta.toolCalls) {
    for (const tc of choice.delta.toolCalls) {
      if (tc.id) toolCallId = tc.id;
      if (tc.function?.name) toolName = tc.function.name;
      if (tc.function?.arguments) toolArgs += tc.function.arguments;
    }
  }

  // Check for completion
  if (choice.finishReason === "tool_calls") {
    const args = JSON.parse(toolArgs);
    // Execute tool...
  }
}
```

### Collect Full Response from Stream

```typescript
const stream = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Hello" }],
  stream: true
});

let fullContent = "";
let usage = null;

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) fullContent += content;
  if (chunk.usage) usage = chunk.usage;
}

console.log("Full response:", fullContent);
console.log("Token usage:", usage);
```

## Tool Calling

### Define Tools

```typescript
const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City name, e.g., 'Tokyo'"
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"]
          }
        },
        required: ["location"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "search_web",
      description: "Search the web for information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    }
  }
];
```

### Tool Calling Loop

```typescript
async function runWithTools(userMessage: string) {
  const messages = [{ role: "user" as const, content: userMessage }];

  while (true) {
    const response = await client.chat.send({
      model: "anthropic/claude-sonnet-4",
      messages,
      tools
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // Add assistant response to history
    messages.push(assistantMessage);

    // Check if done
    if (choice.finishReason !== "tool_calls" || !assistantMessage.toolCalls) {
      return assistantMessage.content;
    }

    // Execute tools and add results
    for (const toolCall of assistantMessage.toolCalls) {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await executeToolCall(toolCall.function.name, args);

      messages.push({
        role: "tool",
        toolCallId: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }
}

async function executeToolCall(name: string, args: any) {
  switch (name) {
    case "get_weather":
      return { temperature: 22, conditions: "sunny" };
    case "search_web":
      return { results: ["Result 1", "Result 2"] };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

### Force Tool Usage

```typescript
const response = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Get weather for Paris" }],
  tools,
  toolChoice: {
    type: "function",
    function: { name: "get_weather" }
  }
});
```

### Disable Tools

```typescript
const response = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages,
  tools,
  toolChoice: "none"  // Model cannot use tools
});
```

## Structured Output

### JSON Schema Response

```typescript
const response = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "List 3 programming languages" }],
  responseFormat: {
    type: "json_schema",
    json_schema: {
      name: "languages",
      schema: {
        type: "object",
        properties: {
          languages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                paradigm: { type: "string" },
                year: { type: "number" }
              },
              required: ["name", "paradigm", "year"]
            }
          }
        },
        required: ["languages"]
      }
    }
  }
});

const result = JSON.parse(response.choices[0].message.content);
```

### Simple JSON Object

```typescript
const response = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Return a JSON object with name and age" }],
  responseFormat: { type: "json_object" }
});
```

## Multimodal Input

### Image Analysis

```typescript
const response = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe this image" },
        {
          type: "image_url",
          imageUrl: {
            url: "https://example.com/image.jpg",
            detail: "high"
          }
        }
      ]
    }
  ]
});
```

### Base64 Image

```typescript
import { readFileSync } from "fs";

const imageData = readFileSync("./image.png").toString("base64");

const response = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        {
          type: "image_url",
          imageUrl: {
            url: `data:image/png;base64,${imageData}`
          }
        }
      ]
    }
  ]
});
```

## Embeddings

### Generate Embeddings

```typescript
const response = await client.embeddings.generate({
  input: "The quick brown fox jumps over the lazy dog",
  model: "openai/text-embedding-3-small"
});

const embedding = response.data[0].embedding;
console.log("Dimensions:", embedding.length);
```

### Batch Embeddings

```typescript
const response = await client.embeddings.generate({
  input: [
    "First document",
    "Second document",
    "Third document"
  ],
  model: "openai/text-embedding-3-small"
});

for (const item of response.data) {
  console.log(`Index ${item.index}: ${item.embedding.length} dimensions`);
}
```

### Custom Dimensions

```typescript
const response = await client.embeddings.generate({
  input: "Hello world",
  model: "openai/text-embedding-3-small",
  dimensions: 256  // Reduce dimensions
});
```

## Error Handling

### Try-Catch Pattern

```typescript
import { ChatError } from "@openrouter/sdk/models/errors";

try {
  const response = await client.chat.send({
    model: "anthropic/claude-sonnet-4",
    messages: [{ role: "user", content: "Hello" }]
  });
} catch (error) {
  if (error instanceof ChatError) {
    console.error(`Chat error ${error.code}: ${error.message}`);

    switch (error.code) {
      case 400:
        console.log("Bad request - check parameters");
        break;
      case 401:
        console.log("Invalid API key");
        break;
      case 429:
        console.log("Rate limited - slow down");
        break;
      case 500:
        console.log("Server error - retry");
        break;
    }
  } else {
    throw error;
  }
}
```

### Retry Configuration

```typescript
const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  retryConfig: {
    strategy: "backoff",
    backoff: {
      initialInterval: 500,
      maxInterval: 60000,
      exponent: 1.5,
      maxElapsedTime: 300000
    },
    retryConnectionErrors: true
  }
});
```

### Per-Request Retry

```typescript
const response = await client.chat.send(
  {
    model: "anthropic/claude-sonnet-4",
    messages: [{ role: "user", content: "Hello" }]
  },
  {
    retries: {
      strategy: "backoff",
      backoff: {
        initialInterval: 1000,
        maxInterval: 30000,
        exponent: 2,
        maxElapsedTime: 60000
      }
    }
  }
);
```

## Model Fallbacks

### Multiple Models

```typescript
const response = await client.chat.send({
  models: [
    "anthropic/claude-sonnet-4",
    "openai/gpt-4o",
    "google/gemini-pro"
  ],
  messages: [{ role: "user", content: "Hello" }]
});

// Check which model was used
console.log("Model used:", response.model);
```

## Conversation History

### Multi-Turn Chat

```typescript
const messages = [];

// First turn
messages.push({ role: "user", content: "My name is Alice" });
const response1 = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages
});
messages.push(response1.choices[0].message);

// Second turn
messages.push({ role: "user", content: "What's my name?" });
const response2 = await client.chat.send({
  model: "anthropic/claude-sonnet-4",
  messages
});
// Response will include "Alice"
```

## Timeouts

### Client-Level Timeout

```typescript
const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  timeoutMs: 60000  // 60 seconds
});
```

### Per-Request Timeout

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await client.chat.send(
    {
      model: "anthropic/claude-sonnet-4",
      messages: [{ role: "user", content: "Hello" }]
    },
    {
      fetchOptions: { signal: controller.signal }
    }
  );
} finally {
  clearTimeout(timeoutId);
}
```
