# Task 011: Add Streaming Type Definitions

**Task ID**: 011
**Wave**: 1
**Estimated Duration**: 15 minutes
**Category**: Model Type Definitions
**Status**: Not Started

---

## Overview

Add TypeScript type definitions for the streaming API to support real-time agent response streaming. This task introduces `StreamChunk` and `AgentStream` interfaces that enable developers to consume agent responses as they're being generated, including intermediate tool calls and results.

---

## Objectives

1. Define `StreamChunk` as a discriminated union type with four variants: `content`, `tool_call`, `tool_result`, and `done`
2. Create `AgentStream<O>` interface that supports async iteration and provides a `finalResult()` method
3. Add new interfaces to `src/types.ts` to support streaming workflows
4. Ensure types are properly exported in `src/index.ts`

---

## Context

### From Functional Requirements (FR-4: Streaming Support)

From requirements.md:
> Implement `stream()` method on agents. Accumulate deltas into complete messages. Provide `finalResult()` to get history after streaming. Support tool calling during streaming.

### From Design Specification

The design document specifies the streaming API contract:

```typescript
interface StreamChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'done';
  content?: string;
  toolCall?: ChatToolCall;
  toolResult?: { name: string; result: any };
}

interface AgentStream<O> {
  [Symbol.asyncIterator](): AsyncIterator<StreamChunk>;
  finalResult(): Promise<AgentRunResult<O>>;
}
```

### Related Types

These types already exist and are relevant:
- `ChatToolCall` - Tool invocation with id, type, function name, and arguments
- `Message` - Conversation message with role and content
- `AgentRunResult<O>` - Return type with output, messages, iterations, and usage stats

### Usage Context

Streaming will be used like this:
```typescript
const stream = agent.stream(input);

for await (const chunk of stream) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'tool_call') {
    console.log(`Calling tool: ${chunk.toolCall?.function.name}`);
  }
}

const { output, messages } = await stream.finalResult();
```

---

## Implementation Steps

### Step 1: Review Existing Types

- [x] Review current type definitions in `src/types.ts`
- [x] Confirm `ChatToolCall`, `Message`, and `AgentRunResult` are available
- [x] Verify export structure in `src/types.ts`

### Step 2: Define StreamChunk Discriminated Union

Add the `StreamChunk` type to `src/types.ts` after the `AgentRunResult` definition:

```typescript
export type StreamChunk =
  | { type: 'content'; content: string }
  | { type: 'tool_call'; toolCall: ChatToolCall }
  | { type: 'tool_result'; toolResult: { name: string; result: any } }
  | { type: 'done' };
```

**Rationale**: Discriminated union ensures type safety - consumers can use type guards to access the correct properties based on the `type` field.

### Step 3: Define AgentStream Interface

Add the `AgentStream` interface to `src/types.ts`:

```typescript
export interface AgentStream<O> {
  /**
   * Implements AsyncIterable protocol for consuming stream chunks
   * Yields StreamChunk events as the agent processes the request
   */
  [Symbol.asyncIterator](): AsyncIterator<StreamChunk>;

  /**
   * Get the final result after streaming completes
   * Can only be called after the stream has fully consumed (after receiving 'done' chunk)
   * @returns Promise resolving to complete agent run result with output and history
   */
  finalResult(): Promise<AgentRunResult<O>>;
}
```

### Step 4: Verify Exports

- Confirm `StreamChunk` is exported from `src/types.ts`
- Confirm `AgentStream` is exported from `src/types.ts`
- Check if `src/index.ts` re-exports types from `src/types.ts` and verify new types are available

### Step 5: TypeScript Validation

Run TypeScript compiler to ensure:
- No type errors in type definitions
- All properties are correctly typed
- Discriminated union works properly
- No circular type dependencies

---

## Files to Modify

### Primary
- `/home/markschaake/projects/schaake-agents/src/types.ts` - Add `StreamChunk` and `AgentStream` types

### Secondary (Verify)
- `/home/markschaake/projects/schaake-agents/src/index.ts` - Ensure new types are exported (may not need changes if using wildcard export)

---

## Type Definitions Reference

### StreamChunk Type (Discriminated Union)

The `StreamChunk` type represents a single unit of data emitted during streaming. It's a discriminated union with four variants:

1. **`{ type: 'content'; content: string }`**
   - Represents streamed text content from the model
   - `content` is the text delta (may be partial tokens)
   - Most frequent event type during response generation

2. **`{ type: 'tool_call'; toolCall: ChatToolCall }`**
   - Represents a tool invocation call from the model
   - `toolCall` includes id, type, function name, and JSON arguments
   - Indicates the agent should execute the tool

3. **`{ type: 'tool_result'; toolResult: { name: string; result: any } }`**
   - Represents the result of a tool execution
   - `name` is the tool name that was executed
   - `result` is the tool's return value
   - Emitted after tool handler completes

4. **`{ type: 'done' }`**
   - Terminal event indicating stream completion
   - No additional data
   - Safe point to call `finalResult()`

### AgentStream<O> Interface

The `AgentStream<O>` interface is a generic type that wraps streaming functionality:

- **Generic Parameter `<O>`**: The output type of the agent (matches agent's output schema)
- **AsyncIterable Protocol**: Implements `[Symbol.asyncIterator]()` to support `for await...of` loops
- **finalResult() Method**: Returns a Promise that resolves to `AgentRunResult<O>`, containing the complete message history and final output

---

## Acceptance Criteria

- [ ] `StreamChunk` type is defined as a discriminated union with four variants
- [ ] `StreamChunk` type variants have correct structure:
  - `{ type: 'content'; content: string }`
  - `{ type: 'tool_call'; toolCall: ChatToolCall }`
  - `{ type: 'tool_result'; toolResult: { name: string; result: any } }`
  - `{ type: 'done' }`
- [ ] `AgentStream<O>` interface is defined with correct generic
- [ ] `AgentStream<O>` has `[Symbol.asyncIterator]()` returning `AsyncIterator<StreamChunk>`
- [ ] `AgentStream<O>` has `finalResult()` returning `Promise<AgentRunResult<O>>`
- [ ] Types are exported from `src/types.ts`
- [ ] TypeScript compiler passes with no errors (run `npm run type-check`)
- [ ] Types can be imported and used in consuming code

---

## Verification Steps

After implementation, verify:

1. **Syntax Check**: File contains valid TypeScript with no red squiggles in IDE
2. **Type Checking**: Run `npm run type-check` - should pass with no errors
3. **Discriminated Union**: Create test usage showing type narrowing works:
   ```typescript
   const chunk: StreamChunk = /* ... */;
   if (chunk.type === 'content') {
     // TypeScript should know chunk has .content property
     const text = chunk.content; // OK
   } else if (chunk.type === 'tool_call') {
     // TypeScript should know chunk has .toolCall property
     const call = chunk.toolCall; // OK
   }
   ```
4. **AsyncIterator**: Verify type matches AsyncIterable protocol
5. **Exports**: Confirm new types appear in `src/index.ts` exports or auto-export via wildcard

---

## Dependencies

- **Task 001**: Message history support (not blocking - types are independent)
- **Task 002**: API key validation (not blocking)
- **Task 003**: Tool error handling (not blocking - types are independent)

This task has no blocking dependencies and can be implemented immediately.

---

## Implementation Notes

### Design Decisions

1. **Discriminated Union over Type Union**: Using `type: 'content' | 'tool_call' | ...` allows TypeScript to narrow the type based on the `type` field, preventing runtime errors.

2. **Generic Parameter on AgentStream**: `AgentStream<O>` is generic to match the agent's output type, enabling proper typing of `finalResult()`.

3. **Result Type as `any` on tool_result**: The `result` property is typed as `any` because tool handlers return arbitrary values that depend on the specific tool. This is unavoidable without complex generic tracking.

4. **Separate Interface for Result**: `toolResult` is `{ name: string; result: any }` rather than a reference to the original tool definition, because the result is computed at runtime.

### Edge Cases

- **Empty content chunks**: Allowed - some streaming implementations may emit empty strings
- **Multiple chunks before tool call**: Common - content may be streamed incrementally
- **Tool result with undefined**: Tool handlers may return `undefined` - `result` property can be `undefined`

---

## Related Tasks

- **Task 012**: Implement `stream()` method on Agent class
- **Task 013**: Add streaming integration tests
- **Task 010**: Add `AgentRunResult` type (prerequisite - should already exist)

---

## References

- Requirements: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/requirements.md` - FR-4
- Design: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/design.md` - Streaming API section
- Current Types: `/home/markschaake/projects/schaake-agents/src/types.ts`
