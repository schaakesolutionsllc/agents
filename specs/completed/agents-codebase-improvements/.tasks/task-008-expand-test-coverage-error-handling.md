# Task 008: Expand Test Coverage for Error Handling Paths

## Task Metadata

- **ID**: 008
- **Name**: Expand test coverage for error handling paths
- **Wave**: 3 (Testing & Polish Phase)
- **Estimated Duration**: 30 minutes
- **Category**: Test
- **Status**: Pending
- **Dependencies**: 001, 002, 005

## Objective

Add comprehensive tests for all error scenarios in the @schaakesolutionsllc/agents library to achieve >80% code coverage. Specifically, test missing API key validation, invalid JSON responses from the model, tool not found errors, tool handler exceptions, and empty API responses. All error paths must be covered with tests to ensure the library gracefully handles failures and provides developers with informative error messages.

## Context

### Requirements Reference

From **NFR-1: Test Coverage**:
- Achieve >80% code coverage
- All error paths have tests
- All edge cases documented and tested

From **FR-1: Tool Handler Error Handling**:
- Wrap tool handler execution in try-catch
- Report errors back to model as tool results (not crashes)
- Log handler errors with context
- Allow agent to continue after tool failures

From **FR-2: API Key Validation**:
- Validate API key exists at OpenRouterProvider construction time
- Throw clear error message with resolution steps
- Fail fast instead of silent failure on first API call

### Design Reference

The design document specifies the following test structure for error handling:

```typescript
describe('error handling', () => {
  it('should throw on missing API key');
  it('should handle invalid JSON from model');
  it('should handle tool not found');
  it('should catch and report tool handler exceptions');
  it('should handle empty response from API');
});
```

### Current Test Structure

Existing tests are organized in:
- `/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts` - Provider-level tests
- `/home/markschaake/projects/schaake-agents/tests/tools.test.ts` - Tool definition tests

Tests use:
- **Framework**: Vitest with `describe`, `it`, `expect`
- **Mocking**: `vi.mock()` for SDK mocking and `vi.fn()` for function mocking
- **Setup**: `beforeEach()` for test isolation and mock resets

### Current State

The codebase has the following error handling implementation:

1. **API Key Validation**: OpenRouterProvider should validate key at construction
2. **Tool Handler Errors**: Tool execution needs try-catch wrapping
3. **Response Validation**: API responses need validation for empty choices
4. **JSON Parsing**: Tool arguments must be safely parsed

### Why This Matters

1. **Production Readiness**: Error tests ensure graceful failure instead of crashes
2. **Developer Experience**: Tests document expected error behavior and messages
3. **Coverage Requirements**: >80% coverage threshold requires testing all error paths
4. **Maintainability**: Comprehensive error tests prevent regressions

## Implementation Steps

### Step 1: Create Agent Integration Test File

1. Create `/home/markschaake/projects/schaake-agents/tests/agent.test.ts`
2. Import required testing utilities and dependencies:
   ```typescript
   import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
   import { createAgent } from "../src/agent.js";
   import { OpenRouterProvider } from "../src/openrouter.js";
   import { defineTool } from "../src/tools.js";
   import type { Message } from "../src/types.js";
   ```
3. Set up SDK mocking at the module level (similar to openrouter.test.ts)

### Step 2: Test Missing API Key Error

Create test suite: `describe('API Key Validation', () => { ... })`

**Test Cases**:

1. **Test: "should throw on missing API key"**
   - Create OpenRouterProvider without API key (pass `undefined` or empty string)
   - Expect constructor to throw with message containing:
     - "API key"
     - Clear resolution steps (how to fix the problem)
   - Verify error is thrown immediately (fail fast)
   - Example assertion: `expect(() => new OpenRouterProvider({ apiKey: "" })).toThrow(/API key/i)`

2. **Test: "should throw on null API key"**
   - Similar to above but with `null` explicitly
   - Ensures both `null` and `undefined` are handled

### Step 3: Test Invalid JSON Response Handling

Create test suite: `describe('Invalid Response Handling', () => { ... })`

**Test Cases**:

1. **Test: "should handle invalid JSON from model in tool arguments"**
   - Mock SDK to return tool call with malformed JSON in `arguments` field
   - Example: `arguments: "{invalid json}"`
   - Verify error is caught and handled gracefully
   - Agent should either:
     - Throw with descriptive error message about JSON parse error
     - Or continue with proper error message to model
   - Assertion: `expect(promise).rejects.toThrow(/JSON|parse|invalid/i)`

2. **Test: "should handle empty string in tool arguments"**
   - Mock tool call with `arguments: ""`
   - Verify handling produces appropriate error

3. **Test: "should handle null content in response"**
   - Mock response with `message.content: null` when not a tool call
   - Verify error is handled appropriately

### Step 4: Test Tool Not Found Error

Create test suite: `describe('Tool Resolution', () => { ... })`

**Test Cases**:

1. **Test: "should throw when tool not found in agent tools"**
   - Create agent with specific tools
   - Mock SDK to return tool call for a tool NOT in the agent's tool registry
   - Example: Agent has `calculator` tool, but model requests `unknown_tool`
   - Verify error is thrown with message:
     - Contains the tool name that was not found
     - Lists available tools (or suggests checking tool definitions)
   - Assertion: `expect(promise).rejects.toThrow(/not found|unknown|undefined/i)`

2. **Test: "should handle tool name mismatch case-sensitively"**
   - Model requests `Calculator` but agent has `calculator`
   - Verify it's treated as "not found" (case-sensitive matching)

### Step 5: Test Tool Handler Exceptions

Create test suite: `describe('Tool Handler Error Handling', () => { ... })`

**Test Cases**:

1. **Test: "should catch and report tool handler exceptions"**
   - Create tool with handler that throws an error:
     ```typescript
     const failingTool = defineTool(
       { name: "failingTool", description: "...", parameters: {...} },
       async () => { throw new Error("Handler failed"); }
     );
     ```
   - Create agent with this tool
   - Mock SDK to trigger this tool
   - Verify the agent:
     - Does NOT crash
     - Catches the exception
     - Continues execution (sends error to model as tool result)
     - Error message is available in response or message history
   - Assertion: `expect(result).toBeDefined()` (agent completes despite tool error)

2. **Test: "should include error message in tool result"**
   - Similar setup to above
   - Verify that when error is caught, it's formatted as a tool result message
   - Check message history includes tool error result
   - Example structure: `{ role: "tool", content: "Error: Handler failed", ... }`

3. **Test: "should handle synchronous tool errors"**
   - Tool handler throws synchronously (not in Promise)
   - Verify try-catch still captures it

4. **Test: "should handle async tool errors"**
   - Tool handler throws in async context (Promise rejection)
   - Verify try-catch with proper `await` captures it

5. **Test: "should not leak stack traces to model"**
   - Verify error messages sent to model are sanitized
   - Should include helpful error info but not full stack trace
   - Prevents information leakage about internal structure

### Step 6: Test Empty Response Handling

Create test suite: `describe('Empty Response Handling', () => { ... })`

**Test Cases**:

1. **Test: "should throw when response has empty choices array"**
   - Mock SDK to return response with `choices: []`
   - Verify error is thrown immediately with clear message
   - Message should indicate: "No response from model" or "Empty response"
   - Assertion: `expect(promise).rejects.toThrow(/no choice|empty|response/i)`

2. **Test: "should handle undefined choice message"**
   - Mock response where `choices[0]` exists but `message` is undefined
   - Verify appropriate error handling

3. **Test: "should handle missing finish reason"**
   - Mock response with `finishReason: null` unexpectedly
   - Verify handling (may be valid in some cases, but test the behavior)

### Step 7: Expand Existing Test Coverage

1. **In openrouter.test.ts**:
   - Add test: "should throw on no choices in response" (may already exist)
   - Add test: "should handle missing API key" (move from agent tests if applicable)
   - Verify all response validation paths have tests

2. **In agent.test.ts** (new tests):
   - Add tests for multi-step tool execution with errors
   - Test that agent continues after tool error (doesn't crash on first error)
   - Test error message propagation through iterations

### Step 8: Verify Coverage

1. Run test suite with coverage:
   ```bash
   npm test -- --coverage
   ```
2. Identify any uncovered lines in:
   - `src/agent.ts` - error handling paths
   - `src/openrouter.ts` - response validation
   - `src/tools.ts` - handler execution
3. Add targeted tests to cover any gaps
4. Verify >80% coverage threshold is met

## Acceptance Criteria

- [ ] **Missing API key test**: Test throws on missing/empty API key at construction time

- [ ] **API key validation covered**: OpenRouterProvider validates key and throws with informative error message

- [ ] **Invalid JSON tests**: Tests cover malformed JSON in tool arguments with appropriate error handling

- [ ] **Tool not found test**: Test throws when model requests non-existent tool with clear error message

- [ ] **Tool handler exception tests**: Multiple tests covering sync/async tool handler errors

- [ ] **Error reporting mechanism**: Tests verify errors are caught and reported to model, not thrown as unhandled exceptions

- [ ] **Empty response tests**: Tests cover empty choices array and missing response data

- [ ] **Agent continues after error**: Tests verify agent doesn't crash after tool handler exception

- [ ] **Error message quality**: Tests verify error messages are informative and don't leak sensitive stack traces

- [ ] **Test organization**: Tests are organized in logical `describe()` blocks with clear naming

- [ ] **Proper mocking**: All SDK calls are mocked; tests don't make actual API requests

- [ ] **Test isolation**: Each test is independent with proper setup/cleanup via `beforeEach`/`afterEach`

- [ ] **Coverage >80%**: Running `npm test -- --coverage` shows >80% coverage for modified/new files

- [ ] **No test regressions**: All existing tests continue to pass

- [ ] **TypeScript compilation**: No TS errors in test files

## Files to Modify

### Primary Files (Test Files)

1. **`/home/markschaake/projects/schaake-agents/tests/agent.test.ts`** *(NEW)*
   - Primary file: Complete new integration test file
   - Contains all agent-level error handling tests
   - ~200-300 lines of test code

2. **`/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts`** *(EXISTING)*
   - Secondary file: Add missing API key validation test
   - Verify empty choices error test exists
   - May add additional response validation tests

### Source Files to Verify (No changes needed)

3. **`/home/markschaake/projects/schaake-agents/src/agent.ts`**
   - Review for: Tool handler try-catch implementation
   - Review for: Error passing to model as tool result
   - If not implemented, this becomes a task blocker

4. **`/home/markschaake/projects/schaake-agents/src/openrouter.ts`**
   - Review for: API key validation in constructor
   - Review for: Empty choices response handling

## Related Context

### Test Structure Reference

From existing tests, the pattern is:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenRouterProvider } from "../src/openrouter.js";

const mockSend = vi.fn();

vi.mock("@openrouter/sdk", () => {
  return {
    OpenRouter: class {
      chat = { send: mockSend };
    },
  };
});

describe("Feature", () => {
  let provider: OpenRouterProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenRouterProvider({ apiKey: "test-key" });
  });

  it("should test behavior", async () => {
    mockSend.mockResolvedValue({ /* mocked response */ });
    // ... test code ...
    expect(mockSend).toHaveBeenCalled();
  });
});
```

### Error Handling Implementation Reference

The design specifies:

1. **Try-Catch for Tool Handlers**:
   ```typescript
   try {
     const result = await tool.handler(args, context);
   } catch (error) {
     // Format error and return as tool result to model
     const errorMessage = `Error: ${(error as Error).message}`;
     // Add to messages: { role: "tool", content: errorMessage }
   }
   ```

2. **API Key Validation**:
   ```typescript
   constructor(config: OpenRouterConfig) {
     if (!config.apiKey || config.apiKey.trim() === "") {
       throw new Error("OpenRouter API key is required. Get one at https://openrouter.ai");
     }
     this.apiKey = config.apiKey;
   }
   ```

3. **Empty Response Validation**:
   ```typescript
   const choice = response.choices[0];
   if (!choice) {
     throw new Error("OpenRouterProvider: No choices in response");
   }
   ```

### Dependencies (Completed Tasks)

- **Task 001**: Tool handler error handling infrastructure (if needed)
- **Task 002**: Basic agent tests (if needed)
- **Task 005**: Initial test setup (test files exist)

### Phase Context

This is a **Phase 3 (Testing & Polish)** task that:
- Completes the test coverage requirements
- Validates all error paths work as designed
- Enables confident production deployment
- Documents error behavior for developers

### Coverage Strategy

To achieve >80% coverage:

1. **Identify coverage gaps**: Run coverage report
   ```bash
   npm test -- --coverage --reporter=html
   ```

2. **Error paths to cover**:
   - Missing API key (OpenRouterProvider constructor)
   - Empty API response (response.choices validation)
   - Invalid JSON in tool arguments (JSON.parse)
   - Tool not found (tool registry lookup)
   - Tool handler exceptions (try-catch blocks)
   - Invalid finish reason handling
   - Multiple tool calls handling

3. **Tool iteration tests**:
   - Agent completes with tool (happy path)
   - Agent continues after tool error
   - Agent respects max iterations limit
   - Agent handles tool chains with errors

## Testing Patterns

### Pattern: Testing Thrown Errors

```typescript
it("should throw on error condition", async () => {
  const promise = someAsyncFunction();
  await expect(promise).rejects.toThrow(/specific error message/i);
});
```

### Pattern: Testing Error Recovery

```typescript
it("should recover from error", async () => {
  mockSdk.mockImplementation(() => {
    throw new Error("API error");
  });

  const result = await agent.run(input);
  expect(result).toBeDefined(); // Agent still completes
});
```

### Pattern: Mocking Tool Calls

```typescript
mockSend.mockResolvedValue({
  choices: [{
    finishReason: "tool_calls",
    message: {
      role: "assistant",
      content: null,
      toolCalls: [{
        id: "call_123",
        type: "function",
        function: {
          name: "toolName",
          arguments: JSON.stringify({ /* args */ })
        }
      }]
    }
  }]
});
```

## Rollback Plan

If issues arise:

1. Delete `/home/markschaake/projects/schaake-agents/tests/agent.test.ts` (if created)
2. Revert changes to `/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts`
3. No source code changes, only tests
4. No runtime impact - purely testing infrastructure

## Notes

- This task focuses on **testing error scenarios**, not implementing new functionality
- Error handling implementation (try-catch, validation) should already be in place from previous tasks
- Tests serve as executable documentation of expected error behavior
- Aim for clarity and specificity in test names and error messages
- Each test should be independent and use fresh mocks via `beforeEach`
- Coverage tool will identify which lines/paths still need testing
- Tests should cover both direct errors (missing API key) and indirect errors (invalid response structure)

