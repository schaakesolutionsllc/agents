# Task 016: Add JSDoc Documentation to Public APIs

## Task Metadata

| Property | Value |
|----------|-------|
| **Task ID** | 016 |
| **Wave** | 5 |
| **Category** | docs |
| **Estimated Duration** | 30 minutes |
| **Status** | Pending |
| **Dependencies** | 005, 006, 010, 012 |

---

## Objective

Add comprehensive JSDoc comments to all public-facing functions, interfaces, and types in the @schaake/agents codebase. This includes documenting:

- **Agent creation and execution**: `createAgent()`, `run()`, `runWithHistory()`, `stream()`
- **Tool definitions**: `defineTool()`, `defineSyncTool()`, tool handler functions
- **Core types and interfaces**: `Agent`, `AgentConfig`, `AgentContext`, `Message`, `ToolDefinition`, `ChatResponse`, `ChatRequest`, `LLMProvider`, `ModelConfig`, and related types
- **Event types**: `AgentLogEvent` and discriminated event variants
- **Result types**: `AgentRunResult` (when implemented)

All JSDoc comments must include:
- Clear description of purpose and behavior
- Parameter types and descriptions (with `@param`)
- Return value type and description (with `@returns`)
- Usage examples for complex types (with `@example`)
- Relevant warnings or special behavior (with `@throws` or `@remarks`)

---

## Context

### From Requirements (NFR-3)

**Non-Functional Requirement 3 - Documentation**:
> All public APIs documented with JSDoc
> Error handling guide in README
> Streaming usage examples

This task focuses on the JSDoc documentation aspect of NFR-3. The JSDoc comments provide compile-time documentation visible in IDEs and tooling, enabling better developer experience and reducing API misuse.

### From Design Document

The design outlines the following key public APIs that require documentation:

**API Design Section** defines:
```typescript
// Simple run - returns just output
const result = await agent.run(input);

// Extended run with history
const { output, messages, iterations } = await agent.runWithHistory(input);

// Streaming API
const stream = agent.stream(input);
for await (const chunk of stream) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
}
const { output, messages } = await stream.finalResult();
```

**Type Safety Improvements Section** defines new interfaces that need documentation:
- `OpenRouterChoice`
- `OpenRouterChatResponse`
- `ToolHandlerResult`
- `AgentRunResult<O>`

**Event Logging API Section** defines:
```typescript
type AgentEvent =
  | { type: 'model_call'; iteration: number; messages: Message[] }
  | { type: 'tool_call'; name: string; args: any }
  | { type: 'tool_result'; name: string; result: any }
  | { type: 'tool_error'; name: string; error: string }
  | { type: 'complete'; output: any };
```

### Current State

**Current files** have minimal or no JSDoc:
- `/home/markschaake/projects/schaake-agents/src/agent.ts` - No JSDoc on exported functions
- `/home/markschaake/projects/schaake-agents/src/types.ts` - Inline comments but no formal JSDoc
- `/home/markschaake/projects/schaake-agents/src/tools.ts` - Minimal documentation

**Existing exports** from these files:
1. `createAgent()` - Factory function for creating agents
2. `defineTool()` - Helper to create tool definitions
3. `defineSyncTool()` - Helper to wrap synchronous tool handlers
4. Multiple interfaces: `Message`, `ToolDefinition`, `ToolHandler`, `Agent`, `AgentConfig`, etc.

---

## Implementation Steps

### Step 1: Document Core Types in `src/types.ts`

Add JSDoc for the following types (in order they appear):

1. **`Role` type** - The allowed message roles
2. **`Message` interface** - Structure of conversation messages
3. **`ToolSchema` interface** - Schema for defining tool capabilities
4. **`ToolHandler` type** - Handler function signature for tool execution
5. **`ToolDefinition` interface** - Complete tool definition with schema and handler
6. **`ChatTool` interface** - Format sent to LLM provider
7. **`ChatToolCall` interface** - Tool invocation from LLM response
8. **`ChatResponse` interface** - Provider response structure
9. **`ChatRequest` interface** - Request structure for provider
10. **`LLMProvider` interface** - Provider abstraction for LLM calls
11. **`ModelConfig` interface** - Model configuration
12. **`AgentContext` interface** - Runtime context available to tools
13. **`AgentLogEvent` type** - Event discriminated union
14. **`Schema<T>` interface** - Generic schema validator interface
15. **`AgentConfig<I, O>` interface** - Configuration for creating agents
16. **`AgentRunOptions` interface** - Options for `run()` method
17. **`Agent<I, O>` interface** - Public agent interface

Each should include:
- Clear description of purpose
- For interfaces: documentation of each property with `@property` tags
- For functions/methods: parameter and return documentation
- Relevant examples where helpful (especially for complex types)

### Step 2: Document Agent Functions in `src/agent.ts`

Add JSDoc for the following exported functions:

1. **`createAgent<I, O>(config: AgentConfig<I, O>): Agent<I, O>`**
   - Description: Creates an agent instance with given configuration
   - Explain input/output types
   - Document the `config` parameter structure
   - Show a basic usage example
   - Explain the tool execution loop behavior
   - Note current limitations (e.g., streaming not yet implemented)

2. **`run(input: I, options?: AgentRunOptions): Promise<O>` method**
   - Description: Executes the agent with given input
   - Document input validation and schema parsing
   - Explain tool calling behavior and iteration limits
   - Document error cases (max iterations, parsing failures)
   - Show example usage
   - Note about structured output validation

### Step 3: Document Tool Helpers in `src/tools.ts`

Add JSDoc for:

1. **`defineTool(schema: ToolSchema, handler: ToolHandler): ToolDefinition`**
   - Description: Creates a tool definition from schema and handler
   - Example showing how to use with async handler
   - Note about error handling expectations

2. **`defineSyncTool(schema: ToolSchema, handler: ...): ToolDefinition`**
   - Description: Wrapper for synchronous tool handlers
   - Example showing a simple synchronous tool
   - Note that it wraps the handler in `Promise.resolve()`

### Step 4: Internal Helper Documentation

Document these internal functions with JSDoc (not exported but useful for code clarity):

1. **`toChatTools(tools?: ToolDefinition[]): ChatTool[] | undefined`**
   - Convert tool definitions to provider format

2. **`buildInitialMessages<I>(config, input): Message[]`**
   - Build initial message array from config and input

3. **`runToolCalls(tools, toolCalls, ctx): Promise<Message[]>`**
   - Execute tool calls and return tool result messages
   - Document error handling behavior

---

## Acceptance Criteria

- [ ] All exported types and interfaces in `src/types.ts` have JSDoc comments
  - [ ] Each type/interface has clear description
  - [ ] Each property/parameter is documented
  - [ ] Complex types have `@example` sections

- [ ] `createAgent()` function in `src/agent.ts` has comprehensive JSDoc
  - [ ] Includes description of agent creation
  - [ ] Documents generic type parameters `I` and `O`
  - [ ] Includes usage example
  - [ ] Documents configuration structure

- [ ] `Agent.run()` method has comprehensive JSDoc
  - [ ] Describes execution behavior
  - [ ] Documents input validation
  - [ ] Documents error cases and throws
  - [ ] Includes usage example

- [ ] Tool helpers in `src/tools.ts` are documented
  - [ ] `defineTool()` has JSDoc with example
  - [ ] `defineSyncTool()` has JSDoc with example

- [ ] Internal helpers in `src/agent.ts` have JSDoc
  - [ ] `toChatTools()` documented
  - [ ] `buildInitialMessages()` documented
  - [ ] `runToolCalls()` documented with error handling notes

- [ ] TypeScript compilation succeeds with no errors
  - [ ] Run `npm run build` successfully

- [ ] Documentation is visible in IDE
  - [ ] Hover on `createAgent` shows JSDoc in editor
  - [ ] Parameter types and examples are readable

- [ ] No breaking changes to code
  - [ ] All existing tests pass
  - [ ] Public API signatures unchanged

---

## Files to Modify

### Primary Files

1. **`/home/markschaake/projects/schaake-agents/src/types.ts`**
   - Add JSDoc to all 17 type/interface exports
   - Focus: clarity, properties, examples for complex types

2. **`/home/markschaake/projects/schaake-agents/src/agent.ts`**
   - Add JSDoc to `createAgent()` exported function
   - Add JSDoc to `run()` method within agent object
   - Add JSDoc to internal helpers: `toChatTools()`, `buildInitialMessages()`, `runToolCalls()`

3. **`/home/markschaake/projects/schaake-agents/src/tools.ts`**
   - Add JSDoc to `defineTool()` function
   - Add JSDoc to `defineSyncTool()` function

### Reference Files (read-only)

- Design document: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/design.md`
- Requirements: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/requirements.md`

---

## JSDoc Format Reference

Use standard TypeScript/JSDoc format:

```typescript
/**
 * Brief description of the type/function.
 *
 * Longer explanation if needed. Can reference other types
 * and explain the purpose in the broader context.
 *
 * @typeParam T - Description of generic type parameter
 * @param paramName - Description of parameter, including type if not obvious
 * @returns Description of return value
 * @throws ErrorType - When this error is thrown and why
 * @example
 * // Example usage
 * const result = await agent.run(input);
 *
 * @remarks
 * Any special behavior, limitations, or important notes.
 *
 * @see Related types or functions
 */
```

### Important Guidelines

1. **Parameter documentation**: Use `@param` with clear descriptions
2. **Return documentation**: Use `@returns` or `@return`
3. **Examples**: Include realistic `@example` blocks for public functions
4. **Error cases**: Document with `@throws` for error conditions
5. **Generic types**: Document type parameters with `@typeParam`
6. **Notes**: Use `@remarks` for important implementation details
7. **Cross-references**: Use `@see` to link to related types

---

## Verification Steps

After completing documentation:

1. **Build the project**:
   ```bash
   npm run build
   ```
   - Verify TypeScript compilation succeeds
   - No type errors introduced

2. **Check documentation visibility**:
   - Open VSCode with the project
   - Hover over `createAgent`, `run`, `defineTool` functions
   - Verify JSDoc appears in IntelliSense tooltip

3. **Run tests**:
   ```bash
   npm test
   ```
   - Verify all existing tests pass
   - No behavior changes, only documentation

4. **Visual inspection**:
   - Review each JSDoc comment for clarity
   - Ensure examples compile and make sense
   - Check for typos and proper markdown formatting

---

## Notes

### JSDoc Best Practices Applied

- **Clarity**: Describe the "why" and "what", not just the "how"
- **Examples**: Provide realistic usage examples for complex APIs
- **Completeness**: Document all public exports
- **Consistency**: Use consistent formatting and terminology across all docs
- **IDE Integration**: Leverage IDE hover tooltips by keeping descriptions concise but informative

### Scope Clarification

This task focuses **only on JSDoc comments**. It does not include:
- README documentation or guides (different task)
- Inline code comments
- API documentation generation (separate concern)
- Streaming API implementation (implemented in earlier tasks)

---

## Related Tasks

- **Task 005**: Type safety improvements (defines types being documented)
- **Task 006**: Message history access (implements `runWithHistory()`)
- **Task 010**: Streaming support (implements `stream()`)
- **Task 012**: Enhanced logging API (documents event types)
