# Task 010: Implement Streaming Support with Stream Method

## Task Metadata

- **Task ID**: 010
- **Name**: Implement streaming support with stream method
- **Wave**: 3
- **Estimated Duration**: 45m
- **Category**: API Implementation
- **Dependencies**: [011 - Add streaming type definitions](./task-011-add-streaming-type-definitions.md)
- **Status**: Pending

---

## Objective

Implement a `stream()` method on the Agent class that returns an AsyncIterable of StreamChunk objects. The implementation must:

1. Accumulate streaming deltas into complete messages
2. Support tool calling during streaming (executing tools and sending results back to the model)
3. Provide a `finalResult()` method to retrieve complete conversation history after streaming
4. Follow the same error handling and message history patterns established in previous tasks
5. Maintain backward compatibility with existing `run()` and `runWithHistory()` methods

---

## Context

### Functional Requirements (FR-4)

**FR-4: Streaming Support**
- Implement `stream()` method on agents
- Accumulate deltas into complete messages
- Provide `finalResult()` to get history after streaming
- Support tool calling during streaming

Reference: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/requirements.md` (lines 67-71)

### Design Specification

#### StreamChunk Interface

The following types are already defined in task 011 and should be available:

```typescript
interface StreamChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'done';
  content?: string;           // For 'content' chunks
  toolCall?: ChatToolCall;    // For 'tool_call' chunks
  toolResult?: {              // For 'tool_result' chunks
    name: string;
    result: any;
  };
}
```

#### AgentStream Interface

The following interface is defined in task 011 and should be available:

```typescript
interface AgentStream<O> {
  [Symbol.asyncIterator](): AsyncIterator<StreamChunk>;
  finalResult(): Promise<AgentRunResult<O>>;
}
```

#### Streaming Usage Pattern

```typescript
const stream = agent.stream(input);

for await (const chunk of stream) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'tool_call') {
    console.log(`Tool called: ${chunk.toolCall.function.name}`);
  }
}

const { output, messages } = await stream.finalResult();
```

### Related Workflows

**Workflow 2: Streaming with Tool Calls** (from design.md)

The streaming flow must handle:

1. **Initial stream start**: User calls `agent.stream(input)`
2. **Content streaming**: Provider sends content chunks → Agent emits StreamChunk(content)
3. **Tool calls**: Provider sends tool call → Agent emits StreamChunk(tool_call)
4. **Tool execution**: Agent executes tool and collects result
5. **Tool result emission**: Agent emits StreamChunk(tool_result)
6. **Stream continuation**: Agent sends tool result back to provider and continues streaming
7. **Completion**: Provider sends completion signal → Agent emits StreamChunk(done)
8. **History access**: User calls `stream.finalResult()` to get complete conversation history

### Dependencies Met

- **Task 011** (Add streaming type definitions) must be completed first to provide:
  - `StreamChunk` interface
  - `AgentStream<O>` interface
  - Related helper types

---

## Implementation Steps

### Step 1: Implement AgentStream Class/Object

Create an AsyncIterable wrapper that manages streaming state and implements the AgentStream interface.

**Location**: `src/agent.ts`

**Requirements**:
- Constructor takes LLMProvider stream response, agent configuration, and message history
- Implements `[Symbol.asyncIterator]()` to yield StreamChunk objects
- Maintains internal state for accumulating:
  - Current message being built (text content)
  - Tool calls that need execution
  - Complete message history
- Implements `finalResult(): Promise<AgentRunResult<O>>`

**Key considerations**:
- Buffer partial tool calls until they're complete
- Track message history throughout streaming
- Properly accumulate text content chunks
- Handle tool execution within the streaming loop

### Step 2: Implement Agent.stream() Method

Add the public `stream()` method to the Agent class.

**Location**: `src/agent.ts` - Agent class

**Signature**:
```typescript
stream<O = unknown>(
  input: string | UserMessage,
  options?: AgentRunOptions
): AgentStream<O>
```

**Implementation**:
1. Convert input to UserMessage format (reuse existing logic)
2. Initialize message history with system message
3. Call `this.provider.chatStream()` with current messages
4. Wrap the stream response in an AgentStream instance
5. Return the AgentStream object

**Key considerations**:
- Mirror the initialization logic from `runWithHistory()` method
- Apply the same tool configuration and structured output setup
- Use existing `this.tools` dictionary for tool lookup during streaming
- Respect `maxToolIterations` option to prevent infinite loops

### Step 3: Handle Streaming Content Accumulation

Implement the logic to accumulate streaming content chunks into complete messages.

**Location**: Within AgentStream iterator implementation

**Requirements**:
1. **Content chunks**: Buffer text content and emit when a complete chunk boundary is reached
   - OpenRouter sends server-sent events (SSE) with delta chunks
   - Accumulate these deltas into complete message strings
   - Emit `StreamChunk({ type: 'content', content })` for user-visible content

2. **Tool calls**: Detect when a tool call is being streamed
   - Tool calls may arrive as complete objects or partial JSON
   - Buffer and parse the complete tool call structure
   - Emit `StreamChunk({ type: 'tool_call', toolCall })`

3. **Stream completion**: Detect finish_reason in OpenRouter response
   - When finish_reason indicates completion, emit `StreamChunk({ type: 'done' })`
   - Mark streaming as complete

**Implementation reference**:
- OpenRouter SDK provides `chatStream()` method returning an async iterable
- Each event contains delta information that needs accumulation
- Look for existing response parsing logic in `src/openrouter.ts` for reference

### Step 4: Handle Tool Execution During Streaming

Implement tool execution logic that integrates with the streaming loop.

**Location**: Within AgentStream iterator implementation

**Requirements**:
1. **Detect tool calls**: Check if the model generated tool calls
2. **Execute tools**: Use existing `executeTool()` pattern (from task 001)
   - Wrap execution in try-catch for error handling
   - Report errors back to model as tool results
3. **Emit tool results**: Send StreamChunk({ type: 'tool_result', ... })
4. **Continue streaming**: After tool execution, send results back to LLMProvider
   - Add tool result message to history
   - Call provider again to continue the conversation
   - Continue streaming from the model's response

5. **Iteration tracking**: Track tool call iterations
   - Respect `maxToolIterations` from options
   - Throw error if exceeded

**Key considerations**:
- Reuse error handling from task 001 (tool handler try-catch)
- Message history must be maintained across tool calls
- Each tool execution iteration must follow the same pattern as non-streaming runs

### Step 5: Implement finalResult() Method

Implement the `finalResult()` promise that returns the final AgentRunResult.

**Location**: Within AgentStream class

**Requirements**:
1. Can only be called after streaming is complete
2. Returns `Promise<AgentRunResult<O>>`
3. Includes:
   - `output`: Parsed/extracted output (structured if schema provided)
   - `messages`: Complete conversation history
   - `iterations`: Number of tool call iterations
   - `usage`: Token usage if available from API responses

**Implementation**:
```typescript
async finalResult(): Promise<AgentRunResult<O>> {
  // Wait for streaming to complete if not already
  if (!this.streamingComplete) {
    // Consume remaining iterator
    for await (const _ of this) {
      // Iterator handles completion
    }
  }

  // Extract output based on responseFormat
  const output = this.extractOutput();

  return {
    output,
    messages: this.messages,
    iterations: this.toolIterations,
    usage: this.usage,
  };
}
```

### Step 6: Integration with Existing Code

Ensure proper integration with existing agent code.

**Location**: `src/agent.ts`

**Requirements**:
1. Reuse existing tool execution logic (try-catch from task 001)
2. Reuse message history accumulation logic (from task 006)
3. Reuse output extraction logic (structured output validation)
4. Maintain consistency with `run()` and `runWithHistory()` APIs

**Type imports needed**:
- `StreamChunk` from `src/types.ts` (defined in task 011)
- `AgentStream<O>` from `src/types.ts` (defined in task 011)
- Existing: `AgentRunResult<O>`, `Message`, `UserMessage`, etc.

---

## Acceptance Criteria

### Functional Requirements

- [ ] `stream()` method exists on Agent class
- [ ] Method signature matches: `stream<O>(input: string | UserMessage, options?: AgentRunOptions): AgentStream<O>`
- [ ] Returned object implements AsyncIterable with `[Symbol.asyncIterator]()`
- [ ] AgentStream emits StreamChunk objects with correct types:
  - [ ] `'content'` chunks contain accumulated text
  - [ ] `'tool_call'` chunks contain ChatToolCall objects
  - [ ] `'tool_result'` chunks contain tool execution results
  - [ ] `'done'` chunk emitted on completion
- [ ] Content chunks properly accumulate streamed deltas from OpenRouter API
- [ ] Tool calls during streaming:
  - [ ] Are detected and parsed correctly
  - [ ] Are executed using existing tool execution logic
  - [ ] Errors are caught and reported to model
  - [ ] Results are sent back to model for continuation
  - [ ] Streaming continues after tool execution
- [ ] `finalResult()` method works:
  - [ ] Returns Promise<AgentRunResult<O>>
  - [ ] Includes `output` field
  - [ ] Includes `messages` field with full conversation history
  - [ ] Includes `iterations` field with tool call count
  - [ ] Can only be called after streaming (or waits for completion)
- [ ] Message history is maintained throughout streaming and tool execution
- [ ] Respects `maxToolIterations` option to prevent infinite loops
- [ ] Throws error when max iterations exceeded

### Error Handling

- [ ] Tool execution errors are caught (try-catch)
- [ ] Tool errors are formatted and sent to model
- [ ] Missing tools throw informative error (from task 001)
- [ ] Missing API key throws error (from task 002)
- [ ] Invalid response format is handled gracefully

### Backward Compatibility

- [ ] Existing `run()` method continues to work
- [ ] Existing `runWithHistory()` method continues to work
- [ ] No changes to existing API signatures
- [ ] New streaming feature is additive only

### Code Quality

- [ ] Types are properly imported from `src/types.ts`
- [ ] No `any` types in new code
- [ ] Code follows existing style and patterns
- [ ] Error messages are informative
- [ ] Comments explain complex streaming logic

---

## Testing Requirements

These tests will be covered in task 013 (Implement streaming integration tests), but document key scenarios here:

### Unit Test Scenarios

1. **Basic streaming**: stream simple response without tools
2. **Content accumulation**: verify deltas are accumulated into complete messages
3. **Tool calling**: stream response includes tool call, execute, emit result
4. **Multi-tool**: streaming with multiple sequential tool calls
5. **Tool errors**: tool execution throws, error is caught and sent to model
6. **Max iterations**: throw when exceeding maxToolIterations
7. **finalResult**: verify output, messages, iterations in final result
8. **Structured output**: with responseFormat schema, validate and extract output
9. **Message history**: all messages (system, user, assistant, tool) are in finalResult

---

## Files to Modify

### Primary Files

1. **`src/agent.ts`**
   - Add `stream()` method to Agent class
   - Implement AgentStream class/object
   - Implement message accumulation during streaming
   - Implement tool execution during streaming
   - Implement finalResult() method

2. **`src/types.ts`** (as needed)
   - Import StreamChunk, AgentStream types (defined in task 011)
   - Add any additional helper types needed for streaming implementation
   - Verify all types are properly exported

### Dependencies

- **Task 011** - Types must be defined: `StreamChunk`, `AgentStream<O>`

### No Changes Needed

- `src/openrouter.ts` - Already provides `chatStream()` method
- Existing test files - New tests in task 013

---

## Implementation Notes

### Key Patterns to Follow

1. **Message accumulation**: Follow the same pattern as `runWithHistory()` for maintaining message history
2. **Tool execution**: Use the try-catch pattern from task 001
3. **Type safety**: Use imported types from task 011, avoid `any` types
4. **Error handling**: Wrap tool execution and API calls in try-catch, report errors to model

### OpenRouter Streaming Reference

OpenRouter provides streaming via `provider.chatStream()` that returns an async iterable. Each yielded value contains:
- `type`: discriminator for chunk type
- `delta`: for content chunks, contains partial text
- `toolCall`: for tool call chunks, contains function call details
- `finishReason`: indicates stream completion

Refer to existing code in `src/openrouter.ts` for response structure patterns.

### Buffering Considerations

- **Content**: Buffer successive delta chunks until natural boundaries (complete words/sentences)
- **Tool calls**: Buffer JSON parsing until complete function call object
- **Tool results**: Emit immediately after execution

### State Management

AgentStream must maintain:
- Current accumulated message content
- Message history (system, user, assistant, tool results)
- Tool iteration counter
- Streaming completion flag
- API response usage statistics

---

## Success Criteria Summary

The implementation is complete when:

1. Agent class has working `stream()` method that returns an AsyncIterable
2. Streaming properly accumulates content deltas into readable chunks
3. Tool calls are executed during streaming and results sent back to model
4. Conversation continues after tool execution
5. `finalResult()` returns complete AgentRunResult with history and output
6. All error scenarios (tool errors, max iterations, etc.) are handled
7. Full backward compatibility maintained with existing APIs
8. Code follows TypeScript strict mode and type safety requirements
9. Ready for integration testing in task 013

---

## Related Tasks

- **Task 011**: Defines StreamChunk and AgentStream types (dependency)
- **Task 013**: Streaming integration tests
- **Task 006**: runWithHistory() method (related implementation)
- **Task 001**: Tool error handling pattern to follow
- **Task 007**: AgentRunResult type definition

---

## References

- OpenRouter API Documentation: https://openrouter.ai/docs
- Design document: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/design.md` (lines 128-153)
- Requirements document: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/requirements.md` (lines 67-71)
