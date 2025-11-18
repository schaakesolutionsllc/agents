# Task 013: Add Streaming Integration Tests

## Task Metadata

| Field | Value |
|-------|-------|
| **Task ID** | 013 |
| **Task Name** | Add streaming integration tests |
| **Wave** | 4 |
| **Category** | test |
| **Estimated Duration** | 30 minutes |
| **Dependencies** | [Task 010: Implement Agent.stream() method](./task-010-implement-agent-stream-method.md) |
| **Files to Modify** | `tests/agent.test.ts` |

---

## Objective

Add comprehensive integration tests for the streaming API to verify that:

1. Basic streaming works correctly - the agent can stream responses to the user in real-time
2. Streaming works with tool calls - the agent can execute tools during streaming and continue streaming after tool results
3. The `finalResult()` method returns the complete conversation history after streaming completes
4. Error handling works correctly during streaming operations

These tests ensure the streaming functionality is production-ready and handles both happy-path and error cases.

---

## Context

### From Requirements

**Functional Requirement FR-4: Streaming Support**
- Implement `stream()` method on agents
- Accumulate deltas into complete messages
- Provide `finalResult()` to get history after streaming
- Support tool calling during streaming

**Acceptance Criteria**
- [ ] `stream()` method works with tool-calling agents
- [ ] Integration tests cover basic run, tool calling, multi-step, and errors

### From Design Document

**Streaming API Design**

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

// Usage
const stream = agent.stream(input);

for await (const chunk of stream) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
}

const { output, messages } = await stream.finalResult();
```

**Workflow: Streaming with Tool Calls**

```
User → Agent.stream(input)
  → Provider.chatStream()
    → [Content chunks] → StreamChunk(content)
    → Tool call → StreamChunk(tool_call)
    → Tool execution
    → StreamChunk(tool_result)
    → Continue streaming
    → [More content chunks] → StreamChunk(content)
    → Done → StreamChunk(done)
  → finalResult() → { output, messages }
```

### Related Test Coverage Areas

The integration tests in `tests/agent.test.ts` should include:

```typescript
describe('createAgent', () => {
  describe('stream', () => {
    it('should stream basic response content');
    it('should emit tool calls during streaming');
    it('should execute tools during streaming');
    it('should emit tool results as chunks');
    it('should continue streaming after tool execution');
    it('should provide finalResult() with complete history');
    it('should handle tool execution errors gracefully');
    it('should emit done chunk when stream completes');
  });
});
```

---

## Implementation Steps

### Step 1: Set Up Test Fixtures for Streaming Responses

**Location**: `tests/fixtures/mocks.ts` (if not already present)

- Create mock streaming responses that emit content chunks
- Create mock tool call responses during streaming
- Create mock tool result handling

Key scenarios to mock:
1. Simple content-only response
2. Tool call with arguments in streaming format
3. Multi-iteration tool chain during streaming
4. Error responses during streaming

### Step 2: Add Basic Streaming Tests

**Location**: `tests/agent.test.ts`

Add test group `describe('stream', () => { ... })` with tests for:

1. **Basic Streaming Without Tools**
   - Verify `agent.stream(input)` returns an async iterable
   - Verify chunks are emitted as content is streamed
   - Verify chunk type is 'content' for text responses
   - Verify streaming completes with a 'done' chunk

2. **finalResult() Returns Complete History**
   - After streaming completes, call `stream.finalResult()`
   - Verify it returns `AgentRunResult<O>` with output, messages array, and iteration count
   - Verify messages include all chunks (system, user, assistant, tool)
   - Verify usage stats are populated if available

### Step 3: Add Tool Calling During Streaming Tests

**Location**: `tests/agent.test.ts`

Add tests for:

1. **Tool Call Detection in Stream**
   - Stream response that includes a tool call
   - Verify a chunk with type 'tool_call' is emitted
   - Verify the chunk includes the tool call details (name, arguments, ID)

2. **Tool Execution During Streaming**
   - Verify the agent executes the tool when a tool call is detected
   - Verify a chunk with type 'tool_result' is emitted with the result
   - Verify streaming continues after tool execution

3. **Multi-Step Tool Chains in Streaming**
   - Agent needs to call multiple tools in sequence during streaming
   - Verify each tool call and result is properly chunked
   - Verify the stream continues until all tool calls are resolved

### Step 4: Add Error Handling Tests

**Location**: `tests/agent.test.ts`

Add tests for:

1. **Tool Handler Exception During Streaming**
   - Tool handler throws an exception
   - Verify the error is caught (not crashes the stream)
   - Verify an error message is sent to the model as a tool result
   - Verify streaming continues after the error

2. **Invalid JSON Parsing During Streaming**
   - Model returns invalid tool call arguments
   - Verify error is handled gracefully
   - Verify appropriate error chunk or result is emitted

3. **Stream Interruption**
   - Verify stream can be stopped/interrupted mid-execution
   - Verify `finalResult()` still returns accumulated state

### Step 5: Verify Test Coverage and Edge Cases

**Location**: `tests/agent.test.ts`

Ensure the test suite covers:

- [ ] Streaming with no tool calls
- [ ] Streaming with single tool call
- [ ] Streaming with multiple sequential tool calls
- [ ] Streaming with tool handler errors
- [ ] Streaming with JSON parsing errors
- [ ] Streaming completion state
- [ ] `finalResult()` called before streaming completes (should wait)
- [ ] Multiple iterations properly tracked
- [ ] All chunk types emitted correctly
- [ ] Message history is complete and accurate

---

## Acceptance Criteria

The task is complete when:

1. **Basic Streaming Tests Pass**
   - [ ] `agent.stream(input)` returns an async iterable
   - [ ] Content chunks are emitted with type 'content'
   - [ ] Streaming completes with type 'done' chunk
   - [ ] Test: "should stream basic response content" passes

2. **Tool Calling Tests Pass**
   - [ ] Tool calls are detected and emitted as type 'tool_call' chunks
   - [ ] Tools are executed during streaming
   - [ ] Tool results are emitted as type 'tool_result' chunks
   - [ ] Multi-step tool chains work correctly
   - [ ] Tests: "should emit tool calls during streaming", "should execute tools during streaming", "should emit tool results as chunks" pass

3. **finalResult() Tests Pass**
   - [ ] `stream.finalResult()` returns complete `AgentRunResult<O>`
   - [ ] Messages array includes all conversation messages
   - [ ] Iteration count is accurate
   - [ ] Usage stats are populated when available
   - [ ] Test: "should provide finalResult() with complete history" passes

4. **Error Handling Tests Pass**
   - [ ] Tool handler exceptions are caught during streaming
   - [ ] Errors are reported as tool results to the model
   - [ ] Streaming continues after errors
   - [ ] Test: "should handle tool execution errors gracefully" passes

5. **All Tests Pass**
   - [ ] All new streaming tests pass with no failures
   - [ ] No regressions in existing tests
   - [ ] Test coverage for `agent.ts` remains above 80%

6. **Code Quality**
   - [ ] Tests follow existing test file conventions
   - [ ] Tests are well-documented with descriptive names
   - [ ] Test assertions clearly verify expected behavior
   - [ ] No console errors or warnings during test execution

---

## Files to Modify

### Primary File

**`/home/markschaake/projects/schaake-agents/tests/agent.test.ts`**

- Add streaming test group with comprehensive test cases
- Ensure consistency with existing test structure
- Use the existing mock/fixture patterns

### Supporting Files (if needed)

**`/home/markschaake/projects/schaake-agents/tests/fixtures/mocks.ts`** (if not present)

- Add streaming response mocks
- Add tool call mocks for streaming scenarios
- Add error scenario mocks

---

## Testing Approach

### Test Framework

- **Framework**: Vitest (matches existing test setup)
- **Mocking**: Vitest built-in mocks and `vi.mock()` utilities
- **Assertions**: Standard `expect()` assertions

### Mock Strategy

Mock the LLMProvider's `chatStream()` method to return:

1. **Sequence of streaming responses** that simulate OpenRouter streaming API
2. **Tool call detection** within the stream
3. **Error scenarios** by throwing or returning error states

### Test Data

Use test agents with:
- Simple prompt-only runs (no tools)
- Tool-enabled agents with various tool configurations
- Error scenarios (bad tool handlers, invalid responses)

---

## Implementation Notes

### Key Considerations

1. **Async Iteration**: The stream implementation uses `Symbol.asyncIterator`, so tests must use `for await` loops or collect chunks into arrays

2. **Streaming Protocol**: OpenRouter follows OpenAI's SSE format:
   - Content arrives in chunks as `delta.content`
   - Tool calls arrive as complete messages with `tool_calls` array
   - Stream ends with `[DONE]` marker

3. **Tool Execution During Streaming**:
   - Tools must be executed as they're discovered
   - Results are sent back to the model for continued streaming
   - This requires proper async/await handling in the loop

4. **finalResult() Behavior**:
   - Should accumulate all chunks into a final message history
   - Should return structured `AgentRunResult<O>` with metadata
   - May need to wait for stream to complete if called early

5. **Error Propagation**:
   - Errors should not crash the stream iterator
   - Tool execution errors should be reported to the model
   - Stream should emit appropriate error information to the user

### Common Pitfalls to Avoid

- Don't assume streaming is synchronous - all chunks arrive asynchronously
- Don't forget to mock the provider's `chatStream` method (not just `chat`)
- Don't test with real API calls - always use mocks for deterministic tests
- Don't forget to test `finalResult()` - it's critical for accessing full history
- Don't forget error cases - they're often missed in happy-path testing

---

## References

### Related Tasks

- **Task 010**: [Implement Agent.stream() method](./task-010-implement-agent-stream-method.md) - This task depends on successful streaming implementation
- **Task 001**: [Implement tool handler error catching](./task-001-implement-tool-handler-error-catching.md) - Error handling context
- **Task 003**: [Create basic integration test suite](./task-003-create-basic-integration-test-suite.md) - Test patterns reference

### Documentation

- **Requirements**: Functional Requirement FR-4 (Streaming Support)
- **Design**: Section "Workflow 2: Streaming with Tool Calls"
- **API Design**: Streaming API section with interface definitions

### External References

- [OpenRouter Streaming Documentation](https://openrouter.ai/docs)
- [OpenAI Function Calling with Streaming](https://platform.openai.com/docs/guides/function-calling)
- [Vitest Testing Framework Docs](https://vitest.dev/)
