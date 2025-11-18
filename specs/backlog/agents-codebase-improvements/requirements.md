# Agents Codebase Improvements - Requirements

## Project Scope

**Affected Projects/Packages**:

- [x] `src/agent.ts` - Error handling, type safety, API improvements
- [x] `src/openrouter.ts` - Type safety, validation
- [x] `src/types.ts` - Type definitions, API design
- [x] `tests/` - Comprehensive test coverage

**Scope Type**: Single Project

**Primary Project**: @schaake/agents

---

## Overview

Improve the @schaake/agents codebase based on comprehensive code review findings. Focus areas include error handling (especially unhandled tool exceptions), type safety improvements, API enhancements (message history access, streaming support), and comprehensive test coverage. These improvements will move the library from prototype to production-grade quality.

---

## User Stories

### US-1: Robust Error Handling
**As a** developer using @schaake/agents
**I want to** have tools fail gracefully with informative errors
**So that** my agent can recover and inform the model of failures instead of crashing

### US-2: Debugging Agent Behavior
**As a** developer debugging agent issues
**I want to** access the full conversation history after a run
**So that** I can understand the agent's reasoning and identify problems

### US-3: Real-time Streaming
**As a** developer building interactive UIs
**I want to** stream agent responses in real-time
**So that** users see immediate feedback instead of waiting for full completion

### US-4: Confidence in Production
**As a** developer deploying to production
**I want to** have comprehensive test coverage
**So that** I can be confident the library works correctly

---

## Functional Requirements

### FR-1: Tool Handler Error Handling
- Wrap tool handler execution in try-catch
- Report errors back to model as tool results (not crashes)
- Log handler errors with context
- Allow agent to continue after tool failures

### FR-2: API Key Validation
- Validate API key exists at OpenRouterProvider construction time
- Throw clear error message with resolution steps
- Fail fast instead of silent failure on first API call

### FR-3: Message History Access
- Return conversation history from `run()` method
- Include all messages: system, user, assistant, tool
- Provide iteration count and metadata
- Support both simple (`run()`) and detailed (`runWithHistory()`) APIs

### FR-4: Streaming Support
- Implement `stream()` method on agents
- Accumulate deltas into complete messages
- Provide `finalResult()` to get history after streaming
- Support tool calling during streaming

### FR-5: Type Safety Improvements
- Replace `any` types with concrete interfaces
- Create `OpenRouterResponse` interface
- Create `ToolCallResult` type
- Remove unsafe type assertions where possible

### FR-6: Enhanced Logging API
- Add `onEvent` callback to run options
- Replace indirect `metadata.logger` pattern
- Type events properly with discriminated unions

### FR-7: Input/Output Validation
- Validate tool arguments against schema before calling handler
- Validate responseFormat schema structure before API call
- Improve markdown JSON extraction robustness

---

## Non-Functional Requirements

### NFR-1: Test Coverage
- Achieve >80% code coverage
- All error paths have tests
- All edge cases documented and tested

### NFR-2: Type Safety
- No `any` types in public API
- All SDK responses properly typed
- Compile-time safety for common mistakes

### NFR-3: Documentation
- All public APIs documented with JSDoc
- Error handling guide in README
- Streaming usage examples

### NFR-4: Backward Compatibility
- Existing `run()` API continues to work unchanged
- New features are additive, not breaking
- Deprecation warnings for patterns to be removed

---

## Acceptance Criteria

**Overall acceptance criteria for this specification:**

- [ ] Tool handler exceptions are caught and reported to model, not thrown
- [ ] Missing API key throws clear error at construction time
- [ ] `runWithHistory()` returns full message array after completion
- [ ] `stream()` method works with tool-calling agents
- [ ] No `any` types in public-facing interfaces
- [ ] Integration tests cover basic run, tool calling, multi-step, and errors
- [ ] Test coverage exceeds 80%
- [ ] README documents error handling patterns
- [ ] All existing tests continue to pass

---

## Out of Scope

Explicitly list what you are NOT building in this spec:

- ❌ Multi-provider support (only OpenRouter) - future spec
- ❌ Conversation memory/persistence - future spec
- ❌ Retry logic with exponential backoff - future spec
- ❌ Rate limiting handling - future spec
- ❌ Cost tracking/token counting - future spec

---

## Notes

### Dependencies
- OpenRouter SDK types (may need to track SDK updates)
- Zod v4 for schema validation

### Assumptions
- Streaming API follows OpenAI SSE format via OpenRouter
- Tool handlers are async functions
- Users want TypeScript-first experience

### Open Questions
- [ ] Should `run()` return `{ output, messages }` or keep returning just output?
- [ ] Should streaming accumulate tool calls or emit them as chunks?
- [ ] What's the right granularity for onEvent callback events?

### Implementation Phases

**Phase 1 (Critical - 1-2 days)**:
1. Tool handler try-catch
2. API key validation
3. Basic integration tests

**Phase 2 (High - 2-3 days)**:
4. Type safety improvements
5. Message history access
6. Expanded test coverage

**Phase 3 (Medium - 2-3 days)**:
7. Streaming support
8. Event-based logging
9. Documentation

### Source
Based on comprehensive code review by subagent analyzing:
- src/types.ts
- src/agent.ts
- src/openrouter.ts
- src/tools.ts
- tests/*.test.ts
