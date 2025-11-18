# Task 004: Extract Agent.ts Helper Functions

**Status:** Pending

**Wave:** 3
**Dependencies:** Task 002 (Agent Refactoring - Setup)
**Estimated Duration:** 45m
**Category:** refactor

---

## Context

### Requirements Excerpt
> Extract `createContext()` helper function... Extract `buildResponseFormat()` helper... Extract `parseStructuredOutput()` helper... Reduce total duplicated code from ~600 lines to near zero

### Design Excerpt
Includes full function signatures for createContext, buildResponseFormat, and parseStructuredOutput with proper TypeScript types.

---

## Implementation Details

### Overview
Three substantial blocks of duplicated code exist across `run()`, `runWithHistory()`, and `stream()` methods in `/home/markschaake/projects/schaake-agents/src/agent.ts`. This task extracts:

1. **createContext()** - Centralized context creation (lines 363-368, 545-550, 708-713)
2. **buildResponseFormat()** - Response format generation from outputSchema (lines 375-387, 557-569, 720-732)
3. **parseStructuredOutput()** - JSON parsing with markdown extraction fallback (lines 458-495, 641-677, 898-934)

### Duplicated Code Patterns

#### Pattern 1: Context Creation (~40 lines duplicated across 3 methods)
```typescript
const ctx: AgentContext = {
  runId: crypto.randomUUID(),
  metadata,
  logger: metadata?.logger ?? undefined,
  onEvent,
};
```

#### Pattern 2: Response Format Generation (~20 lines duplicated across 3 methods)
```typescript
const responseFormat = config.outputSchema
  ? {
      type: "json_schema" as const,
      jsonSchema: {
        name: config.name.replace(/[^a-zA-Z0-9_-]/g, "_"),
        description: `Structured output for ${config.name}`,
        schema: z.toJSONSchema(config.outputSchema as z.ZodType, {
          reused: "inline",
        }),
        strict: true,
      },
    }
  : undefined;
```

#### Pattern 3: Structured Output Parsing (~38 lines duplicated across 3 methods)
```typescript
const parsed = config.outputSchema
  ? config.outputSchema.parse(
      (() => {
        try {
          return JSON.parse(rawContent);
        } catch (parseError) {
          // Try to extract JSON from markdown code blocks
          const jsonMatch = rawContent.match(
            /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
          );
          if (jsonMatch?.[1]) {
            try {
              return JSON.parse(jsonMatch[1]);
            } catch {
              // Fall through to error
            }
          }

          ctx.logger?.({
            type: "final",
            data: {
              content: rawContent,
              error: "Failed to parse JSON",
              parseError:
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError),
            },
          });

          throw new Error(
            `Failed to parse structured output as JSON. Raw content: ${rawContent.substring(0, 200)}${rawContent.length > 200 ? "..." : ""}`,
          );
        }
      })(),
    )
  : (rawContent as unknown as O);
```

### Extraction Strategy

#### 1. Extract `createContext()` Helper
Location: Add as internal function after `runToolCalls()`, before `createAgent()`

**Function Signature:**
```typescript
/**
 * Creates an agent execution context with unique ID and event handlers.
 *
 * The context is passed to all tool handlers and contains:
 * - runId: Unique identifier for this execution
 * - metadata: Optional metadata for logging/tracking
 * - logger: Optional logging callback
 * - onEvent: Event emission callback for monitoring
 *
 * @param metadata - Optional metadata including logger callback
 * @param onEvent - Optional event handler for agent events
 * @returns AgentContext with all required properties initialized
 *
 * @internal
 */
function createContext(
  metadata: AgentRunOptions['metadata'],
  onEvent: AgentRunOptions['onEvent']
): AgentContext {
  return {
    runId: crypto.randomUUID(),
    metadata,
    logger: metadata?.logger ?? undefined,
    onEvent,
  };
}
```

**Usage in run():**
```typescript
const ctx = createContext(metadata, onEvent);
```

**Usage in runWithHistory():**
```typescript
const ctx = createContext(metadata, onEvent);
```

**Usage in stream():**
```typescript
const ctx = createContext(metadata, onEvent);
```

#### 2. Extract `buildResponseFormat()` Helper
Location: Add as internal function after `createContext()`

**Function Signature:**
```typescript
/**
 * Builds JSON schema response format from an output schema.
 *
 * Converts a Zod schema into OpenAI-compatible JSON schema format
 * with inline refs for provider compatibility. Used when the agent
 * is configured with an outputSchema for structured outputs.
 *
 * @template O - The output type
 * @param config - Agent configuration containing name and outputSchema
 * @returns ResponseFormat object suitable for provider chat calls,
 *          or undefined if no outputSchema is configured
 *
 * @internal
 */
function buildResponseFormat<O>(
  config: AgentConfig<any, O>
): ResponseFormat | undefined {
  if (!config.outputSchema) return undefined;

  return {
    type: "json_schema" as const,
    jsonSchema: {
      name: config.name.replace(/[^a-zA-Z0-9_-]/g, "_"),
      description: `Structured output for ${config.name}`,
      schema: z.toJSONSchema(config.outputSchema as z.ZodType, {
        reused: "inline", // Inline all refs for OpenRouter compatibility
      }),
      strict: true,
    },
  };
}
```

**Usage in run():**
```typescript
const responseFormat = buildResponseFormat(config);
```

**Usage in runWithHistory():**
```typescript
const responseFormat = buildResponseFormat(config);
```

**Usage in stream():**
```typescript
const responseFormat = buildResponseFormat(config);
```

#### 3. Extract `parseStructuredOutput()` Helper
Location: Add as internal function after `buildResponseFormat()`

**Function Signature:**
```typescript
/**
 * Parses raw model output with support for structured and raw outputs.
 *
 * When outputSchema is configured:
 * 1. Attempts direct JSON parse of rawContent
 * 2. Falls back to extracting JSON from markdown code blocks
 * 3. Logs and throws helpful error if both fail
 * 4. Validates parsed JSON against outputSchema
 *
 * When no outputSchema: returns rawContent as-is (cast to output type)
 *
 * Handles common LLM behavior where structured output may be wrapped
 * in markdown code blocks or returned as raw JSON.
 *
 * @template O - The expected output type
 * @param rawContent - Raw text from the model
 * @param config - Agent configuration with optional outputSchema
 * @param ctx - Agent context for logging
 * @returns Parsed output validated against schema, or raw content if no schema
 * @throws Error when JSON parsing fails (when outputSchema is configured)
 *
 * @internal
 */
function parseStructuredOutput<O>(
  rawContent: string,
  config: AgentConfig<any, O>,
  ctx: AgentContext
): O {
  if (!config.outputSchema) {
    return rawContent as unknown as O;
  }

  return config.outputSchema.parse(
    (() => {
      try {
        return JSON.parse(rawContent);
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = rawContent.match(
          /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
        );
        if (jsonMatch?.[1]) {
          try {
            return JSON.parse(jsonMatch[1]);
          } catch {
            // Fall through to error
          }
        }

        // If we have an output schema but can't parse JSON, throw a helpful error
        ctx.logger?.({
          type: "final",
          data: {
            content: rawContent,
            error: "Failed to parse JSON",
            parseError:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          },
        });

        throw new Error(
          `Failed to parse structured output as JSON. Raw content: ${rawContent.substring(0, 200)}${rawContent.length > 200 ? "..." : ""}`,
        );
      }
    })(),
  );
}
```

**Usage in run():**
```typescript
const parsed = parseStructuredOutput(rawContent, config, ctx);
```

**Usage in runWithHistory():**
```typescript
const parsed = parseStructuredOutput(rawContent, config, ctx);
```

**Usage in stream() (in generateChunks generator):**
```typescript
const parsed = parseStructuredOutput(rawContent, config, ctx);
```

### Implementation Steps

1. **Add JSDoc documentation** for each helper function with clear descriptions of parameters, return types, and behavior

2. **Extract createContext()** helper:
   - Place after `runToolCalls()` function
   - Replace 6 lines of context creation in each of 3 methods
   - Total lines removed: ~18 lines

3. **Extract buildResponseFormat()** helper:
   - Place after `createContext()` function
   - Replace 13-line responseFormat generation in each of 3 methods
   - Total lines removed: ~39 lines

4. **Extract parseStructuredOutput()** helper:
   - Place after `buildResponseFormat()` function
   - Replace 38-line parsing block in each of 3 methods
   - Total lines removed: ~114 lines

5. **Update run() method:**
   - Line 363-368: Replace context creation with `const ctx = createContext(metadata, onEvent);`
   - Line 375-387: Replace responseFormat with `const responseFormat = buildResponseFormat(config);`
   - Line 458-495: Replace parsing block with `const parsed = parseStructuredOutput(rawContent, config, ctx);`

6. **Update runWithHistory() method:**
   - Line 545-550: Replace context creation with `const ctx = createContext(metadata, onEvent);`
   - Line 557-569: Replace responseFormat with `const responseFormat = buildResponseFormat(config);`
   - Line 641-677: Replace parsing block with `const parsed = parseStructuredOutput(rawContent, config, ctx);`

7. **Update stream() method:**
   - Line 708-713: Replace context creation with `const ctx = createContext(metadata, onEvent);`
   - Line 720-732: Replace responseFormat with `const responseFormat = buildResponseFormat(config);`
   - Line 898-934: Replace parsing block with `const parsed = parseStructuredOutput(rawContent, config, ctx);`

### Type Definitions

Review `/home/markschaake/projects/schaake-agents/src/types.ts` for:
- `AgentConfig<I, O>` - Agent configuration interface
- `AgentContext` - Context interface with runId, metadata, logger, onEvent
- `AgentRunOptions` - Options including metadata and onEvent
- `ResponseFormat` - Response format type for JSON schema

Add `ResponseFormat` export if not already present.

---

## Acceptance Criteria

- [ ] `createContext()` helper function extracted with complete JSDoc
- [ ] `buildResponseFormat()` helper function extracted with complete JSDoc
- [ ] `parseStructuredOutput()` helper function extracted with complete JSDoc
- [ ] `run()` method refactored to use all three helpers
- [ ] `runWithHistory()` method refactored to use all three helpers
- [ ] `stream()` method refactored to use all three helpers
- [ ] No behavior changes - all existing tests pass
- [ ] All three helpers have proper TypeScript type annotations
- [ ] Helper functions are marked as `@internal` in JSDoc
- [ ] Total duplicated code reduced to near zero (~50 lines remaining for necessary variation)

---

## Agent Notes

_To be filled in during implementation_

---

## Progress Log

_To be filled in during implementation_
