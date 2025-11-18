# Task 002: Add API Key Validation at Construction Time

## Task Metadata

| Property | Value |
|----------|-------|
| **Task ID** | 002 |
| **Title** | Add API key validation at construction time |
| **Wave** | 1 (Critical Phase) |
| **Category** | Service |
| **Estimated Duration** | 15 minutes |
| **Status** | Pending |
| **Dependencies** | None |

---

## Objective

Add validation in the `OpenRouterProvider` constructor to ensure an API key is provided. The validation should throw a clear, descriptive error with resolution steps if the API key is missing. This ensures fail-fast behavior instead of silent failure on the first API call, improving developer experience and debugging efficiency.

---

## Context

### Requirement Reference

**FR-2: API Key Validation** (from requirements.md)
- Validate API key exists at OpenRouterProvider construction time
- Throw clear error message with resolution steps
- Fail fast instead of silent failure on first API call

### Design Reference

**API Key Protection** (from design.md)
- Never log API keys
- Validate key exists at construction (fail fast)

### Current Implementation

The `OpenRouterProvider` constructor (in `/home/markschaake/projects/schaake-agents/src/openrouter.ts`) currently:

```typescript
constructor(opts: OpenRouterProviderOptions = {}) {
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;

  this.client = new OpenRouter({
    apiKey,
    serverURL: opts.baseUrl,
    debugLogger: opts.debugLogger,
  });
}
```

**Problem**: If `opts.apiKey` is not provided and the `OPENROUTER_API_KEY` environment variable is not set, the `apiKey` will be `undefined`. This undefined key is passed to the OpenRouter SDK, which doesn't validate it at construction time. The error only occurs later when the first API call is made, resulting in:
- Poor developer experience
- Difficult debugging
- Silent failures that are hard to trace

### Impact Scope

- **Primary File**: `/home/markschaake/projects/schaake-agents/src/openrouter.ts`
- **Test File**: `/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts`
- **Type Definitions**: `/home/markschaake/projects/schaake-agents/src/types.ts` (if new error types needed)

---

## Implementation Steps

### Step 1: Add Validation to Constructor

Add validation logic to the `OpenRouterProvider` constructor to check that an API key is provided.

1. After resolving the API key (from options or environment variable), check if it exists
2. If the API key is missing (`undefined` or empty string), throw a descriptive error
3. The error message should include:
   - Clear explanation of what went wrong
   - Where the API key should come from
   - Resolution steps for the user

### Step 2: Error Message Design

Create an error with the following information:

**Message format**:
```
OpenRouterProvider: API key is required but not provided.

Resolution steps:
1. Pass apiKey option: new OpenRouterProvider({ apiKey: 'your-key' })
2. Set OPENROUTER_API_KEY environment variable: export OPENROUTER_API_KEY=your-key
3. Get your API key from: https://openrouter.ai/keys

Choose one method and try again.
```

**Error Type**: Use a standard `Error` or create a custom error class for consistency.

### Step 3: Implementation Options

**Option A (Simple - Recommended for this task)**:
```typescript
constructor(opts: OpenRouterProviderOptions = {}) {
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenRouterProvider: API key is required but not provided.\n\n" +
      "Resolution steps:\n" +
      "1. Pass apiKey option: new OpenRouterProvider({ apiKey: 'your-key' })\n" +
      "2. Set OPENROUTER_API_KEY environment variable: export OPENROUTER_API_KEY=your-key\n" +
      "3. Get your API key from: https://openrouter.ai/keys\n\n" +
      "Choose one method and try again."
    );
  }

  this.client = new OpenRouter({
    apiKey,
    serverURL: opts.baseUrl,
    debugLogger: opts.debugLogger,
  });
}
```

**Option B (With Custom Error Class - for future consistency)**:
If the codebase has or plans to have custom error classes (noted in design.md: `src/errors.ts`), consider creating an `OpenRouterError` class and throwing that instead.

### Step 4: Validation Details

- Validation should occur **before** creating the `OpenRouter` client
- The check should validate that `apiKey` is:
  - Not `undefined`
  - Not `null`
  - Not an empty string `""`
- Use strict validation: `if (!apiKey)` catches all these cases

---

## Acceptance Criteria

- [ ] **Validation Added**: Constructor validates API key presence before client initialization
- [ ] **Error Thrown**: Missing API key throws an `Error` with a clear, multi-line message
- [ ] **Error Content**: Error message includes:
  - [ ] Clear problem statement
  - [ ] At least two resolution options (options parameter and environment variable)
  - [ ] Link to obtain API keys (https://openrouter.ai/keys)
  - [ ] Actionable next steps
- [ ] **Fail-Fast**: Error is thrown during construction, not on first API call
- [ ] **No Silent Failures**: API key `undefined` does not silently pass to SDK
- [ ] **Test Coverage**: At least one test verifies missing API key throws error
- [ ] **No Regression**: All existing tests continue to pass
- [ ] **No API Key Logging**: Error message does not contain or log the actual API key value

---

## Testing Strategy

### Unit Tests to Add/Update

**File**: `/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts`

**Test Cases**:

```typescript
describe('OpenRouterProvider', () => {
  describe('constructor', () => {
    it('should throw when apiKey is not provided and OPENROUTER_API_KEY is not set', () => {
      // Clear environment variable if set
      const original = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        expect(() => {
          new OpenRouterProvider({});
        }).toThrow();
      } finally {
        // Restore
        if (original) {
          process.env.OPENROUTER_API_KEY = original;
        }
      }
    });

    it('should throw when apiKey option is empty string', () => {
      expect(() => {
        new OpenRouterProvider({ apiKey: '' });
      }).toThrow();
    });

    it('should throw with descriptive error message', () => {
      delete process.env.OPENROUTER_API_KEY;

      expect(() => {
        new OpenRouterProvider({});
      }).toThrow(/API key is required/);
    });

    it('should not throw when apiKey option is provided', () => {
      expect(() => {
        new OpenRouterProvider({ apiKey: 'valid-test-key' });
      }).not.toThrow();
    });

    it('should not throw when OPENROUTER_API_KEY environment variable is set', () => {
      const original = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = 'env-test-key';

      try {
        expect(() => {
          new OpenRouterProvider({});
        }).not.toThrow();
      } finally {
        if (original) {
          process.env.OPENROUTER_API_KEY = original;
        } else {
          delete process.env.OPENROUTER_API_KEY;
        }
      }
    });

    it('should prioritize apiKey option over environment variable', () => {
      const original = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = 'env-key';

      try {
        expect(() => {
          new OpenRouterProvider({ apiKey: 'option-key' });
        }).not.toThrow();
        // Both should be valid, just verifying no throw
      } finally {
        if (original) {
          process.env.OPENROUTER_API_KEY = original;
        } else {
          delete process.env.OPENROUTER_API_KEY;
        }
      }
    });
  });
});
```

### Test Execution

After implementation, run tests:
```bash
npm test -- openrouter.test.ts
```

All tests should pass, including the new validation tests.

---

## Files to Modify

### Primary Files

1. **`/home/markschaake/projects/schaake-agents/src/openrouter.ts`**
   - Location: Lines 23-31 (constructor)
   - Change: Add API key validation before client initialization
   - Type: Implementation change

### Test Files

1. **`/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts`**
   - Add: Test cases for missing API key scenarios
   - Verify: Error is thrown with clear message
   - Type: Test addition

### Optional Files (For Future Consistency)

1. **`/home/markschaake/projects/schaake-agents/src/errors.ts`** (if created)
   - If the codebase creates custom error classes, consider creating an `OpenRouterError` class
   - For now, using standard `Error` is acceptable and sufficient

---

## Specification References

- **Requirement File**: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/requirements.md`
  - Section: "FR-2: API Key Validation" (lines 56-59)

- **Design File**: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/design.md`
  - Section: "Security Considerations - API Key Protection" (lines 390-398)
  - Section: "Testing Strategy - Error Case Tests" (lines 376-386)

---

## Phase Information

This task is part of **Phase 1 (Critical - 1-2 days)** as documented in requirements.md:

**Phase 1 includes**:
1. ✓ **Tool handler try-catch** (Task 001)
2. ✓ **API key validation** (Task 002 - this task)
3. ✓ **Basic integration tests** (Task 003)

Phase 1 focuses on critical fail-fast behaviors and basic stability before moving to advanced features in Phase 2 and 3.

---

## Important Notes

### Security Best Practices

- **Never log the actual API key** in error messages or logs
- The error message should guide users to obtain a key, not ask them to provide it in the message itself
- When testing, use dummy/test keys like `'test-key'`, `'test-api-key'`, or `'sk-test-xxx'` patterns

### Backward Compatibility

This change is **backward compatible**:
- Existing code that properly provides an API key will continue to work unchanged
- Only code that was previously silently failing (missing API key) will now throw an error at construction time
- This is an improvement because it catches errors earlier

### Developer Experience

The clear error message ensures developers can quickly resolve the issue by following the provided resolution steps.

---

## Implementation Checklist

- [ ] Read this task file completely
- [ ] Review the current `/home/markschaake/projects/schaake-agents/src/openrouter.ts` implementation
- [ ] Add API key validation to the constructor
- [ ] Craft descriptive error message with resolution steps
- [ ] Ensure error is thrown before client initialization
- [ ] Add unit tests for missing API key scenarios
- [ ] Run test suite: `npm test`
- [ ] Verify no tests regress
- [ ] Verify error message is clear and actionable
- [ ] Verify no API keys are logged
- [ ] Commit changes with clear message

---

## Related Tasks

- **Task 001**: Tool handler error handling (dependency-free prerequisite)
- **Task 003**: Basic integration tests (can be done in parallel)
- **Wave 1 Completion**: Finish FR-1, FR-2 (this task), basic tests for fail-fast behaviors

