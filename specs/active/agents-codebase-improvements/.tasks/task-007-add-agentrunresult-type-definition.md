# Task 007: Add AgentRunResult Type Definition

## Task Metadata

| Field | Value |
|-------|-------|
| **ID** | 007 |
| **Name** | Add AgentRunResult type definition |
| **Wave** | 1 |
| **Category** | Model/Type Definitions |
| **Estimated Duration** | 15 minutes |
| **Dependencies** | None |
| **Status** | Pending |

## Objective

Add the `AgentRunResult<O>` generic interface to `src/types.ts` that encapsulates the result of an agent run, including output, complete conversation history, iteration count, and optional token usage statistics.

This type definition is foundational for implementing the message history access feature (FR-3) which allows developers to access the full conversation history after a run, enabling better debugging and observability.

## Context

### Functional Requirement

From **FR-3: Message History Access**:
- Return conversation history from `run()` method
- Include all messages: system, user, assistant, tool
- Provide iteration count and metadata
- Support both simple (`run()`) and detailed (`runWithHistory()`) APIs

### Design Specification

From the design document, the `AgentRunResult<O>` interface should follow this structure:

```typescript
export interface AgentRunResult<O> {
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

### API Design Approach

This implementation aligns with **Option B** from the API design section: "Separate Method (Non-breaking)"

The approach maintains backward compatibility by:
- Keeping the existing `run()` method unchanged (returns just `O`)
- Adding a new `runWithHistory()` method that returns `AgentRunResult<O>`

This ensures:
- No breaking changes to the current API contract
- Users can opt-in to extended functionality
- Gradual migration path for users who need full history access

### Type Safety Improvement

This task addresses **FR-5: Type Safety Improvements** by:
- Creating a concrete interface instead of relying on anonymous objects
- Providing proper generic typing for output (`<O>`)
- Establishing a clear contract for message history access
- Supporting optional usage statistics for token tracking (future cost analysis)

## Implementation Steps

1. **Add the AgentRunResult interface** to `src/types.ts`
   - Place it logically after the `Message` and `ChatResponse` types
   - Use a generic type parameter `<O>` for the output type
   - Include the `usage` field as optional for token tracking
   - Add JSDoc comments explaining each field

2. **Verify compatibility** with existing types
   - Ensure `Message` type exists and is properly defined
   - Confirm generic type parameter does not conflict with other generics in the file
   - Check that the interface follows the existing code style

3. **Update Agent interface** (in the same file)
   - Confirm the current `Agent<I, O>` interface has `run()` returning `Promise<O>`
   - Note that `runWithHistory()` will be added later (Wave 2) and will return `Promise<AgentRunResult<O>>`

4. **Review and validate**
   - Ensure TypeScript compiles without errors
   - Verify the type is properly exported from index.ts (or plan for it)
   - Check formatting matches existing code style

## Acceptance Criteria

- [ ] `AgentRunResult<O>` interface is defined in `src/types.ts`
- [ ] The interface includes all required fields: `output`, `messages`, `iterations`
- [ ] The `usage` field is optional and properly typed with `promptTokens`, `completionTokens`, `totalTokens`
- [ ] The interface uses a generic type parameter `<O>` for the output type
- [ ] Generic type parameter is correctly scoped (not conflicting with other types)
- [ ] JSDoc comments are added to document the purpose and fields
- [ ] The type follows existing code style and conventions
- [ ] TypeScript compilation succeeds with no new errors
- [ ] The type is logically placed in the file (near related types like `Message` and `ChatResponse`)
- [ ] No existing tests are broken by this change

## Technical Details

### Type Parameters

- **`<O>`** - The output type, which is identical to the Agent's generic output type
  - Examples: `AgentRunResult<string>`, `AgentRunResult<{ name: string; age: number }>`
  - This ensures type safety when using the result

### Field Specifications

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `output` | `O` | Yes | The final output from the agent execution |
| `messages` | `Message[]` | Yes | Complete conversation history including system, user, assistant, and tool messages |
| `iterations` | `number` | Yes | Number of agent loop iterations (tool calls + processing) |
| `usage` | `{ promptTokens: number; completionTokens: number; totalTokens: number }` | No | Optional token usage statistics for cost tracking |

### Relationship with Other Types

- **Related to `Message`**: Uses the existing `Message` type already defined in types.ts
- **Related to `Agent<I, O>`**: The output type `O` matches the Agent's output generic parameter
- **Used by**: Will be the return type for `runWithHistory()` method (Wave 2)
- **Complements**: The existing `ChatResponse` interface which handles single API responses

## Files to Modify

- **`src/types.ts`** - Add the `AgentRunResult<O>` interface definition

## Additional Notes

### Future-proofing

The `usage` field is optional to allow for:
- Scenarios where token counting is not available
- Different LLM providers with varying usage tracking
- Gradual implementation of token counting features

### Integration with Wave 2

Once this type is defined, Wave 2 tasks can:
- Update the `Agent` interface to add `runWithHistory()` method returning `Promise<AgentRunResult<O>>`
- Implement the actual message history tracking in `agent.ts`
- Add tests for history retrieval

### Backward Compatibility

This is a pure type definition addition with no breaking changes:
- No existing code is modified
- No public APIs are changed
- The type is additive and optional
- Existing `run()` method continues to return `Promise<O>` unchanged

## Testing Strategy

This task involves only type definition and requires:
- TypeScript compilation validation
- No runtime tests needed at this stage
- Syntax checking in IDE/editor
- Manual verification of generic type parameter behavior

Type correctness will be validated in Wave 2 when the actual `runWithHistory()` method is implemented and tested.

## Code Style Guide

Follow existing conventions from `src/types.ts`:
- Use `export interface` for public types
- Include JSDoc comments with descriptions
- Use PascalCase for interface names
- Use existing generic type naming (like `<I>` and `<O>` for input/output)
- Maintain consistent indentation (2 spaces)
- Group related interfaces together

## References

- **Requirements**: FR-3 (Message History Access), FR-5 (Type Safety Improvements)
- **Design Section**: API Design → Option B, Type Safety Improvements
- **File**: `src/types.ts` (current implementation)
- **Related Wave 2 Tasks**: Implementation of `runWithHistory()` method
