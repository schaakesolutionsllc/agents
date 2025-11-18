# Agents Code Quality Phase 2 - Design

## Project Scope

**Affected Projects/Packages**:

- [x] `src/agent.ts` - Major refactoring
- [x] `src/openrouter.ts` - Helper extraction
- [x] `src/extraction.ts` - Import fixes
- [x] `src/web-search.ts` - Import fixes
- [x] `src/embeddings.ts` - Test coverage
- [x] `src/discovery.ts` - Test coverage
- [x] `src/types.ts` - Type improvements
- [x] `eslint.config.js` - Rule re-enablement
- [x] `tests/` - New test files

**Scope Type**: Single Project

**Primary Project**: @schaake/agents

---

## Architecture Overview

This is a refactoring spec - no architectural changes. Focus is on internal code quality improvements while maintaining the existing public API.

---

## Technology Choices

### Testing
- **Framework**: Vitest (existing)
- **Mocking**: vi.mock, vi.fn (existing patterns)
- **Coverage**: vitest coverage with thresholds

### Validation
- **Option 1**: Zod for tool argument validation (already a dependency)
- **Option 2**: AJV for JSON Schema validation (new dependency)

**Recommendation**: Use Zod since it's already a dependency and we can convert JSON Schema to Zod schemas.

---

## Key Refactorings

### Refactoring 1: agent.ts Helper Functions

**Current State**: `run()`, `runWithHistory()`, and `stream()` have nearly identical code blocks

**Target State**: Common functionality extracted to reusable helpers

```typescript
// New helper functions to add to agent.ts

/**
 * Creates an agent context for a run
 */
function createContext(
  metadata: Record<string, unknown>,
  onEvent?: (event: AgentEvent) => void
): AgentContext {
  return {
    runId: crypto.randomUUID(),
    metadata,
    logger: (metadata?.logger as Logger) ?? undefined,
    onEvent,
  };
}

/**
 * Builds response format configuration for structured outputs
 */
function buildResponseFormat<O>(
  config: AgentConfig<unknown, O>
): ResponseFormat | undefined {
  if (!config.outputSchema) return undefined;

  return {
    type: "json_schema" as const,
    jsonSchema: {
      name: config.name.replace(/[^a-zA-Z0-9_-]/g, "_"),
      description: `Structured output for ${config.name}`,
      schema: z.toJSONSchema(config.outputSchema as z.ZodType, {
        reused: "inline",
      }),
      strict: true,
    },
  };
}

/**
 * Parses structured output from raw content, handling markdown code blocks
 */
function parseStructuredOutput<O>(
  rawContent: string,
  schema: z.ZodType<O>,
  logger?: Logger
): O {
  let jsonStr = rawContent;

  // Try to extract JSON from markdown code blocks
  const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return schema.parse(parsed);
  } catch (error) {
    logger?.error?.("Failed to parse structured output", { rawContent, error });
    throw new Error(`createAgent: Failed to parse structured output as JSON: ${error}`);
  }
}
```

### Refactoring 2: openrouter.ts Helper Functions

**Current State**: Provider options and SDK request building duplicated between `chat()` and `chatStream()`

**Target State**: Extracted helper functions

```typescript
/**
 * Builds provider options for SDK requests
 */
function buildSDKProviderOptions(
  providerOptions?: ProviderOptions
): SDKProviderOptions | undefined {
  if (!providerOptions) return undefined;

  return {
    sort: providerOptions.sort,
    order: providerOptions.order,
    only: providerOptions.only,
    ignore: providerOptions.ignore,
    zdr: providerOptions.zdr,
    dataCollection: providerOptions.dataCollection,
    allowFallbacks: providerOptions.allowFallbacks,
    requireParameters: providerOptions.requireParameters,
    maxPrice: providerOptions.maxPrice,
    quantizations: providerOptions.quantizations,
  };
}

/**
 * Builds base SDK request from ChatRequest
 */
function buildSDKRequest(
  req: ChatRequest,
  stream: boolean
): SDKChatRequest {
  return {
    model: req.model,
    ...(req.models && { models: req.models }),
    messages: toSDKMessages(req.messages),
    temperature: req.temperature,
    topP: req.topP,
    maxTokens: req.maxTokens,
    stop: req.stop,
    tools: req.tools,
    toolChoice: req.toolChoice,
    responseFormat: req.responseFormat,
    provider: buildSDKProviderOptions(req.providerOptions),
    stream,
  };
}
```

### Refactoring 3: Type Improvements

**Current State**: `ToolHandler = (args: any, ctx: AgentContext) => Promise<any>`

**Target State**: Generic typed handler

```typescript
/**
 * Type-safe tool handler with explicit argument and return types
 */
export type ToolHandler<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown
> = (args: TArgs, ctx: AgentContext) => Promise<TResult>;

/**
 * Tool definition with typed handler
 */
export interface ToolDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown
> {
  name: string;
  description: string;
  schema: ToolSchema;
  handler: ToolHandler<TArgs, TResult>;
}
```

### Refactoring 4: Tool Argument Validation

**Location**: `agent.ts` in the tool execution loop

```typescript
// In executeToolCalls or similar
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true });

function validateToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  schema: JSONSchema
): void {
  const validate = ajv.compile(schema);
  if (!validate(args)) {
    const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join(", ");
    throw new Error(`createAgent: Invalid arguments for tool "${toolName}": ${errors}`);
  }
}
```

**Alternative with Zod** (preferred since no new dependency):

```typescript
import { z } from "zod";

function validateToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  schema: z.ZodType
): void {
  const result = schema.safeParse(args);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new Error(`createAgent: Invalid arguments for tool "${toolName}": ${errors}`);
  }
}
```

---

## File Structure

Changes to existing structure:

```
src/
├── agent.ts          # Add helper functions, reduce duplication
├── openrouter.ts     # Add helper functions
├── types.ts          # Improve type definitions
├── extraction.ts     # Fix imports
├── web-search.ts     # Fix imports
├── embeddings.ts     # (no changes, just tests)
└── discovery.ts      # (no changes, just tests)

tests/
├── agent.test.ts          # Existing
├── openrouter.test.ts     # Existing
├── embeddings.test.ts     # NEW
├── discovery.test.ts      # NEW
├── extraction.test.ts     # NEW
└── web-search.test.ts     # NEW

eslint.config.js      # Re-enable rules
```

---

## Testing Strategy

### New Test Files

#### embeddings.test.ts
```typescript
describe("embeddings", () => {
  describe("createEmbedding", () => {
    it("should create embedding for single text input");
    it("should create embeddings for multiple text inputs");
    it("should use default model if not specified");
    it("should pass dimensions parameter correctly");
    it("should handle API errors");
  });
});
```

#### discovery.test.ts
```typescript
describe("discovery", () => {
  describe("listModels", () => {
    it("should return list of available models");
    it("should filter models by capability");
    it("should handle empty results");
  });

  describe("getModelInfo", () => {
    it("should return model details");
    it("should throw for unknown model");
  });
});
```

#### extraction.test.ts
```typescript
describe("extraction", () => {
  describe("extractDocument", () => {
    it("should extract text from PDF file data");
    it("should extract text from PDF URL");
    it("should extract text from image file");
    it("should use custom schema for structured extraction");
    it("should throw if neither fileData nor fileUrl provided");
    it("should handle extraction errors");
  });
});
```

#### web-search.test.ts
```typescript
describe("web-search", () => {
  describe("searchWithWeb", () => {
    it("should perform web search and return results");
    it("should pass search context size parameter");
    it("should return citations");
    it("should handle no results");
    it("should handle API errors");
  });
});
```

### Coverage Targets

| File | Current | Target |
|------|---------|--------|
| agent.ts | ~85% | 90%+ |
| openrouter.ts | 55% | 80%+ |
| embeddings.ts | 0% | 90%+ |
| discovery.ts | 0% | 90%+ |
| extraction.ts | 0% | 90%+ |
| web-search.ts | 0% | 90%+ |

---

## ESLint Re-enablement Strategy

### Phase 1: Warning Level
```javascript
rules: {
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unsafe-assignment": "warn",
  "@typescript-eslint/no-unsafe-member-access": "warn",
  "@typescript-eslint/no-unsafe-call": "warn",
  "@typescript-eslint/no-unsafe-return": "warn",
  "@typescript-eslint/no-unsafe-argument": "warn",
}
```

### Phase 2: Fix Issues
- Address warnings file by file
- Add proper type annotations
- Use type guards where needed
- Add `as unknown as Type` only when necessary with documentation

### Phase 3: Error Level
```javascript
rules: {
  "@typescript-eslint/no-explicit-any": "error",
  // Keep some at warn if SDK interactions require them
}
```

---

## Constants Definition

```typescript
// In agent.ts or a new constants.ts

/** Default maximum number of tool iterations before agent stops */
export const DEFAULT_MAX_TOOL_ITERATIONS = 4;

/** Error message prefixes for consistent error reporting */
export const ERROR_PREFIXES = {
  AGENT: "createAgent:",
  OPENROUTER: "OpenRouterProvider:",
  EXTRACTION: "extractDocument:",
  WEB_SEARCH: "searchWithWeb:",
} as const;
```

---

## Error Message Standardization

### Before
```typescript
throw new Error("Agent exceeded maxToolIterations without finishing");
throw new Error("Failed to parse structured output as JSON");
```

### After
```typescript
throw new Error("createAgent: Agent exceeded maxToolIterations without finishing");
throw new Error("createAgent: Failed to parse structured output as JSON");
```

---

## Migration/Rollout Plan

### Order of Operations

1. **Fix Zod imports first** (minimal risk, unblocks other work)
2. **Add new test files** (no risk, validates existing behavior)
3. **Extract helper functions** (medium risk, maintain existing tests)
4. **Improve types** (low risk, compile-time only)
5. **Add tool validation** (low risk, additive)
6. **Re-enable ESLint rules** (last, after types fixed)

### Verification at Each Step

- Run `npm run build` after each change
- Run `npm test` after each change
- Run `npm run lint` after ESLint changes

---

## Open Questions / Technical Risks

- [ ] Should tool argument validation use Zod or AJV?
  - **Recommendation**: Zod to avoid new dependency

- [ ] How to handle SDK types that require `any`?
  - **Mitigation**: Document with `// eslint-disable-next-line` and comment explaining why

- [ ] Will refactoring affect performance?
  - **Mitigation**: Run benchmarks before/after on agent.ts changes

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [ESLint TypeScript Rules](https://typescript-eslint.io/rules/)
- [Zod Documentation](https://zod.dev/)
