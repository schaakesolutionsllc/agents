# Task 005: Replace Unsafe Type Assertions with Proper Typing

## Task Metadata

| Property | Value |
|----------|-------|
| **Task ID** | 005 |
| **Title** | Replace unsafe type assertions with proper typing |
| **Category** | Type Safety Enhancement |
| **Wave** | 2 (High Priority) |
| **Estimated Duration** | 30 minutes |
| **Dependencies** | Task 004 (Tool handler error handling) |
| **Status** | Pending |

---

## Objective

Replace all unsafe `as any` type assertions in `src/openrouter.ts` and `src/agent.ts` with properly typed interfaces. Add null checks for response properties and throw typed errors when expected data is missing. This ensures compile-time safety and prevents runtime surprises from missing or malformed API responses.

---

## Context

### Requirement: NFR-2 - Type Safety

From the specification:
- **No `any` types in public API**: All publicly exposed interfaces must have concrete types
- **All SDK responses properly typed**: SDK responses from OpenRouter must use typed interfaces instead of unsafe assertions
- **Compile-time safety for common mistakes**: TypeScript should catch missing properties and invalid operations at compile time

### Design Pattern

**Before (Current - Unsafe)**:
```typescript
// src/openrouter.ts
const choice = (response as any).choices[0];
// Problem: No compile-time safety, choice could be undefined
```

**After (Improved - Type Safe)**:
```typescript
// src/openrouter.ts
const typedResponse = response as OpenRouterChatResponse;
const choice = typedResponse.choices[0];
if (!choice) {
  throw new OpenRouterError('No choices in response');
}
// Solution: Proper typing with null checks, typed errors
```

### New Type Definitions

The design document defines these core types that should be used:

```typescript
// From types.ts (to be added or updated)

export interface OpenRouterChoice {
  index: number;
  finishReason: string | null;
  message: {
    role: 'assistant';
    content: string | null;
    toolCalls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
}

export interface OpenRouterChatResponse {
  id: string;
  choices: OpenRouterChoice[];
  created: number;
  model: string;
  object: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type ToolHandlerResult = Record<string, unknown> | void;
```

### Current Unsafe Code Locations

**File: `src/openrouter.ts`**
- Line 46: `messages: req.messages as any` - unsafe cast in SDK request
- Line 58: `(response as any).choices[0]` - unsafe response parsing
- Lines 65-73: Tool call parsing with `as any` casts

**File: `src/agent.ts`**
- Line 53: `toolCalls: any[]` - tool calls parameter type
- Lines 64-73: Tool definition lookup without proper typing
- Line 100: `def.handler(args, ctx)` - result not typed as ToolHandlerResult

---

## Implementation Steps

### Step 1: Add Type Definitions to `src/types.ts`

Add the missing type interfaces that define the OpenRouter API response structure:

1. Create `OpenRouterChoice` interface with proper structure
2. Create `OpenRouterChatResponse` interface
3. Create `ToolHandlerResult` type alias
4. Ensure all nested properties are properly typed (avoid `any`)
5. Mark optional properties with `?` (e.g., `usage?`)

**Verification**:
- [ ] TypeScript compiles without errors
- [ ] New types are exported from types.ts
- [ ] No `any` types in the new definitions

### Step 2: Update `src/openrouter.ts` - Response Type Safety

Replace unsafe assertions in the `chat()` method:

1. **Type the response** (line 56):
   - Change `const response = await this.client.chat.send(sdkRequest);`
   - Add explicit typing as `OpenRouterChatResponse`

2. **Replace first unsafe cast** (line 58):
   - Replace: `const choice = (response as any).choices[0];`
   - With proper typing: `const typedResponse = response as OpenRouterChatResponse;`
   - Add null check: `if (!choice) { throw new OpenRouterError(...) }`

3. **Type tool call parsing** (lines 64-73):
   - Replace inline `as any` casts for tool calls
   - Use proper interface for tool call iteration
   - Type the `tc` parameter explicitly as `ChatToolCall`

4. **Type content array handling** (lines 82-85):
   - Type the `item` parameter in array map
   - Use proper union type for content items

5. **Add custom error class**:
   - Consider creating `OpenRouterError` class (extends Error)
   - Or use a typed error function that returns typed errors
   - Ensure error messages are clear and actionable

**Verification**:
- [ ] All unsafe `(... as any)` casts are removed
- [ ] Response parsing has null checks for choice
- [ ] Tool call properties are properly typed
- [ ] Content array items are typed
- [ ] TypeScript compiles with strict mode

### Step 3: Update `src/agent.ts` - Tool Call Type Safety

Replace unsafe types in tool execution and handling:

1. **Update `runToolCalls` function signature** (line 53):
   - Change: `toolCalls: any[]`
   - To: `toolCalls: ChatToolCall[]` (import from types)

2. **Improve tool definition lookup** (lines 58-79):
   - Type `toolCall` as `ChatToolCall` (already defined in types.ts)
   - Ensure `toolCall.function` is properly accessed with null coalescing
   - Add proper error typing for missing tools

3. **Type tool handler result** (line 100):
   - Change: `const result = await def.handler(args, ctx);`
   - Ensure result is typed as `ToolHandlerResult`
   - Update line 107: `content: JSON.stringify(result ?? {}),` respects the type

4. **Add null safety for tool handler execution**:
   - Wrap tool handler call in try-catch (defer to Task 001 if needed)
   - Ensure handler result is properly validated

5. **Fix `any` in helper function** (line 53 in toChatTools):
   - Signature uses `ToolDefinition[]` - verify parameter is properly typed

**Verification**:
- [ ] All function parameters are properly typed
- [ ] No `any` types in function signatures
- [ ] Tool call access patterns are safe (null coalescing where needed)
- [ ] TypeScript compiles with strict mode

### Step 4: Remove Remaining `as any` Casts

Scan both files for any remaining unsafe casts:

1. Search for pattern: `as any`
2. For each occurrence, either:
   - Replace with proper interface (preferred)
   - Add explicit type annotation instead of inline cast
   - Document if keeping (with justification comment)

**Files to scan**:
- `src/openrouter.ts` - should be 0 occurrences
- `src/agent.ts` - should be 0 occurrences

**Verification**:
- [ ] No `as any` patterns remain in either file
- [ ] All casts are replaced with interfaces or type annotations
- [ ] Code comments explain any necessary type compromises

### Step 5: Verify Type Safety

Ensure the TypeScript compilation and type checking passes:

1. Run TypeScript compiler: `npx tsc --noEmit`
2. Check for any type errors in strict mode
3. Verify no implicit `any` types exist
4. Run linter if configured

**Verification**:
- [ ] TypeScript compiles with zero errors
- [ ] No implicit `any` warnings
- [ ] Strict mode enabled (check tsconfig.json)
- [ ] IDE shows no type errors

---

## Acceptance Criteria

### Functional Acceptance

- [ ] **Type Safety**: All unsafe `as any` casts removed from `src/openrouter.ts` and `src/agent.ts`
- [ ] **Proper Typing**: Response handling uses `OpenRouterChatResponse` interface
- [ ] **Null Checks**: Response properties have null checks before access
- [ ] **Error Handling**: Missing choices or invalid responses throw typed errors
- [ ] **No Type Regression**: Existing functionality remains unchanged

### Code Quality Acceptance

- [ ] **TypeScript Strict Mode**: Code compiles without errors
- [ ] **No Implicit Any**: No implicit `any` types in public APIs
- [ ] **Proper Exports**: New types exported from `src/types.ts`
- [ ] **Code Comments**: Any remaining type compromises are documented
- [ ] **Consistent Style**: Type definitions follow project conventions

### Testing Acceptance

- [ ] **Existing Tests Pass**: All current tests continue to pass
- [ ] **Type Coverage**: Types are testable (TypeScript catches errors at compile time)
- [ ] **Error Cases**: Error handling for missing response data is covered

### Documentation Acceptance

- [ ] **Type Documentation**: New types are clear and well-named
- [ ] **Comments**: Complex type conversions have explanatory comments
- [ ] **Examples**: If applicable, usage examples show typed patterns

---

## Files to Modify

### Primary Files

| File | Changes | Priority |
|------|---------|----------|
| `src/types.ts` | Add `OpenRouterChoice`, `OpenRouterChatResponse`, `ToolHandlerResult` interfaces | Critical |
| `src/openrouter.ts` | Replace unsafe `as any` with typed interfaces, add null checks | Critical |
| `src/agent.ts` | Replace unsafe `any` in function signatures with proper types | High |

### Related Files (May Need Updates)

- `src/errors.ts` - If creating typed error classes (Task 001 may define this)
- `tests/*.test.ts` - May need type updates in test files if signatures change
- `src/index.ts` - Export new types if needed

---

## Key Implementation Notes

### Type Definition Best Practices

1. **Use Interfaces for Structural Types**: OpenRouter response structure should be an interface
2. **Mark Optional Properties**: Use `?` for properties that may not exist (e.g., `usage?`, `toolCalls?`)
3. **Avoid Union Types Where Possible**: Keep types concrete and specific
4. **Document Nullable Properties**: Use `| null` explicitly rather than optional when null is expected

### Error Handling Pattern

When required properties are missing, throw typed errors:

```typescript
const choice = typedResponse.choices[0];
if (!choice) {
  throw new Error('OpenRouterProvider: No choices in response');
  // Or if using OpenRouterError class:
  // throw new OpenRouterError('No choices in response');
}
```

### Null Safety in Tool Calls

```typescript
// GOOD: Explicit null coalescing
const argsJson = toolCall.function?.arguments ?? "{}";

// AVOID: Unsafe optional chaining without fallback
const argsJson = toolCall.function?.arguments; // Could be undefined
```

### Testing Type Safety

- Use `TypeScript` compiler checks rather than runtime tests for type safety
- Focus runtime tests on error handling and edge cases
- Consider using type-level tests if available in your test framework

---

## Dependencies and Prerequisites

### Completed Tasks
- **Task 004**: Tool handler error handling should be completed first (allows us to reference error handling patterns)

### Skills/Knowledge Required
- TypeScript interface and type definitions
- OpenRouter SDK response structure
- Zod types and JSON schema conversion
- Error handling in TypeScript

### Tools/Environment
- TypeScript compiler (v5.x or later)
- IDE with TypeScript support
- Node.js 18+ for running type checks

---

## Risk Assessment

### Low Risk
- Adding type definitions to `types.ts` - purely additive
- Replacing `as any` with proper interfaces - improves safety
- Adding null checks - cannot break existing code

### Potential Issues
1. **Breaking Changes**: If changing function signatures, existing callers may break
   - Mitigation: Only update internal functions or follow semver for public APIs
   - Verify all call sites after changes

2. **SDK Compatibility**: If SDK response structure differs from assumptions
   - Mitigation: Verify against actual OpenRouter API responses
   - Check SDK types if available

3. **Type Definition Mismatch**: If types don't match actual response format
   - Mitigation: Test with real API calls
   - Add runtime validation if needed

---

## Rollback Plan

If issues arise:

1. **Revert to Previous Commit**: `git revert <commit-hash>`
2. **Partial Rollback**: If some types work but others don't:
   - Keep working type definitions
   - Revert problem areas to use `as any` temporarily
   - Create follow-up task to fix remaining issues

3. **Temporary Workarounds**:
   - Can use `const response = await this.client.chat.send(sdkRequest) as OpenRouterChatResponse;` if SDK typing is incomplete
   - Add `// @ts-ignore` comments only as last resort with explanation

---

## Success Metrics

| Metric | Target | Validation |
|--------|--------|-----------|
| Unsafe `any` casts removed | 100% | grep -r "as any" src/ |
| TypeScript compilation | 0 errors | npx tsc --noEmit |
| Test pass rate | 100% | npm test |
| Type inference | No implicit any | tsconfig strict mode |
| Code coverage maintained | ≥ Current | npm run coverage |

---

## Additional Resources

### Specification References
- **Requirements**: NFR-2 (Type Safety) from `requirements.md`
- **Design**: Type Safety Improvements section from `design.md`
- **Code Locations**: Lines 46, 58, 65-73 in openrouter.ts; Lines 53, 64-73, 100 in agent.ts

### Type Definition References
- OpenRouter SDK: `@openrouter/sdk` types
- Zod Documentation: https://zod.dev/
- TypeScript Handbook: https://www.typescriptlang.org/docs/

### Related Tasks
- **Task 001**: Tool Handler Error Handling (error classes defined here)
- **Task 002**: API Key Validation
- **Task 004**: Completed prerequisite for this task
- **Task 006**: Message History Access (may use same types)

---

## Implementation Checklist

Use this checklist to track progress through the implementation:

### Pre-Implementation
- [ ] Read this task file completely
- [ ] Review current code in `src/openrouter.ts` and `src/agent.ts`
- [ ] Review type definitions in `src/types.ts`
- [ ] Understand OpenRouter SDK response structure

### Type Definitions (Step 1)
- [ ] Add `OpenRouterChoice` interface to types.ts
- [ ] Add `OpenRouterChatResponse` interface to types.ts
- [ ] Add `ToolHandlerResult` type to types.ts
- [ ] Verify all types are exported
- [ ] TypeScript compiles successfully

### OpenRouter Provider Updates (Step 2)
- [ ] Update response typing in `chat()` method
- [ ] Replace unsafe choice casting with typed access
- [ ] Add null check for choice
- [ ] Type tool call parsing
- [ ] Type content array items
- [ ] Remove all `as any` from this file

### Agent Updates (Step 3)
- [ ] Update `runToolCalls` function signature
- [ ] Type `toolCall` as `ChatToolCall`
- [ ] Add proper error handling for tool lookup
- [ ] Type tool handler result
- [ ] Remove all unsafe `any` types

### Final Verification (Step 4-5)
- [ ] Search for remaining `as any` patterns - should find none
- [ ] Run TypeScript compiler - should compile cleanly
- [ ] Run existing tests - should all pass
- [ ] Check for implicit `any` warnings

### Post-Implementation
- [ ] Commit changes with clear message
- [ ] Verify git diff shows only expected changes
- [ ] Mark task as completed in tracking system
