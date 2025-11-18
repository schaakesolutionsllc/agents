# Task 005: Extract Common Provider Call Configuration in agent.ts

**Status:** Complete

**Wave:** 3
**Dependencies:** Task 002
**Estimated Duration:** 30m
**Category:** refactor

---

## Context

### Requirements
> Extract common provider call configuration building (~20 lines duplicated) shared between run(), runWithHistory(), and stream() methods.
>
> Extract common provider call configuration building (~20 lines duplicated)

### Design
> Common functionality extracted to reusable helpers

---

## Overview

The `agent.ts` file has significant code duplication in how it builds and passes configuration to the provider's `chat()` and `chatStream()` methods. The same set of parameters is repeated nearly identically in three different locations:

1. **`run()` method** (lines 402-424)
2. **`runWithHistory()` method** (lines 587-609)
3. **`stream()` method's `generateChunks()` generator** (lines 763-785)

Each location builds the same provider call with:
- Model configuration (model, models)
- Message array
- Chat tools
- Stream flag
- Sampling parameters (temperature, topP, frequencyPenalty, presencePenalty, seed, stop)
- Token limit configuration (maxTokens)
- Metadata and response format
- Provider routing options
- Reasoning parameters

This duplication violates the DRY principle and makes maintenance difficult. If provider parameters need to be added or modified, the change must be made in three separate locations.

---

## Implementation Details

### Step 1: Create Helper Function

Create a new helper function `buildProviderCallConfig()` that encapsulates the provider call parameter building logic.

**Location:** Add to `src/agent.ts` before `createAgent()` function (around line 330)

**Function Signature:**
```typescript
/**
 * Builds the complete configuration object for a provider chat call.
 * Consolidates all sampling, token, metadata, and routing parameters
 * into a single call configuration object.
 *
 * @template O - The output type of the agent
 * @param config - The agent configuration
 * @param messages - The message array to send to the provider
 * @param chatTools - The ChatTool[] or undefined for tool calls
 * @param stream - Whether this is a streaming call
 * @param responseFormat - Response format for structured outputs
 * @param metadata - Runtime metadata for this execution
 * @returns Complete provider call configuration object
 *
 * @internal
 */
function buildProviderCallConfig<O>(
  config: AgentConfig<unknown, O>,
  messages: Message[],
  chatTools: ChatTool[] | undefined,
  stream: boolean,
  responseFormat: ResponseFormat | undefined,
  metadata: Record<string, unknown> | undefined
): Parameters<typeof config.model.provider.chat>[0] {
  return {
    model: config.model.model,
    models: config.model.models,
    messages,
    tools: chatTools,
    stream,
    // Sampling parameters
    temperature: config.model.temperature,
    topP: config.model.topP,
    frequencyPenalty: config.model.frequencyPenalty,
    presencePenalty: config.model.presencePenalty,
    seed: config.model.seed,
    stop: config.model.stop,
    // Token limits
    maxTokens: config.model.maxTokens,
    // Metadata and output
    metadata,
    responseFormat,
    // Provider routing
    providerOptions: config.model.providerOptions,
    // Reasoning
    reasoning: config.model.reasoning,
  };
}
```

### Step 2: Update `run()` Method

Replace the provider call configuration in the `run()` method (lines 402-424) with a call to the new helper.

**Current Code (lines 402-424):**
```typescript
const res = await config.model.provider.chat({
  model: config.model.model,
  models: config.model.models,
  messages,
  tools: chatTools,
  stream: false,
  // Sampling parameters
  temperature: config.model.temperature,
  topP: config.model.topP,
  frequencyPenalty: config.model.frequencyPenalty,
  presencePenalty: config.model.presencePenalty,
  seed: config.model.seed,
  stop: config.model.stop,
  // Token limits
  maxTokens: config.model.maxTokens,
  // Metadata and output
  metadata,
  responseFormat,
  // Provider routing
  providerOptions: config.model.providerOptions,
  // Reasoning
  reasoning: config.model.reasoning,
});
```

**Replacement:**
```typescript
const res = await config.model.provider.chat(
  buildProviderCallConfig(
    config,
    messages,
    chatTools,
    false,
    responseFormat,
    metadata
  )
);
```

### Step 3: Update `runWithHistory()` Method

Replace the provider call configuration in the `runWithHistory()` method (lines 587-609) with a call to the new helper.

**Current Code (lines 587-609):**
```typescript
const res = await config.model.provider.chat({
  model: config.model.model,
  models: config.model.models,
  messages,
  tools: chatTools,
  stream: false,
  // Sampling parameters
  temperature: config.model.temperature,
  topP: config.model.topP,
  frequencyPenalty: config.model.frequencyPenalty,
  presencePenalty: config.model.presencePenalty,
  seed: config.model.seed,
  stop: config.model.stop,
  // Token limits
  maxTokens: config.model.maxTokens,
  // Metadata and output
  metadata,
  responseFormat,
  // Provider routing
  providerOptions: config.model.providerOptions,
  // Reasoning
  reasoning: config.model.reasoning,
});
```

**Replacement:**
```typescript
const res = await config.model.provider.chat(
  buildProviderCallConfig(
    config,
    messages,
    chatTools,
    false,
    responseFormat,
    metadata
  )
);
```

### Step 4: Update `stream()` Method

Replace the provider call configuration in the `stream()` method's `generateChunks()` generator (lines 763-785) with a call to the new helper.

**Current Code (lines 763-785):**
```typescript
const streamIterable = config.model.provider.chatStream({
  model: config.model.model,
  models: config.model.models,
  messages,
  tools: chatTools,
  stream: true,
  // Sampling parameters
  temperature: config.model.temperature,
  topP: config.model.topP,
  frequencyPenalty: config.model.frequencyPenalty,
  presencePenalty: config.model.presencePenalty,
  seed: config.model.seed,
  stop: config.model.stop,
  // Token limits
  maxTokens: config.model.maxTokens,
  // Metadata and output
  metadata,
  responseFormat,
  // Provider routing
  providerOptions: config.model.providerOptions,
  // Reasoning
  reasoning: config.model.reasoning,
});
```

**Replacement:**
```typescript
const streamIterable = config.model.provider.chatStream(
  buildProviderCallConfig(
    config,
    messages,
    chatTools,
    true,
    responseFormat,
    metadata
  )
);
```

### Step 5: Verification

After extraction, verify:
1. All three methods use the new helper function
2. The helper function is correctly positioned in the file
3. No duplication of provider call configuration remains
4. The functionality is identical to the previous code

---

## Acceptance Criteria

- [x] New helper function `buildProviderCallConfig()` is created and properly documented
- [x] `run()` method uses the helper function for provider call configuration
- [x] `runWithHistory()` method uses the helper function for provider call configuration
- [x] `stream()` method uses the helper function for provider call configuration
- [x] Helper function signature correctly accepts all necessary parameters
- [x] Helper function returns properly typed configuration object
- [x] All three methods pass correct `stream` parameter (false, false, true respectively)
- [x] No provider call configuration duplication remains in the file
- [x] All existing tests continue to pass
- [x] TypeScript compiles without errors
- [x] No functional changes to agent behavior

---

## Technical Notes

### Type Safety

The helper function should be properly typed. Note that:
- `config.model.provider.chat()` and `config.model.provider.chatStream()` likely accept slightly different parameter objects
- The function signature uses `Parameters<typeof config.model.provider.chat>[0]` to get the correct type
- Alternatively, you may need to create a union type or use a more flexible approach if the streaming version has different parameter types

### Stream Parameter

The critical difference between the three locations is the `stream` parameter:
- `run()`: `stream: false`
- `runWithHistory()`: `stream: false`
- `stream()` generator: `stream: true`

This must be accurately captured by the helper function parameter.

### Metadata Parameter

The `metadata` parameter is passed through from the runtime `options` parameter and is the same in all three contexts, so it can be safely extracted.

### Provider Routing

The `config.model.providerOptions` is part of the agent configuration and applies to all calls from the same agent instance, so extraction is straightforward.

---

## Risk Assessment

### Low Risk
- Helper function is purely refactoring of existing logic
- No behavioral changes to agent functionality
- All parameters are already available in all three call sites
- Existing tests should continue to pass without modification

### Considerations
1. **Type inference**: Ensure TypeScript properly infers the return type of the helper
2. **Performance**: Extraction should have negligible performance impact
3. **Error messages**: If any errors occur in the provider calls, stack traces will show the helper function

---

## Dependencies

**Prerequisite Tasks:**
- Task 002 (Implement other helper functions in agent.ts)

**Blocking This Task:**
- None - can proceed independently

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `src/agent.ts` | Add `buildProviderCallConfig()` helper, update three provider call sites | Critical |

---

## Success Metrics

| Metric | Target | Validation |
|--------|--------|-----------|
| Duplication eliminated | 100% | No identical provider config blocks remain |
| Helper reuse | 3/3 locations | All three call sites use the helper |
| Tests passing | 100% | npm test passes all tests |
| TypeScript compilation | 0 errors | npx tsc --noEmit |
| Type safety | No regression | All types properly inferred |

---

## Agent Notes

- Added `ChatRequest` and `ResponseFormat` to imports from types.js
- Function uses generic types `<I, O>` to properly type the config parameter
- Returns `ChatRequest` type which is used by both `chat()` and `chatStream()` methods
- Fixed pre-existing type issue in openrouter.ts where `buildSDKRequest` expected `Record<string, unknown>` for parameters but received `Record<string, any>`

---

## Progress Log

- **2025-01-18**: Task completed
  - Created `buildProviderCallConfig<I, O>()` helper function with full JSDoc documentation
  - Updated `run()` method to use helper (line 578)
  - Updated `runWithHistory()` method to use helper (line 693)
  - Updated `stream()` method to use helper (line 799)
  - Fixed unrelated type issue in `buildSDKRequest` in openrouter.ts
  - Build passes with 0 TypeScript errors
  - All 134 tests pass
