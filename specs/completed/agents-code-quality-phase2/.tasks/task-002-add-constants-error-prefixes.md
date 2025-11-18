# Task 002: Add Constants and Error Message Prefixes

**Status:** Completed

**Wave:** 2
**Dependencies:** 001 (Standardize Zod Imports)
**Estimated Duration:** 20m
**Category:** setup

---

## Context

### Requirements
> Create `DEFAULT_MAX_TOOL_ITERATIONS = 4` constant... Add consistent prefixes to all error messages

> **FR-8: Standardize Error Messages** - Add consistent prefixes to all error messages (e.g., `createAgent:`, `OpenRouterProvider:`)

> **FR-9: Replace Magic Numbers with Constants** - Create `DEFAULT_MAX_TOOL_ITERATIONS = 4` constant and use constant in all three places in `agent.ts`

### Design
> export const DEFAULT_MAX_TOOL_ITERATIONS = 4; export const ERROR_PREFIXES = { AGENT: 'createAgent:', OPENROUTER: 'OpenRouterProvider:', EXTRACTION: 'extractDocument:', WEB_SEARCH: 'searchWithWeb:' } as const;

### Order of Operations
> 1. Fix Zod imports first (minimal risk, unblocks other work)
> 2. Add new test files (no risk, validates existing behavior)
> 3. Extract helper functions (medium risk, maintain existing tests)

---

## Implementation Details

### Part 1: Add Constants to agent.ts

Add the following constants at the top of `src/agent.ts` (after imports, before other code):

```typescript
/**
 * Default maximum number of tool iterations before agent stops
 */
export const DEFAULT_MAX_TOOL_ITERATIONS = 4;

/**
 * Error message prefixes for consistent error reporting
 */
export const ERROR_PREFIXES = {
  AGENT: "createAgent:",
  OPENROUTER: "OpenRouterProvider:",
  EXTRACTION: "extractDocument:",
  WEB_SEARCH: "searchWithWeb:",
} as const;
```

### Part 2: Replace Magic Number 4 in agent.ts

Find all occurrences of the magic number `4` used for `maxToolIterations` in `src/agent.ts` and replace with `DEFAULT_MAX_TOOL_ITERATIONS`:

**Locations to update:**
1. Default value in function parameter
2. Comparison in tool iteration loop check
3. Any other hardcoded `4` values related to tool iterations

Example change:
```typescript
// Before
const maxToolIterations = metadata?.maxToolIterations ?? 4;

// After
const maxToolIterations = metadata?.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
```

### Part 3: Update Error Messages in agent.ts

Update all `throw new Error()` statements to use the `ERROR_PREFIXES.AGENT` prefix:

**Search for patterns like:**
- `throw new Error("Agent exceeded..."`
- `throw new Error("Failed to parse..."`
- `throw new Error("Invalid tool..."`

**Update all to use:**
```typescript
throw new Error(`${ERROR_PREFIXES.AGENT} [original message]`);
```

**Common error messages in agent.ts to update:**
- "Agent exceeded maxToolIterations without finishing"
- "Failed to parse structured output as JSON"
- Any validation or runtime errors

### Part 4: Update Error Messages in openrouter.ts

Update all error messages in `src/openrouter.ts` to use `ERROR_PREFIXES.OPENROUTER`:

```typescript
throw new Error(`${ERROR_PREFIXES.OPENROUTER} [original message]`);
```

**Common error messages in openrouter.ts:**
- Provider-related errors
- SDK initialization or request errors
- Response parsing errors

### Part 5: Update Error Messages in extraction.ts

Update all error messages in `src/extraction.ts` to use `ERROR_PREFIXES.EXTRACTION`:

```typescript
throw new Error(`${ERROR_PREFIXES.EXTRACTION} [original message]`);
```

**Common error messages in extraction.ts:**
- File validation errors
- Schema validation errors
- Extraction failures

### Part 6: Update Error Messages in web-search.ts

Update all error messages in `src/web-search.ts` to use `ERROR_PREFIXES.WEB_SEARCH`:

```typescript
throw new Error(`${ERROR_PREFIXES.WEB_SEARCH} [original message]`);
```

**Common error messages in web-search.ts:**
- Search parameter validation errors
- API request errors
- Response handling errors

### Import Requirements

For files that need `ERROR_PREFIXES`:
- In `openrouter.ts`, `extraction.ts`, and `web-search.ts`, add at the top:
  ```typescript
  import { ERROR_PREFIXES } from "./agent.js";
  ```

---

## Acceptance Criteria

- [x] `DEFAULT_MAX_TOOL_ITERATIONS = 4` constant defined in `src/agent.ts`
- [x] `ERROR_PREFIXES` object defined with all four required prefixes in `src/agent.ts`
- [x] All occurrences of magic number `4` for tool iterations replaced with `DEFAULT_MAX_TOOL_ITERATIONS` in `src/agent.ts`
- [x] All error messages in `src/agent.ts` prefixed with `ERROR_PREFIXES.AGENT`
- [x] All error messages in `src/openrouter.ts` prefixed with `ERROR_PREFIXES.OPENROUTER`
- [x] All error messages in `src/extraction.ts` prefixed with `ERROR_PREFIXES.EXTRACTION`
- [x] All error messages in `src/web-search.ts` prefixed with `ERROR_PREFIXES.WEB_SEARCH`
- [x] Constants and error prefixes are exported from `src/agent.ts` for use in other modules
- [x] No TypeScript errors (build passes)
- [ ] All existing tests still pass
- [x] Error messages now consistently identify their source module

---

## Testing Notes

When implementing, be aware that existing tests may need to be updated to match the new error message format. The error message content should remain the same, only the prefix will be added.

Example test update:
```typescript
// Before
expect(() => { ... }).toThrow("Agent exceeded maxToolIterations");

// After
expect(() => { ... }).toThrow("createAgent: Agent exceeded maxToolIterations");
```

---

## Agent Notes

Implementation completed successfully. All constants added and error messages updated with prefixes.

---

## Progress Log

### 2025-01-XX - Task Completed

**Files Modified:**
- `src/agent.ts` - Added constants, replaced magic numbers, updated 8 error messages
- `src/openrouter.ts` - Added import, updated 5 error messages
- `src/extraction.ts` - Added import, updated 5 error messages
- `src/web-search.ts` - Added import, updated 4 error messages

**Constants Added:**
- `DEFAULT_MAX_TOOL_ITERATIONS = 4` - Exported constant for tool iteration limit
- `ERROR_PREFIXES` - Object with AGENT, OPENROUTER, EXTRACTION, WEB_SEARCH prefixes

**Magic Number Replacements (3 occurrences):**
1. `run()` function - `maxToolIterations = DEFAULT_MAX_TOOL_ITERATIONS`
2. `runWithHistory()` function - `maxToolIterations = DEFAULT_MAX_TOOL_ITERATIONS`
3. `stream()` function - `maxToolIterations = DEFAULT_MAX_TOOL_ITERATIONS`

**Error Messages Updated (22 total):**
- agent.ts: 8 error messages prefixed with `${ERROR_PREFIXES.AGENT}`
- openrouter.ts: 5 error messages prefixed with `${ERROR_PREFIXES.OPENROUTER}`
- extraction.ts: 5 error messages prefixed with `${ERROR_PREFIXES.EXTRACTION}`
- web-search.ts: 4 error messages prefixed with `${ERROR_PREFIXES.WEB_SEARCH}`

**Build Verification:** PASSED - TypeScript compilation successful with no errors
