# Task 003: Create Basic Integration Test Suite

## Task Metadata

- **ID**: 003
- **Name**: Create basic integration test suite
- **Wave**: 2
- **Category**: test
- **Estimated Duration**: 45 minutes
- **Dependencies**: 001 (Wrap tool handler execution in try-catch), 002 (Validate API key at construction)
- **Status**: Pending

## Objective

Create a comprehensive integration test suite for the @schaake/agents library with Vitest that validates core agent functionality including basic runs without tools, tool execution, multi-step tool chains, and error handling. This task is critical for achieving the >80% code coverage requirement and ensuring the agent maintains stability as additional features are implemented.

## Context

### Requirements Overview

From NFR-1 (Test Coverage):
- Achieve >80% code coverage
- All error paths have tests
- All edge cases documented and tested

From the requirements specification, the test suite must cover:
- **FR-1: Tool Handler Error Handling** - Verify that tool handler exceptions are caught and reported to the model instead of crashing
- **FR-2: API Key Validation** - Verify clear error messages when API key is missing
- **FR-5: Type Safety Improvements** - Ensure properly typed SDK responses
- **FR-6: Enhanced Logging API** - Support for onEvent callback system

### Design Specification

The test structure should follow this organization (from design.md):

```typescript
describe('createAgent', () => {
  describe('run', () => {
    it('should complete basic request without tools');
    it('should execute tool and return result');
    it('should handle multi-step tool chains');
    it('should validate structured output against schema');
    it('should throw on schema validation failure');
    it('should throw on max iterations exceeded');
    it('should handle tool execution errors gracefully');
    it('should include tool error in response to model');
  });

  describe('runWithHistory', () => {
    it('should return full message history');
    it('should include all tool calls and results');
    it('should track iteration count');
  });
});
```

Additional error case tests required:
```typescript
describe('error handling', () => {
  it('should throw on missing API key');
  it('should handle invalid JSON from model');
  it('should handle tool not found');
  it('should catch and report tool handler exceptions');
  it('should handle empty response from API');
});
```

### Mocking Strategy

Use Vitest built-in mocks to mock the OpenRouter SDK. The test fixtures should provide:

1. **Mock OpenRouter responses** - Various response types including:
   - Basic completion without tool calls
   - Single tool call
   - Multiple tool calls
   - Partial/streaming responses
   - Error responses

2. **Mock tool handlers** - Test implementations of:
   - Simple synchronous tools
   - Asynchronous tools
   - Tools that throw errors
   - Tools that return complex results

3. **Mock LLM Provider** - Stub the OpenRouter provider to:
   - Return controlled responses
   - Simulate different finish reasons
   - Simulate API errors

### Dependencies Delivered

This task depends on the following tasks being completed:
- **Task 001**: Tool handler try-catch wrapping (FR-1: Tool Handler Error Handling)
- **Task 002**: API key validation (FR-2: API Key Validation)

These dependencies ensure that the error handling and validation features exist before being tested.

## Implementation Steps

### Step 1: Create Test Fixtures and Mocks

**File**: `tests/fixtures/mocks.ts`

Create mock factory functions that return:
- Mock OpenRouter SDK responses for various scenarios
- Mock tool handlers (success, async, error cases)
- Mock LLM provider with configurable responses
- Helper functions to create test agents

```typescript
// Example mock structure
export const createMockOpenRouterResponse = (options: {
  content?: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, any> }>;
  finishReason?: string;
}): OpenRouterChatResponse => { ... }

export const createMockToolHandler = (impl: Function) => vi.fn(impl)

export const createTestAgent = (options?: Partial<AgentConfig>) => { ... }
```

### Step 2: Test Basic Agent Functionality

**File**: `tests/agent.test.ts`

Create tests for `createAgent` with `run()` method:

1. **Basic request without tools**
   - Agent receives a prompt with no tools defined
   - Model returns content only (no tool calls)
   - Agent completes and returns output
   - Verify: Output matches model response

2. **Single tool execution**
   - Agent has one tool defined
   - Model calls the tool with valid arguments
   - Tool handler executes successfully
   - Model returns completion based on tool result
   - Verify: Tool was called with correct arguments, final output includes tool result

3. **Multi-step tool chains**
   - Agent has multiple tools
   - Model calls tool A
   - Based on result, model calls tool B
   - Model returns final answer
   - Verify: Both tools executed in correct order, all results included in context

### Step 3: Test Error Handling

Create tests that verify error handling for all error paths:

1. **Missing API key**
   - Verify that missing API key throws clear error at construction time
   - Verify error message provides resolution steps

2. **Tool handler exceptions**
   - Tool handler throws an error
   - Verify error is caught (not propagated)
   - Verify error is formatted as tool result
   - Verify model receives error and can continue

3. **Invalid JSON from model**
   - Model returns malformed structured output
   - Verify error is caught and reported
   - Verify graceful failure (not crash)

4. **Tool not found**
   - Model calls a tool that doesn't exist
   - Verify error is caught
   - Verify agent reports error to model

5. **Empty response from API**
   - API returns response with no choices
   - Verify error is handled appropriately

6. **Max iterations exceeded**
   - Agent reaches max tool iteration limit
   - Verify error is thrown with appropriate message
   - Verify iteration count is tracked

### Step 4: Test Message History API

Create tests for `runWithHistory()` method:

1. **Return full message history**
   - Verify all messages are returned (system, user, assistant, tool)
   - Verify message order matches execution order
   - Verify message formats are correct

2. **Include all tool calls and results**
   - For multi-step chains, verify all tool interactions are in history
   - Verify ToolResultMessage format

3. **Track iteration count**
   - Verify iterations counter matches number of model calls
   - Verify metadata includes usage statistics

### Step 5: Test Edge Cases and Validation

1. **Structured output validation**
   - Agent with responseFormat schema
   - Model returns valid JSON matching schema
   - Model returns invalid JSON
   - Verify validation works/fails appropriately

2. **Tool argument validation**
   - Tool has schema-defined arguments
   - Handler receives validated arguments
   - Verify argument validation runs before handler execution

3. **Type safety for responses**
   - Verify OpenRouterChatResponse is properly typed
   - Verify tool call results are properly typed
   - Verify no unsafe `any` types in mock responses

### Step 6: Configure Test Runner

Ensure Vitest is configured in the project with:
- TypeScript support
- ESM module support
- Mock/spy support enabled
- Coverage reporting enabled
- Configured to output coverage reports

## Acceptance Criteria

### Must Have (Core Requirements)

- [ ] Test file `tests/agent.test.ts` exists and runs with Vitest
- [ ] Test file `tests/fixtures/mocks.ts` exists with mock factory functions
- [ ] All tests in the "Agent Integration Tests" section pass
- [ ] All tests in the "Error Handling" section pass
- [ ] Code coverage for `src/agent.ts` is >80%
- [ ] No `any` types in mock implementations
- [ ] All error paths have corresponding test cases

### Should Have (Quality)

- [ ] Tests are well-organized with descriptive names
- [ ] Each test has a single clear assertion focus
- [ ] Mocks are reusable and well-documented
- [ ] Error messages are clear and actionable
- [ ] Tests run in under 5 seconds total

### Nice to Have (Polish)

- [ ] Tests include comments explaining complex scenarios
- [ ] Mock fixtures have inline documentation
- [ ] Test output is clear and indicates what failed

## Files to Create/Modify

### New Files

1. **`tests/agent.test.ts`**
   - Location: `/home/markschaake/projects/schaake-agents/tests/agent.test.ts`
   - Primary integration test suite
   - ~400-500 lines of test code
   - Import from `src/agent.ts` and `tests/fixtures/mocks.ts`

2. **`tests/fixtures/mocks.ts`**
   - Location: `/home/markschaake/projects/schaake-agents/tests/fixtures/mocks.ts`
   - Mock factory functions and fixtures
   - ~300-400 lines of mock setup code
   - Export reusable mock builders

### Files Modified Indirectly

- `vitest.config.ts` - May need coverage configuration updates
- `tsconfig.json` - May need test-specific configurations if missing

## Testing Checklist

Before marking this task complete, verify:

- [ ] Run `npm test` or `vitest` - all tests pass
- [ ] Run `vitest coverage` - coverage >80% for agent.ts
- [ ] Verify mocks directory exists and exports correctly
- [ ] Run linting checks - no errors
- [ ] Verify all imports resolve correctly
- [ ] Verify TypeScript compilation succeeds
- [ ] Test output is readable and descriptive

## Notes

### Key Implementation Details

1. **Vitest Mocking**: Use `vi.mock()` and `vi.fn()` for mocking the OpenRouter SDK. Avoid using actual network calls in tests.

2. **Error Message Validation**: When testing error cases, verify that error messages are helpful and don't leak sensitive information (like API keys).

3. **Async Test Handling**: All tool handlers are async, so use `async/await` syntax in tests or return promises.

4. **Type Safety**: Ensure mock responses match the actual OpenRouter SDK types to catch type errors early.

### Edge Cases to Consider

- What happens when a tool returns `undefined`?
- What happens when a tool is called with empty arguments `{}`?
- What happens when the model calls the same tool twice in one iteration?
- What happens when a structured output schema is deeply nested?

### Potential Blockers

- OpenRouter SDK types may need to be imported/verified
- Vitest configuration may need updates if not already configured
- May need to coordinate with Task 001 and 002 to ensure features are implemented

## Related Tasks

- **Task 001**: Wrap tool handler execution in try-catch (prerequisite)
- **Task 002**: Validate API key at construction (prerequisite)
- **Task 004**: Expand test coverage for other modules
- **Task 005**: Add streaming support (will need additional streaming tests)

## References

- Design specification: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/design.md` - Testing Strategy section
- Requirements specification: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/requirements.md` - NFR-1 and NFR-2
- Vitest documentation: https://vitest.dev/
- OpenRouter SDK: https://github.com/openrouter/openrouter-js
