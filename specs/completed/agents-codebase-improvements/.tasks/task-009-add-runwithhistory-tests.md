# Task 009: Add runWithHistory Tests

**Task ID**: 009
**Wave**: 3
**Category**: test
**Estimated Duration**: 20 minutes

---

## Task Metadata

- **Name**: Add runWithHistory tests
- **Dependencies**: Task 006 (must be completed first - implements runWithHistory method)
- **Related Files**:
  - `tests/agent.test.ts` (file to create/modify)
  - `src/agent.ts` (reference for understanding implementation)
  - `src/types.ts` (reference for type definitions)
- **Test Coverage Target**: Comprehensive coverage of runWithHistory functionality

---

## Objective

Create comprehensive tests for the `runWithHistory()` method that verify it returns complete message history after agent execution, including all tool calls, tool results, and accurately tracking iteration count. These tests validate that developers can access the full conversation history for debugging and introspection.

---

## Context

### What is runWithHistory?

The `runWithHistory()` method is an API enhancement that allows developers to access the complete conversation history after an agent run completes. Unlike `run()` which returns only the final output, `runWithHistory()` returns a structured result containing:

- **output**: The final parsed/processed output (same as `run()`)
- **messages**: Full array of all messages in the conversation
- **iterations**: Count of how many iterations the agent went through

### Why This Matters (User Story US-2: Debugging Agent Behavior)

From requirements:
> "As a developer debugging agent issues, I want to access the full conversation history after a run, So that I can understand the agent's reasoning and identify problems"

### Design Reference

From design.md, the `runWithHistory()` method follows Option B (Separate Method) for backward compatibility:

```typescript
// Keep existing simple API
const output = await agent.run(input);

// Add new method for full result
const { output, messages, iterations } = await agent.runWithHistory(input);
```

### Acceptance Criteria

From requirements, AC: `runWithHistory()` returns full message array after completion

The implementation must:
1. Return full message history (system, user, assistant, tool messages)
2. Include all tool calls in the messages array
3. Include all tool results in the messages array
4. Track iteration count correctly (number of times model was called)
5. Return structured result with `output`, `messages`, and `iterations` properties

### Type Definitions

The runWithHistory method returns `AgentRunResult<O>` defined in types.ts:

```typescript
interface AgentRunResult<O> {
  output: O;
  messages: Message[];
  iterations: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

## Current State

### What Exists

- `src/agent.ts` contains the `createAgent` function and `run()` method
- Test file `tests/openrouter.test.ts` exists showing Vitest patterns
- Mock infrastructure is in place for testing

### What's Missing

- `tests/agent.test.ts` does not exist or does not have `runWithHistory` tests
- `runWithHistory` method may not be implemented in agent.ts yet (Task 006 dependency)

### Testing Patterns to Follow

From existing tests in `tests/openrouter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.mock() for module mocking
// Use beforeEach to reset mocks between tests
// Use expect() with standard assertions
// Test both success and error cases
```

---

## Implementation Steps

### Step 1: Verify runWithHistory Implementation (Dependency Check)

1. Open `/home/markschaake/projects/schaake-agents/src/agent.ts`
2. Check if `runWithHistory` method exists on the Agent interface
3. Check if it's implemented in the createAgent function
4. If missing, note this blocks the test implementation (Task 006 dependency)

### Step 2: Create/Open Test File

1. Create or open `/home/markschaake/projects/schaake-agents/tests/agent.test.ts`
2. Set up test structure with necessary imports:
   - `describe`, `it`, `expect`, `vi`, `beforeEach` from vitest
   - `createAgent` from `../src/agent.js`
   - Mock utilities (copy pattern from openrouter.test.ts)

### Step 3: Set Up Mock Infrastructure

1. Mock the `OpenRouterProvider` using `vi.mock()`
2. Create a mock `mockSend` function to simulate API responses
3. Set up `beforeEach` hook to:
   - Clear all mocks with `vi.clearAllMocks()`
   - Create a fresh provider instance with test API key

### Step 4: Test Basic runWithHistory Execution

**Test: "should return full message history"**

1. Create an agent with system prompt and a simple input
2. Mock OpenRouter API to return a single non-tool response
3. Call `agent.runWithHistory(input)`
4. Verify the returned result has structure: `{ output, messages, iterations }`
5. Verify `messages` includes:
   - System message (if system prompt provided)
   - User message (input message)
   - Assistant message (model response)
6. Verify `output` matches the returned content
7. Verify `iterations` equals 1 (single model call)

### Step 5: Test Tool Calls and Results Inclusion

**Test: "should include all tool calls and results"**

1. Create an agent with one or more tools defined
2. Mock OpenRouter API to return:
   - First response: tool call(s)
   - Second response: final content (after tool execution)
3. Call `agent.runWithHistory(input)`
4. Verify `messages` includes:
   - Assistant message with `toolCalls` array
   - Tool result message(s) for each tool call
5. Verify tool messages have:
   - Correct `role: "tool"`
   - Correct `toolCallId` matching the tool call
   - Tool result content as JSON
6. Verify order of messages is correct (assistant → tool result → assistant)

### Step 6: Test Iteration Count Tracking

**Test: "should track iteration count"**

1. Create an agent with tools
2. Mock OpenRouter API responses to simulate multi-turn conversation:
   - Iteration 1: Tool call A
   - Iteration 2: Tool call B
   - Iteration 3: Final response
3. Call `agent.runWithHistory(input)`
4. Verify `iterations` equals 3 (three model calls)
5. Verify each iteration added exactly one assistant message to the history

### Step 7: Test Message Ordering and Completeness

**Test: "should maintain correct message ordering"** (optional but recommended)

1. Create agent with tools
2. Simulate complex multi-turn interaction
3. Verify `messages` array maintains chronological order
4. Verify no messages are lost or duplicated

### Step 8: Edge Cases (Optional but Recommended)

Consider adding tests for:
- Tool execution that fails (error handling)
- Tool results with complex JSON structures
- Very long message histories
- Structured output (JSON schema) with runWithHistory

---

## Acceptance Criteria

### Test Implementation Complete When:

- [ ] Test file exists at `/home/markschaake/projects/schaake-agents/tests/agent.test.ts`
- [ ] At least 3 test cases exist for runWithHistory:
  - [ ] "should return full message history"
  - [ ] "should include all tool calls and results"
  - [ ] "should track iteration count"
- [ ] All tests pass with `npm test`
- [ ] Tests verify the following properties:
  - [ ] Result has `output` property with correct value
  - [ ] Result has `messages` property as an array
  - [ ] Result has `iterations` property as a number
  - [ ] Messages array contains all types: system, user, assistant, tool
  - [ ] Assistant messages with tool calls have `toolCalls` property populated
  - [ ] Tool result messages have correct `toolCallId` and `content`
  - [ ] Iterations count matches number of model API calls
- [ ] Tests follow existing code patterns from `tests/openrouter.test.ts`
- [ ] Mock setup properly isolates the tests from real API calls
- [ ] Test descriptions are clear and aligned with design specification
- [ ] No console errors or warnings during test execution

---

## Implementation Notes

### Key Considerations

1. **Dependency**: Task 006 must be completed first (implements runWithHistory)
2. **Mock Pattern**: Use Vitest mocks like in openrouter.test.ts
3. **Message Structure**: Understand the Message interface carefully:
   ```typescript
   interface Message {
     role: Role; // "system" | "user" | "assistant" | "tool"
     content: string | null;
     name?: string;
     toolCallId?: string; // For tool messages
     toolCalls?: ChatToolCall[]; // For assistant messages
   }
   ```
4. **Tool Call Format**: Tool calls have structure:
   ```typescript
   {
     id: string;
     type: "function";
     function: { name: string; arguments: string; }
   }
   ```
5. **Response Format**: runWithHistory returns:
   ```typescript
   {
     output: O;
     messages: Message[];
     iterations: number;
     usage?: { promptTokens, completionTokens, totalTokens };
   }
   ```

### Files to Modify

- **Create or Modify**: `/home/markschaake/projects/schaake-agents/tests/agent.test.ts`
  - Add describe block for runWithHistory
  - Add comprehensive test cases
  - Follow Vitest patterns from existing tests

### Files to Reference (Do Not Modify)

- `/home/markschaake/projects/schaake-agents/src/agent.ts` - Reference only
- `/home/markschaake/projects/schaake-agents/src/types.ts` - Reference only
- `/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts` - Reference patterns
- `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/requirements.md` - Requirements reference
- `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/design.md` - Design reference

---

## Testing Command

After implementing the tests, run:

```bash
npm test -- tests/agent.test.ts
```

Or to run all tests:

```bash
npm test
```

All existing tests must continue to pass (backward compatibility).

---

## Success Metrics

- Test file created with comprehensive runWithHistory test cases
- All tests pass consistently
- Test coverage for runWithHistory methods is >80%
- Message history accurately reflects all agent interactions
- Iteration count correctly reflects number of model calls
- Tool calls and results properly included in message history

---

## Related Documentation

- **User Story**: US-2 (Debugging Agent Behavior)
- **Functional Requirement**: FR-3 (Message History Access)
- **Acceptance Criteria**: "runWithHistory() returns full message array after completion"
- **Design Section**: API Design - Option B (Separate Method)
- **Testing Strategy**: From design.md lines 353-374

