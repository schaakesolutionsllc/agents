# Task 015: Add Streaming Usage Examples to Documentation

## Task Metadata

- **Task ID**: 015
- **Task Name**: Add streaming usage examples to documentation
- **Wave**: 5 (Documentation Phase)
- **Estimated Duration**: 20 minutes
- **Category**: Documentation (docs)
- **Status**: Pending
- **Files to Modify**: `README.md`
- **Dependencies**: Task 010 (Error handling), Task 013 (Streaming support implementation)

---

## Objective

Add comprehensive streaming API usage examples to the README documentation that demonstrate:
1. Basic streaming usage pattern
2. Handling different chunk types
3. Using the `finalResult()` method to retrieve complete conversation history
4. Streaming with tool calls integration

This ensures developers can immediately understand how to use the newly implemented streaming feature (from Task 013) and provides clear examples of the async iterator pattern and event handling patterns.

---

## Context

### Requirements Reference
From NFR-3 (Documentation - Streaming usage examples):
> Documentation must include streaming usage examples showing how to use the streaming API, including basic streaming usage, handling different chunk types, using finalResult(), and streaming with tool calls.

### Design Reference
From design.md - Streaming API section (lines 128-153):

**Core API Contracts**:
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

**Usage Pattern** (from design.md):
```typescript
const stream = agent.stream(input);

for await (const chunk of stream) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
}

const { output, messages } = await stream.finalResult();
```

### Design Workflow - Streaming with Tool Calls
The streaming workflow (design.md, lines 204-238) shows:
1. User calls `stream(input)` on agent
2. Agent initiates `chatStream()` with provider
3. Content chunks are yielded as `StreamChunk(content)` events
4. Tool calls trigger `StreamChunk(tool_call)` events
5. Tool execution happens, yielding `StreamChunk(tool_result)`
6. Agent continues streaming with tool result in context
7. Final `StreamChunk(done)` signals completion
8. User calls `finalResult()` to get complete history and output

### Context from Spec
- **Streaming is integrated with tool execution** - examples should show realistic usage with tools
- **Backward compatibility** - streaming is an additive feature; existing `run()` API remains unchanged
- **History access** - `finalResult()` provides access to full message history, not just output
- **Type safety** - examples should show proper TypeScript typing

---

## Implementation Steps

1. **Locate insertion point in README**
   - Find appropriate section after the existing "Quick Start" and before "Core Concepts"
   - Plan section to be titled "Streaming Usage" or "Real-time Streaming"

2. **Create Basic Streaming Example**
   - Show simple streaming without tools
   - Demonstrate `for await` pattern
   - Show real-time content handling (e.g., writing to stdout)
   - Include comments explaining the StreamChunk type

3. **Create Streaming with Tool Calls Example**
   - Show how tools integrate with streaming
   - Demonstrate handling different chunk types:
     - `'content'` - model output text
     - `'tool_call'` - tool invocation events
     - `'tool_result'` - tool execution results
     - `'done'` - completion signal
   - Show tool execution happening within the streaming loop

4. **Create finalResult() Example**
   - Show how to retrieve complete history after streaming
   - Demonstrate accessing `output`, `messages`, and iteration metadata
   - Show typical use case: logging all messages or continuing conversation

5. **Create Advanced Example (Optional)**
   - Real-world scenario (e.g., research agent)
   - Show structured output with streaming
   - Show error handling patterns

6. **Add Navigation/Links**
   - Update examples directory reference if streaming examples are in examples/ folder
   - Consider adding table of contents or section links if README is long

---

## Acceptance Criteria

### Documentation Content Requirements

- [ ] **Basic Streaming Example**
  - [ ] Shows `agent.stream(input)` method call
  - [ ] Demonstrates `for await...of` loop over stream
  - [ ] Shows how to handle `chunk.type === 'content'`
  - [ ] Includes code comment explaining StreamChunk type structure
  - [ ] Example runs without errors (syntactically valid TypeScript)

- [ ] **Streaming with Tool Calls Example**
  - [ ] Shows tool definition in streaming context
  - [ ] Handles `'tool_call'` chunk type with `chunk.toolCall` access
  - [ ] Handles `'tool_result'` chunk type with `chunk.toolResult` access
  - [ ] Shows that tools execute within streaming loop (realistic workflow)
  - [ ] Demonstrates multiple tool calls in sequence
  - [ ] Code is syntactically valid and logically sound

- [ ] **finalResult() Example**
  - [ ] Shows `await stream.finalResult()` call
  - [ ] Accesses `.output` from result
  - [ ] Accesses `.messages` array from result
  - [ ] Shows typical use case (e.g., logging history, continuing conversation)
  - [ ] Demonstrates that history includes all tool calls and results

- [ ] **Quality Requirements**
  - [ ] All examples are written in TypeScript with proper syntax
  - [ ] All examples can be understood by developers new to streaming
  - [ ] Examples match actual API design from Task 013 implementation
  - [ ] Comments/explanations clarify the purpose of each code block
  - [ ] Examples follow code style of existing README examples

- [ ] **Documentation Structure**
  - [ ] Section is clearly labeled and findable
  - [ ] Examples are ordered logically (simple -> complex)
  - [ ] Examples have clear headers describing what they demonstrate
  - [ ] Examples are grouped together, not scattered throughout README

- [ ] **No Breaking Changes**
  - [ ] Existing Quick Start example is unchanged
  - [ ] Existing API Reference is unchanged
  - [ ] All existing code examples continue to work

### Integration Requirements

- [ ] Examples integrate with context from Task 010 (error handling)
  - Consider showing error handling in tool calls during streaming (if applicable)
  - Error handling should align with documented patterns

- [ ] Examples use types and APIs from Task 013
  - References to `stream()` method are correct
  - StreamChunk type structure matches implementation
  - finalResult() signature and return type match implementation

---

## Files to Modify

### README.md
- **Location**: `/home/markschaake/projects/schaake-agents/README.md`
- **Changes**:
  - Add new "Streaming Usage" section (after "Quick Start", before or within "Core Concepts")
  - Add 3-4 code examples demonstrating streaming patterns
  - Optionally update "Examples" section reference if adding streaming examples to examples/ folder

---

## Reference Material

### From requirements.md
- **NFR-3** (lines 103-106): Documentation requirements including streaming usage examples
- **FR-4** (lines 67-71): Functional requirements for streaming support

### From design.md
- **Streaming API** (lines 128-153): Complete API contract and usage pattern
- **Workflow 2: Streaming with Tool Calls** (lines 204-238): Sequence diagram showing realistic usage

### Type Definitions to Reference in Examples
```typescript
// From design.md

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

## Notes

### Design Decisions
- Examples assume developer has already set up provider and agent (reference Quick Start)
- Focus on streaming-specific patterns, not general setup
- Tool examples should be self-contained (define tool inline in example)
- Use realistic scenarios but keep examples concise (under 30-40 lines each)

### Considerations
- **SDK Compatibility**: Verify StreamChunk and AgentStream types match Task 013 implementation
- **Real-world Usage**: Streaming with tools is non-trivial - ensure workflow examples are accurate
- **Discoverability**: Consider adding internal links or cross-references if README is restructured

### Related Documentation
- Task 010: Error handling guide (may reference in error handling during streaming)
- Task 013: Streaming implementation details and API contracts
- Examples directory: May contain working streaming examples to reference

---

## Success Criteria Summary

Task is complete when:

1. ✅ README.md contains a new "Streaming Usage" section
2. ✅ Section includes at least 3 complete, runnable code examples
3. ✅ Examples demonstrate:
   - Basic streaming (content chunks)
   - Tool integration with streaming
   - Using finalResult() for history access
4. ✅ All examples are syntactically valid TypeScript
5. ✅ Examples match API design from Task 013
6. ✅ Examples are well-commented and beginner-friendly
7. ✅ No existing documentation is modified (additive only)
8. ✅ All acceptance criteria checkboxes above are satisfied
