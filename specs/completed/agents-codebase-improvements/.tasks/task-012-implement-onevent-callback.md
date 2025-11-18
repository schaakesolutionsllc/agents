# Task 012: Implement onEvent Callback for Logging

## Task Metadata

| Field | Value |
|-------|-------|
| **ID** | 012 |
| **Name** | Implement onEvent callback for logging |
| **Wave** | 3 |
| **Category** | API/Logging |
| **Estimated Duration** | 30 minutes |
| **Dependencies** | 007 (AgentRunResult type definition) |
| **Status** | Pending |

## Objective

Add the `onEvent` callback option to `AgentRunOptions` and replace the indirect `metadata.logger` pattern with typed event callbacks. Define `AgentEvent` as a discriminated union with specific event types: `model_call`, `tool_call`, `tool_result`, `tool_error`, and `complete`.

This task implements **FR-6: Enhanced Logging API**, providing developers with a type-safe, event-driven logging mechanism that replaces the current ad-hoc `metadata.logger` pattern used throughout the agent execution loop.

## Context

### Functional Requirement

From **FR-6: Enhanced Logging API**:
- Add `onEvent` callback to run options
- Replace indirect `metadata.logger` pattern
- Type events properly with discriminated unions
- Allow developers to observe and react to agent lifecycle events

### Design Specification

From the design document, the event logging API should follow this structure:

```typescript
interface AgentRunOptions {
  stream?: boolean;
  maxToolIterations?: number;
  metadata?: Record<string, any>;
  onEvent?: (event: AgentEvent) => void;  // New
}

type AgentEvent =
  | { type: 'model_call'; iteration: number; messages: Message[] }
  | { type: 'tool_call'; name: string; args: any }
  | { type: 'tool_result'; name: string; result: any }
  | { type: 'tool_error'; name: string; error: string }
  | { type: 'complete'; output: any };
```

### Current Implementation Pattern

The current code uses an indirect `metadata.logger` pattern via `AgentContext`:

```typescript
// Current pattern in src/types.ts
export interface AgentContext {
  runId: string;
  metadata?: Record<string, any>;
  logger?: (event: AgentLogEvent) => void;
}

export type AgentLogEvent =
  | { type: "model_call"; data: any }
  | { type: "tool_call"; data: any }
  | { type: "tool_result"; data: any }
  | { type: "final"; data: any };
```

The current implementation has issues:
- `AgentLogEvent` uses generic `data` field instead of typed properties
- No distinction between `tool_result` and `tool_error`
- No `iteration` number for tracking multi-step chains
- Logging must be passed through context rather than as a direct option

### Event Types

The new `AgentEvent` discriminated union should provide:

1. **`model_call` event**
   - Fired when making a request to the LLM
   - Properties: `type`, `iteration`, `messages`
   - Purpose: Track what the model is being asked at each iteration

2. **`tool_call` event**
   - Fired when about to execute a tool
   - Properties: `type`, `name`, `args`
   - Purpose: Log tool invocations before execution

3. **`tool_result` event**
   - Fired when a tool succeeds
   - Properties: `type`, `name`, `result`
   - Purpose: Track successful tool outcomes

4. **`tool_error` event**
   - Fired when a tool fails
   - Properties: `type`, `name`, `error`
   - Purpose: Track tool execution failures
   - Triggered by: try-catch blocks around tool handler execution

5. **`complete` event**
   - Fired when agent run completes
   - Properties: `type`, `output`
   - Purpose: Final lifecycle event with the output

### Design Pattern: Discriminated Union

The `AgentEvent` type uses TypeScript's discriminated union pattern:
- Each event variant has a unique `type` field
- TypeScript's type narrowing automatically restricts available properties based on `type`
- This ensures type safety and IDE autocompletion

```typescript
// Example usage
onEvent((event) => {
  if (event.type === 'model_call') {
    // TypeScript knows event is { type: 'model_call'; iteration: number; messages: Message[] }
    console.log(`Model call at iteration ${event.iteration}`);
    console.log(`Messages count: ${event.messages.length}`);
  } else if (event.type === 'tool_error') {
    // TypeScript knows event is { type: 'tool_error'; name: string; error: string }
    console.error(`Tool ${event.name} failed: ${event.error}`);
  }
});
```

## Implementation Steps

### Step 1: Update Type Definitions (src/types.ts)

1. **Add `AgentEvent` discriminated union type** after the existing `AgentLogEvent`:
   ```typescript
   export type AgentEvent =
     | { type: 'model_call'; iteration: number; messages: Message[] }
     | { type: 'tool_call'; name: string; args: any }
     | { type: 'tool_result'; name: string; result: any }
     | { type: 'tool_error'; name: string; error: string }
     | { type: 'complete'; output: any };
   ```

2. **Update `AgentRunOptions` interface** to include the `onEvent` callback:
   ```typescript
   export interface AgentRunOptions {
     stream?: boolean;
     maxToolIterations?: number;
     metadata?: Record<string, any>;
     onEvent?: (event: AgentEvent) => void;  // New
   }
   ```

3. **Update `AgentContext` interface** to include the `onEvent` callback (for passing through to tool handlers):
   ```typescript
   export interface AgentContext {
     runId: string;
     metadata?: Record<string, any>;
     logger?: (event: AgentLogEvent) => void;  // Keep for backward compat
     onEvent?: (event: AgentEvent) => void;    // New
   }
   ```

4. **Add JSDoc comments** to document:
   - The purpose of the `onEvent` callback
   - The event types and when they're emitted
   - Example usage patterns
   - Event ordering guarantees

### Step 2: Update Agent Implementation (src/agent.ts)

1. **Import the new `AgentEvent` type** at the top of the file

2. **Pass `onEvent` from `AgentRunOptions` to `AgentContext`** in the `createAgent()` function:
   - When creating the context object, include the `onEvent` callback
   - Make the callback available to both the agent loop and tool execution

3. **Emit `model_call` event** before each LLM call in the main run loop:
   ```typescript
   ctx.onEvent?.({
     type: 'model_call',
     iteration: iterationCount,
     messages: messagesArray,
   });
   ```
   - Track the current iteration number
   - Include the complete message array being sent to the model

4. **Emit `tool_call` event** in `runToolCalls()` before executing each tool:
   ```typescript
   ctx.onEvent?.({
     type: 'tool_call',
     name: toolName,
     args: parsedArgs,
   });
   ```
   - Record the tool name and parsed arguments
   - Fire this before the handler execution (not after try-catch)

5. **Emit `tool_error` event** when tool execution fails (in try-catch):
   ```typescript
   try {
     result = await def.handler(args, ctx);
   } catch (error) {
     ctx.onEvent?.({
       type: 'tool_error',
       name,
       error: error instanceof Error ? error.message : String(error),
     });
     // ... existing error handling
   }
   ```
   - Extract error message from the caught exception
   - Fire before or alongside existing error handling

6. **Emit `tool_result` event** on successful tool execution:
   ```typescript
   ctx.onEvent?.({
     type: 'tool_result',
     name,
     result,
   });
   ```
   - Include the actual result object returned by the handler
   - Fire only on success (not on error)

7. **Emit `complete` event** at the end of `run()` method:
   ```typescript
   ctx.onEvent?.({
     type: 'complete',
     output: finalOutput,
   });
   ```
   - Include the final output value
   - Fire just before returning from the method

### Step 3: Maintain Backward Compatibility

1. **Keep `AgentContext.logger`** as-is for backward compatibility
   - Do not remove the existing `logger` field
   - Tool handlers may rely on it

2. **Keep `metadata` parameter** unchanged
   - Continue supporting metadata in AgentRunOptions

3. **Ensure existing code paths work** when `onEvent` is not provided
   - Use optional chaining: `ctx.onEvent?.(event)`
   - No side effects if callback is undefined

### Step 4: Update Tests

1. **Create tests for `onEvent` callback** in the existing test suite:
   - Verify `model_call` events are emitted at correct iterations
   - Verify `tool_call` events are emitted with correct name and args
   - Verify `tool_result` events are emitted on success
   - Verify `tool_error` events are emitted on failure
   - Verify `complete` event is emitted with final output
   - Verify event order is correct

2. **Test event ordering**:
   - model_call → tool_call → tool_result → model_call → ... → complete
   - Events should reflect the actual execution flow

3. **Test with and without callback**:
   - Agent should work normally when `onEvent` is not provided
   - Agent should work with `onEvent` callback specified

4. **Test error scenarios**:
   - Verify `tool_error` is emitted when handler throws
   - Verify agent continues execution after tool error
   - Verify error message is properly extracted

## Acceptance Criteria

- [ ] `AgentEvent` discriminated union type is defined in `src/types.ts` with all 5 event types
- [ ] `AgentRunOptions.onEvent` callback property is added and properly typed
- [ ] `AgentContext` includes the `onEvent` callback for passing to tool handlers
- [ ] `model_call` events are emitted before each LLM call with iteration number and messages
- [ ] `tool_call` events are emitted before tool execution with name and arguments
- [ ] `tool_result` events are emitted after successful tool execution with result
- [ ] `tool_error` events are emitted when tool handler throws with error message
- [ ] `complete` event is emitted at end of run with final output
- [ ] All events use the `AgentEvent` discriminated union type with proper type narrowing
- [ ] Optional chaining is used: `ctx.onEvent?.(event)` - no errors when callback is undefined
- [ ] Backward compatibility maintained: existing code works without providing `onEvent`
- [ ] Existing `AgentContext.logger` continues to work for backward compatibility
- [ ] Event ordering is correct and matches execution flow
- [ ] JSDoc comments explain the callback purpose and event types
- [ ] All existing tests continue to pass
- [ ] New tests cover: basic events, event ordering, error events, optional callback
- [ ] TypeScript compilation succeeds with no new errors
- [ ] Code follows existing style conventions in src/agent.ts and src/types.ts

## Technical Details

### Iteration Tracking

The `model_call` event includes an iteration number to track multi-step agent loops:
- Iteration 0: Initial request to model
- Iteration 1: First tool call + follow-up to model
- Iteration 2: Second tool call + follow-up to model
- etc.

This allows logging systems to understand the flow of the conversation.

### Error Message Extraction

The `tool_error` event must safely extract the error message:
```typescript
const errorMessage = error instanceof Error ? error.message : String(error);
ctx.onEvent?.({
  type: 'tool_error',
  name,
  error: errorMessage,
});
```

This handles different error types:
- Error objects: use `.message` property
- Other values: convert to string

### Discriminated Union Benefits

Using a discriminated union with `type` field provides:

1. **Type Safety**: TypeScript narrows types based on the `type` field
2. **IDE Support**: Autocompletion shows only relevant properties for each event type
3. **Exhaustiveness Checking**: Switch statements can be checked for completeness

```typescript
// Good: TypeScript ensures all event types are handled
switch(event.type) {
  case 'model_call':
    console.log(event.iteration);  // TypeScript knows this exists
    break;
  case 'tool_call':
    console.log(event.args);  // TypeScript knows this exists
    break;
  // ... other cases
}
```

### Event Callback Guidelines

- **Non-blocking**: `onEvent` callback should not be async (or be handled as fire-and-forget)
- **Side-effects only**: Callback should log/observe, not modify state
- **Error handling**: Errors in callback should not crash agent execution (consider try-catch)
- **Performance**: Heavy logging may impact performance; encourage sampling for high-frequency events

## Files to Modify

1. **`src/types.ts`**
   - Add `AgentEvent` discriminated union type definition
   - Update `AgentRunOptions` interface to include `onEvent` callback
   - Update `AgentContext` interface to include `onEvent` callback
   - Add JSDoc comments

2. **`src/agent.ts`**
   - Import `AgentEvent` type
   - Pass `onEvent` from options to context in `createAgent()`
   - Emit `model_call` event before LLM calls
   - Emit `tool_call` event before tool execution
   - Emit `tool_error` event when tool handler throws
   - Emit `tool_result` event after successful tool execution
   - Emit `complete` event before returning final result

3. **`tests/agent.test.ts`** (or existing test file)
   - Add tests for `onEvent` callback functionality
   - Test all event types are emitted correctly
   - Test event ordering
   - Test with and without callback
   - Test error scenarios

## Additional Notes

### Relationship to Dependency (Task 007)

Task 007 defined the `AgentRunResult<O>` type. This task extends the API by:
- Adding event-driven logging via `onEvent`
- Complementing the history-access API from Task 007
- Providing real-time observability alongside historical access

### Future Enhancements

This implementation lays groundwork for:
- Streaming API (Wave 3): Events can be streamed to users in real-time
- Observability/tracing: Events can be sent to external systems
- Debugging tools: Events can be replayed for debugging
- Metrics collection: Event counts/timing can be tracked

### Logging Best Practices

Developers using this callback might implement:

```typescript
const events: AgentEvent[] = [];
await agent.run(input, {
  onEvent: (event) => {
    events.push(event);
  },
});

// Analyze execution flow
const modelCalls = events.filter(e => e.type === 'model_call').length;
const toolErrors = events.filter(e => e.type === 'tool_error').length;
console.log(`Completed in ${modelCalls} model calls with ${toolErrors} errors`);
```

## References

- **Requirements**: FR-6 (Enhanced Logging API)
- **Design Section**: API Design → Event Logging API
- **Related Task**: Task 007 (AgentRunResult type definition)
- **Files**: `src/types.ts`, `src/agent.ts`
- **TypeScript**: Discriminated Unions documentation
