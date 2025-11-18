# Task 006: Implement runWithHistory Method

## Task Metadata

| Field | Value |
|-------|-------|
| **Task ID** | 006 |
| **Wave** | 2 |
| **Estimated Duration** | 30 minutes |
| **Category** | API Enhancement |
| **Dependencies** | Task 007 (depends on this task) |
| **Status** | Pending |

---

## Objective

Add a `runWithHistory()` method to agents that returns comprehensive execution results including the final output, complete message history, and iteration count. This method complements the existing `run()` method, which continues to return only the output for backward compatibility.

---

## Context

### Requirement (FR-3: Message History Access)

From the specification:

> Return conversation history from run() method; Include all messages: system, user, assistant, tool; Provide iteration count and metadata; Support both simple (`run()`) and detailed (`runWithHistory()`) APIs

### Design Decision (Option B: Separate Method)

The specification recommends **Option B** for the following reasons:

- **Clearest API**: Distinct method names make intent obvious
- **Fully backward compatible**: Existing code using `run()` continues unchanged
- **No breaking changes**: Can be added independently without affecting existing users

**From design.md**:

```typescript
// Keep existing
const output = await agent.run(input);

// Add new method for full result
const { output, messages, iterations } = await agent.runWithHistory(input);
```

### Current State

The current `Agent` interface only defines:

```typescript
export interface Agent<I = unknown, O = unknown> {
  run(input: I, options?: AgentRunOptions): Promise<O>;
  // later: runStream(...)
}
```

The `createAgent()` function returns an agent with only the `run()` method. The internal implementation already maintains:
- Complete message history throughout the execution loop
- Iteration count via the loop index
- All execution context

These values are not exposed to the caller; only the final output is returned.

---

## Implementation Steps

### Step 1: Define the AgentRunResult Type

Add to `/home/markschaake/projects/schaake-agents/src/types.ts`:

```typescript
export interface AgentRunResult<O> {
  output: O;
  messages: Message[];
  iterations: number;
}
```

This type captures:
- `output`: The final output (same type as `run()` returns)
- `messages`: Complete message array including system, user, assistant, and tool messages
- `iterations`: Number of iterations executed (0-indexed loop count + 1)

**Notes**:
- The `messages` array is a snapshot at completion time
- System and initial user messages are included
- All intermediate tool calls and results are included
- This matches the design specification exactly

### Step 2: Update the Agent Interface

Modify `/home/markschaake/projects/schaake-agents/src/types.ts`:

Add the `runWithHistory` method to the `Agent` interface:

```typescript
export interface Agent<I = unknown, O = unknown> {
  run(input: I, options?: AgentRunOptions): Promise<O>;
  runWithHistory(input: I, options?: AgentRunOptions): Promise<AgentRunResult<O>>;
  // later: runStream(...)
}
```

### Step 3: Implement runWithHistory in createAgent

Modify `/home/markschaake/projects/schaake-agents/src/agent.ts`:

The `createAgent()` function should return an agent with both methods:

```typescript
export function createAgent<I = unknown, O = unknown>(
  config: AgentConfig<I, O>,
): Agent<I, O> {
  async function run(input: I, options: AgentRunOptions = {}): Promise<O> {
    // ... existing implementation unchanged ...
  }

  async function runWithHistory(
    input: I,
    options: AgentRunOptions = {},
  ): Promise<AgentRunResult<O>> {
    const { maxToolIterations = 4, metadata } = options;
    if (options.stream) {
      throw new Error("Streaming not implemented yet in createAgent.runWithHistory");
    }

    const ctx: AgentContext = {
      runId: crypto.randomUUID(),
      metadata,
      logger: metadata?.logger ?? undefined,
    };

    const messages = buildInitialMessages(config, input);
    const tools = config.tools ?? [];
    const chatTools = toChatTools(tools);

    // Generate responseFormat from outputSchema if provided
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

    let iterationCount = 0;

    for (let i = 0; i < maxToolIterations; i += 1) {
      iterationCount = i + 1;
      ctx.logger?.({
        type: "model_call",
        data: { iteration: i, messages, tools: !!chatTools },
      });

      const res = await config.model.provider.chat({
        model: config.model.model,
        messages,
        tools: chatTools,
        stream: false,
        temperature: config.model.temperature,
        maxTokens: config.model.maxTokens,
        metadata,
        responseFormat,
      });

      const assistantMsg = res.message;
      const toolCalls = assistantMsg.toolCalls;
      const finishReason = res.finishReason;

      // Add assistant message to history (with tool calls if present)
      messages.push({
        role: "assistant",
        content: assistantMsg.content ?? "",
        toolCalls: toolCalls,
      });

      ctx.logger?.({
        type: "model_call",
        data: {
          iteration: i,
          finishReason,
          hasToolCalls: !!toolCalls?.length,
          toolCallsCount: toolCalls?.length || 0,
        },
      });

      if (toolCalls && toolCalls.length > 0 && finishReason === "tool_calls") {
        const toolMessages = await runToolCalls(tools, toolCalls, ctx);
        messages.push(...toolMessages);
        continue;
      }

      // No tool calls – assume we're done
      const rawContent = assistantMsg.content ?? "";

      const parsed = config.outputSchema
        ? config.outputSchema.parse(
            (() => {
              try {
                return JSON.parse(rawContent);
              } catch (parseError) {
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
                    parseError: parseError instanceof Error ? parseError.message : String(parseError),
                  },
                });

                throw new Error(
                  `Failed to parse structured output as JSON. Raw content: ${rawContent.substring(0, 200)}${rawContent.length > 200 ? "..." : ""}`,
                );
              }
            })(),
          )
        : (rawContent as unknown as O);

      ctx.logger?.({ type: "final", data: { content: rawContent } });

      return {
        output: parsed,
        messages,
        iterations: iterationCount,
      };
    }

    throw new Error("Agent exceeded maxToolIterations without finishing");
  }

  return { run, runWithHistory };
}
```

**Implementation Notes**:
- Extract the core execution logic into a helper function (optional but recommended for DRY principle)
- Track iteration count explicitly: increment after each API call
- Return the same output value that would be returned by `run()`
- Include the complete `messages` array with all intermediate messages
- Both methods share the same core logic but differ in return type
- Error behavior is identical to `run()`

### Step 4: Export the New Type

Ensure `/home/markschaake/projects/schaake-agents/src/index.ts` exports the new type:

```typescript
export type { AgentRunResult } from "./types.js";
```

---

## Acceptance Criteria

### Functional Criteria

- [ ] `AgentRunResult<O>` type is defined in `src/types.ts` with fields: `output`, `messages`, `iterations`
- [ ] `Agent` interface includes `runWithHistory` method signature
- [ ] `createAgent()` returns agent with both `run()` and `runWithHistory()` methods
- [ ] `runWithHistory()` returns correct output value (identical to `run()`)
- [ ] `runWithHistory()` includes all system and user messages in history
- [ ] `runWithHistory()` includes all assistant messages with tool calls
- [ ] `runWithHistory()` includes all tool call messages and results
- [ ] Iteration count equals the number of API calls made (0-based loop iterations + 1)
- [ ] `AgentRunResult` is exported from `src/index.ts`

### Backward Compatibility

- [ ] Existing `run()` method signature is unchanged
- [ ] `run()` behavior is identical before and after implementation
- [ ] `run()` continues to return only output (type `O`)
- [ ] All existing tests continue to pass without modification

### Code Quality

- [ ] No TypeScript errors or warnings
- [ ] Code follows existing style conventions
- [ ] Type signatures are fully specified (no `any` types in public API)
- [ ] Comments clarify non-obvious logic

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `/home/markschaake/projects/schaake-agents/src/types.ts` | Add `AgentRunResult<O>` interface; Add `runWithHistory()` to `Agent` interface | Required |
| `/home/markschaake/projects/schaake-agents/src/agent.ts` | Implement `runWithHistory()` method in `createAgent()` | Required |
| `/home/markschaake/projects/schaake-agents/src/index.ts` | Export `AgentRunResult` type | Required |

---

## Testing Considerations

### Unit Test Suggestions

These tests should be created in `/home/markschaake/projects/schaake-agents/tests/agent.test.ts` (new file or expanded):

1. **Basic test without tools**
   - Call `runWithHistory()` with simple input
   - Verify output matches `run()`
   - Verify messages contains system and user messages
   - Verify iterations equals 1

2. **Test with single tool call**
   - Call `runWithHistory()` with input that triggers tool use
   - Verify output is correct
   - Verify messages includes: system, user, assistant (with toolCalls), tool response
   - Verify iterations equals 2

3. **Test with multiple tool iterations**
   - Call `runWithHistory()` with input triggering multiple tool chains
   - Verify all intermediate messages are captured
   - Verify iterations count matches the loop count

4. **Test error cases**
   - Verify `runWithHistory()` throws same errors as `run()`
   - Verify iteration count is correct even on error

5. **Backward compatibility**
   - Verify `run()` behavior unchanged
   - Verify both methods return same output value
   - Verify `run()` doesn't expose messages/iterations

---

## Related Tasks

- **Task 005**: Tool handler error handling (prerequisite for error message testing)
- **Task 007**: Stream method implementation (depends on this task's API patterns)

---

## Notes

### Design Rationale

- **Separate method vs. returning object**: Using `runWithHistory()` as separate method (Option B) is clearest and safest for backward compatibility
- **Iteration counting**: Count is number of API calls made; starts at 1 for single-pass agents
- **Message array**: Includes all intermediate messages to support debugging and auditing of agent reasoning

### Potential Future Enhancements

- Add optional `usage` field to `AgentRunResult` for token counting (deferred to future spec)
- Add `metadata` field for additional context (deferred to future spec)
- Support `stream` option in `runWithHistory()` (handled by Task 007)

### Edge Cases to Consider

- Empty tool response (should be `{}` not `undefined`)
- Model returning null content (converted to empty string)
- Maximum iterations exceeded (throw error, iteration count reflects partial execution)
