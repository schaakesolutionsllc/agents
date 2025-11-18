# Agents Code Quality Phase 2 - Requirements

## Project Scope

**Affected Projects/Packages**:

- [x] `src/agent.ts` - Major refactoring to eliminate DRY violations
- [x] `src/openrouter.ts` - Extract helper functions, improve type safety
- [x] `src/extraction.ts` - Fix Zod imports
- [x] `src/web-search.ts` - Fix Zod imports
- [x] `tests/e2e/` - Refactor e2e test infrastructure
- [x] `src/types.ts` - Improve type definitions, reduce `any` usage
- [x] `eslint.config.js` - Re-enable type safety rules
- [x] `tests/` - Add missing test coverage

**Scope Type**: Single Project

**Primary Project**: @schaakesolutionsllc/agents

---

## Overview

This spec addresses code quality issues identified in two independent code reviews. The primary goals are to eliminate significant code duplication in `agent.ts`, standardize Zod imports, improve type safety by reducing `any` usage and re-enabling ESLint rules, and achieve comprehensive test coverage for all modules.

---

## User Stories

### US-1: Maintainable Codebase
**As a** developer maintaining this library
**I want to** have DRY, well-organized code
**So that** I can make changes confidently without updating duplicate code in multiple places

### US-2: Type-Safe Development
**As a** developer using this library
**I want to** strong TypeScript typing throughout
**So that** I catch errors at compile time rather than runtime

### US-3: Comprehensive Test Coverage
**As a** developer contributing to this library
**I want to** comprehensive test coverage
**So that** I can refactor with confidence that I haven't broken functionality

---

## Functional Requirements

### FR-1: Standardize Zod Imports
- All files must use consistent Zod import path
- Determine whether to use `zod` or `zod/v4` based on required features
- Update `extraction.ts`, `web-search.ts`, and `agent.ts` to use same import

### FR-2: Refactor agent.ts to Eliminate DRY Violations
- Extract `createContext()` helper function for context creation (~8 lines duplicated)
- Extract `buildResponseFormat()` helper for response format generation (~15 lines duplicated)
- Extract `parseStructuredOutput()` helper for JSON parsing with markdown extraction (~25 lines duplicated)
- Extract common provider call configuration building (~20 lines duplicated)
- Reduce total duplicated code from ~600 lines to near zero

### FR-3: Refactor openrouter.ts Helper Functions
- Extract `buildSDKProviderOptions()` from duplicated provider options mapping
- Extract `buildSDKRequest()` from duplicated SDK request building
- Improve type safety by reducing `any` casts

### FR-4: Improve Type Definitions
- Replace `ToolHandler = (args: any, ctx: AgentContext) => Promise<any>` with generic version
- Add proper typing for SDK response types in `openrouter.ts`
- Reduce total `any` usage from 40+ to under 10
- Export useful SDK response types for consumers

### FR-5: Add Input Validation for Tool Arguments
- Validate tool arguments against their JSON schemas at runtime
- Provide clear error messages for validation failures
- Prevent unexpected tool behavior from invalid LLM outputs

### FR-6: Re-enable ESLint Type Safety Rules
- Gradually re-enable disabled TypeScript safety rules
- Start with `warn` level to identify issues
- Fix underlying type issues to achieve clean lint

### FR-7: Refactor E2E Test Infrastructure
- Move `test-live.ts` and `test-multi-step.ts` into `tests/e2e/` directory
- Split into individually runnable test files (basic-chat, tool-calling, streaming, etc.)
- Add Vitest configuration for e2e tests with pattern matching
- Skip gracefully when `OPENROUTER_API_KEY` not set
- Add npm scripts for running e2e tests individually or as suite

### FR-8: Standardize Error Messages
- Add consistent prefixes to all error messages (e.g., `createAgent:`, `OpenRouterProvider:`)
- Ensure all errors include context about where they occurred

### FR-9: Replace Magic Numbers with Constants
- Create `DEFAULT_MAX_TOOL_ITERATIONS = 4` constant
- Use constant in all three places in `agent.ts`

---

## Non-Functional Requirements

### NFR-1: Code Quality
- No duplicated code blocks over 10 lines
- All helper functions have JSDoc documentation
- Consistent coding style throughout

### NFR-2: Type Safety
- No more than 10 uses of `any` type in entire codebase
- All public APIs have complete type definitions
- ESLint type safety rules enabled without errors

### NFR-3: Test Infrastructure
- E2E tests organized in `tests/e2e/` directory
- Tests individually runnable via pattern matching
- Graceful skip when API key not available
- Clear test output with pass/fail status

### NFR-4: Backward Compatibility
- All existing public APIs must remain unchanged
- No breaking changes to function signatures
- Existing tests must continue to pass

---

## Acceptance Criteria

**Overall acceptance criteria for this specification:**

- [ ] All Zod imports use consistent path across all files
- [ ] `agent.ts` has no duplicated code blocks over 10 lines
- [ ] Helper functions extracted: `createContext`, `buildResponseFormat`, `parseStructuredOutput`
- [ ] `openrouter.ts` helper functions extracted: `buildSDKProviderOptions`, `buildSDKRequest`
- [ ] `any` usage reduced to under 10 occurrences
- [ ] `ToolHandler` type is generic with proper type parameters
- [ ] Tool argument validation against JSON schemas implemented
- [ ] ESLint type safety rules enabled and passing
- [ ] E2E tests refactored into `tests/e2e/` directory with individual test files
- [ ] Tests runnable individually with `npm run test:e2e -- --grep "pattern"`
- [ ] All error messages have consistent prefixes
- [ ] `DEFAULT_MAX_TOOL_ITERATIONS` constant used instead of magic number
- [ ] All existing tests pass
- [ ] Build completes successfully
- [ ] No TypeScript errors

---

## Out of Scope

Explicitly list what you are NOT building in this spec:

- ❌ New features (cancellation support, conversation continuation, etc.) - focus is on quality
- ❌ Zod-aware tool definitions - would require API changes
- ❌ Tool timeouts - feature addition, not quality improvement
- ❌ Batch operations - feature addition
- ❌ Documentation updates beyond JSDoc - focus on code
- ❌ Unit tests for API wrapper modules (embeddings, discovery, extraction, web-search) - would just test mocks

---

## Notes

### Dependencies
- Existing test infrastructure (Vitest)
- Current ESLint and TypeScript configuration
- OpenRouter SDK types

### Assumptions
- Zod v4 features are not required (can standardize on `import { z } from "zod"`)
- Refactoring can be done incrementally without breaking existing functionality
- Mock factories in tests can be extended for new test suites

### Open Questions
- [ ] Should we use AJV or Zod for runtime tool argument validation?
- [ ] What's the minimum `any` usage that's acceptable (some SDK interactions may require it)?

### Review Findings Reference
This spec addresses issues from two independent code reviews:
1. Initial review identified: DRY violations, Zod imports, inconsistent token fields, `any` casts
2. Second review confirmed above and added: ESLint disables, missing tests, validation gaps
