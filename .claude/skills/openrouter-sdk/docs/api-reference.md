# OpenRouter SDK API Reference

Complete type definitions and API methods for @openrouter/sdk v0.1.11.

## SDK Configuration

```typescript
type SDKOptions = {
  apiKey?: string | (() => Promise<string>);
  httpClient?: HTTPClient;
  server?: "production";
  serverURL?: string;  // Override base URL
  userAgent?: string;
  retryConfig?: RetryConfig;
  timeoutMs?: number;
  debugLogger?: Logger;
};

// Server URL
const ServerList = {
  production: "https://openrouter.ai/api/v1"
};
```

## Chat API

### chat.send()

```typescript
// Non-streaming
send(request: ChatGenerationParams & { stream?: false }): Promise<ChatResponse>;

// Streaming
send(request: ChatGenerationParams & { stream: true }): Promise<EventStream<ChatStreamingResponseChunkData>>;
```

### ChatGenerationParams

```typescript
type ChatGenerationParams = {
  messages: Array<Message>;           // Required
  model?: string;                     // e.g. "anthropic/claude-sonnet-4"
  models?: Array<string>;             // Fallback models

  // Generation controls
  temperature?: number | null;        // 0-2
  topP?: number | null;               // 0-1
  maxTokens?: number | null;
  maxCompletionTokens?: number | null;
  stop?: string | Array<string> | null;
  seed?: number | null;

  // Penalties
  frequencyPenalty?: number | null;   // -2 to 2
  presencePenalty?: number | null;    // -2 to 2
  logitBias?: { [k: string]: number } | null;

  // Advanced
  logprobs?: boolean | null;
  topLogprobs?: number | null;

  // Structured output
  responseFormat?: ResponseFormatUnion;

  // Tool calling
  tools?: Array<ToolDefinitionJson>;
  toolChoice?: any;

  // Streaming
  stream?: boolean;
  streamOptions?: ChatStreamOptions | null;

  // Reasoning (for supported models)
  reasoning?: {
    effort?: "minimal" | "low" | "medium" | "high";
    summary?: ReasoningSummaryVerbosity;
  };

  // Metadata
  metadata?: { [k: string]: string };
  user?: string;
};
```

### Message Types

```typescript
type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResponseMessage
  | MessageDeveloper;

// System message
type SystemMessage = {
  role: "system";
  content: string | Array<ChatMessageContentItemText>;
  name?: string;
};

// User message
type UserMessage = {
  role: "user";
  content: string | Array<ChatMessageContentItem>;
  name?: string;
};

// Assistant message
type AssistantMessage = {
  role: "assistant";
  content?: string | Array<ChatMessageContentItem> | null;
  name?: string;
  toolCalls?: Array<ChatMessageToolCall>;
  refusal?: string | null;
  reasoning?: string | null;
};

// Tool response
type ToolResponseMessage = {
  role: "tool";
  content: string;
  toolCallId: string;
};

// Developer message
type MessageDeveloper = {
  role: "developer";
  content: string | Array<ChatMessageContentItemText>;
  name?: string;
};
```

### Content Items (Multimodal)

```typescript
type ChatMessageContentItem =
  | ChatMessageContentItemText
  | ChatMessageContentItemImage
  | ChatMessageContentItemAudio
  | ChatMessageContentItemVideo;

type ChatMessageContentItemText = {
  type: "text";
  text: string;
};

type ChatMessageContentItemImage = {
  type: "image_url";
  imageUrl: {
    url: string;  // URL or base64 data URI
    detail?: "auto" | "low" | "high";
  };
};

type ChatMessageContentItemAudio = {
  type: "input_audio";
  inputAudio: {
    data: string;   // Base64 encoded
    format: "wav" | "mp3";
  };
};
```

### Tool Definitions

```typescript
type ToolDefinitionJson = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: { [k: string]: any };  // JSON Schema
    strict?: boolean | null;
  };
};
```

### Tool Calls

```typescript
type ChatMessageToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;  // JSON string
  };
};
```

### Response Format Options

```typescript
type ResponseFormatUnion =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "python" }
  | ResponseFormatJSONSchema
  | ResponseFormatTextGrammar;

type ResponseFormatJSONSchema = {
  type: "json_schema";
  json_schema: {
    name: string;
    description?: string;
    schema: { [k: string]: any };  // JSON Schema
    strict?: boolean;
  };
};
```

### ChatResponse (Non-Streaming)

```typescript
type ChatResponse = {
  id: string;
  choices: Array<ChatResponseChoice>;
  created: number;
  model: string;
  object: "chat.completion";
  systemFingerprint?: string | null;
  usage?: ChatGenerationTokenUsage;
};

type ChatResponseChoice = {
  finishReason: ChatCompletionFinishReason | null;
  index: number;
  message: AssistantMessage;
  logprobs?: ChatMessageTokenLogprobs | null;
};

type ChatCompletionFinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "function_call";

type ChatGenerationTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};
```

### Streaming Response

```typescript
type ChatStreamingResponseChunkData = {
  id: string;
  choices: Array<ChatStreamingChoice>;
  created: number;
  model: string;
  object: "chat.completion.chunk";
  systemFingerprint?: string | null;
  error?: ChatStreamingResponseChunkError;
  usage?: ChatGenerationTokenUsage;
};

type ChatStreamingChoice = {
  index: number;
  delta: ChatStreamingMessageChunk;
  finishReason?: ChatCompletionFinishReason | null;
  logprobs?: ChatMessageTokenLogprobs | null;
};

type ChatStreamingMessageChunk = {
  role?: "assistant";
  content?: string | null;
  toolCalls?: Array<ChatStreamingMessageToolCall>;
  refusal?: string | null;
  reasoning?: string | null;
};
```

## Embeddings API

### embeddings.generate()

```typescript
generate(request: CreateEmbeddingsRequest): Promise<CreateEmbeddingsResponse>;

type CreateEmbeddingsRequest = {
  input: string | Array<string>;
  model: string;  // e.g. "openai/text-embedding-3-small"
  encodingFormat?: "float" | "base64";
  dimensions?: number;
};
```

### embeddings.listModels()

```typescript
listModels(): Promise<ModelsListResponse>;
```

## Models API

### models.list()

List all available models with their properties.

### models.get()

Get details for a specific model.

## Error Types

```typescript
// Chat-specific errors
class ChatError extends Error {
  code: number;  // 400, 401, 429, 500
}

// General errors
class BadRequestResponseError extends Error {}
class BadGatewayResponseError extends Error {}
class EdgeNetworkTimeoutResponseError extends Error {}

// Validation errors
class SDKValidationError extends Error {}
```

## Request Options

All methods accept optional `RequestOptions`:

```typescript
type RequestOptions = {
  fetchOptions?: RequestInit;  // Custom fetch options
  retries?: RetryConfig;
};

type RetryConfig = {
  strategy: "backoff" | "none";
  backoff?: {
    initialInterval: number;
    maxInterval: number;
    exponent: number;
    maxElapsedTime: number;
  };
  retryConnectionErrors?: boolean;
};
```

## Wire Format Notes

The SDK uses camelCase in TypeScript but converts to snake_case for the API:

| TypeScript | Wire Format |
|------------|-------------|
| `maxTokens` | `max_tokens` |
| `toolChoice` | `tool_choice` |
| `topP` | `top_p` |
| `frequencyPenalty` | `frequency_penalty` |
| `responseFormat` | `response_format` |
| `toolCalls` | `tool_calls` |
| `finishReason` | `finish_reason` |
| `systemFingerprint` | `system_fingerprint` |
