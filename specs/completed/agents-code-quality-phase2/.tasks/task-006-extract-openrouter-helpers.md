# Task 006: Extract openrouter.ts Helper Functions

## Task Metadata

| Property | Value |
|----------|-------|
| **Task ID** | 006 |
| **Title** | Extract openrouter.ts helper functions |
| **Wave** | 3 |
| **Category** | Refactor |
| **Estimated Duration** | 30 minutes |
| **Status** | Pending |
| **Dependencies** | Task 002 (Standardize Zod Imports) |

---

## Objective

Extract duplicated code from the `chat()` and `chatStream()` methods in `/home/markschaake/projects/schaake-agents/src/openrouter.ts` into two reusable helper functions: `buildSDKProviderOptions()` and `buildSDKRequest()`. This refactoring will eliminate code duplication, improve maintainability, and enhance type safety by reducing the need for `any` casts.

---

## Context

### Requirement Reference

**FR-3: Refactor openrouter.ts Helper Functions** (from requirements.md)
- Extract `buildSDKProviderOptions()` from duplicated provider options mapping
- Extract `buildSDKRequest()` from duplicated SDK request building
- Improve type safety by reducing `any` casts

### Design Reference

**Refactoring 2: openrouter.ts Helper Functions** (from design.md, lines 117-168)
- Full function signatures for both helpers with proper TypeScript types
- Provider options builder maps ProviderOptions to SDKProviderOptions
- SDK request builder assembles the complete request object from ChatRequest

### Current Implementation

The `OpenRouterProvider` class in `/home/markschaake/projects/schaake-agents/src/openrouter.ts` has two public methods (`chat()` and `chatStream()`) that contain nearly identical code:

**Lines 208-222 (Provider options mapping - duplicated in both methods)**:
```typescript
const provider = req.providerOptions
  ? {
      sort: req.providerOptions.sort,
      order: req.providerOptions.order,
      only: req.providerOptions.only,
      ignore: req.providerOptions.ignore,
      zdr: req.providerOptions.zdr,
      dataCollection: req.providerOptions.dataCollection,
      allowFallbacks: req.providerOptions.allowFallbacks,
      requireParameters: req.providerOptions.requireParameters,
      maxPrice: req.providerOptions.maxPrice,
      quantizations: req.providerOptions.quantizations,
    }
  : undefined;
```

**Lines 224-254 (SDK request building - duplicated with minimal variations)**:
```typescript
const sdkRequest = {
  model: req.model,
  ...(req.models && { models: req.models }),
  messages: toSDKMessages(req.messages),
  ...(tools && { tools }),
  ...(tools && tools.length > 0 && { toolChoice: "auto" as const }),
  // Sampling parameters
  ...(req.temperature !== undefined && { temperature: req.temperature }),
  ...(req.topP !== undefined && { topP: req.topP }),
  ...(req.frequencyPenalty !== undefined && {
    frequencyPenalty: req.frequencyPenalty,
  }),
  ...(req.presencePenalty !== undefined && {
    presencePenalty: req.presencePenalty,
  }),
  ...(req.seed !== undefined && { seed: req.seed }),
  ...(req.stop !== undefined && { stop: req.stop }),
  ...(req.logitBias !== undefined && { logitBias: req.logitBias }),
  // Token limits
  ...(req.maxTokens !== undefined && { maxTokens: req.maxTokens }),
  // Logging
  ...(req.logprobs !== undefined && { logprobs: req.logprobs }),
  ...(req.topLogprobs !== undefined && { topLogprobs: req.topLogprobs }),
  // Output
  stream: false as const,
  ...(req.responseFormat && { responseFormat: req.responseFormat }),
  // Provider routing
  ...(provider && { provider }),
  // Reasoning
  ...(req.reasoning && { reasoning: req.reasoning }),
};
```

The only difference is `stream: false` in `chat()` vs `stream: true` in `chatStream()`.

### Problem Statement

1. **Code Duplication**: The provider options mapping (~15 lines) is duplicated exactly between both methods
2. **SDK Request Duplication**: The request building (~30 lines) is nearly identical, differing only in the `stream` flag
3. **Maintenance Risk**: Changes to provider options or request building must be made in two places
4. **Type Safety**: Both blocks use inline object construction with `any` cast to bypass type compatibility issues
5. **Testability**: The duplicated logic is harder to test and maintain independently

### Impact Scope

- **Primary File**: `/home/markschaake/projects/schaake-agents/src/openrouter.ts`
- **Test File**: `/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts`
- **Affected Methods**: `chat()` (lines 197-304), `chatStream()` (lines 306-415)

---

## Implementation Steps

### Step 1: Define Helper Function Signatures

Add proper TypeScript types and JSDoc for both helpers. These should be placed before the `OpenRouterProvider` class definition.

**Function 1: `buildSDKProviderOptions()`**

```typescript
/**
 * Builds provider options for SDK requests from our ProviderOptions type.
 * Maps our internal ProviderOptions to the SDK's expected format.
 *
 * @param providerOptions - The provider options from ChatRequest
 * @returns SDK provider options or undefined if no options provided
 */
function buildSDKProviderOptions(
  providerOptions?: ProviderOptions
): Record<string, any> | undefined {
  if (!providerOptions) return undefined;

  return {
    sort: providerOptions.sort,
    order: providerOptions.order,
    only: providerOptions.only,
    ignore: providerOptions.ignore,
    zdr: providerOptions.zdr,
    dataCollection: providerOptions.dataCollection,
    allowFallbacks: providerOptions.allowFallbacks,
    requireParameters: providerOptions.requireParameters,
    maxPrice: providerOptions.maxPrice,
    quantizations: providerOptions.quantizations,
  };
}
```

**Function 2: `buildSDKRequest()`**

```typescript
/**
 * Builds a complete SDK request from a ChatRequest.
 * Handles all optional parameters, including sampling, token limits, and logging options.
 *
 * @param req - The ChatRequest with model, messages, and options
 * @param tools - Formatted tools for the SDK (from our format to SDK format)
 * @param stream - Whether this request should use streaming
 * @returns Complete request object for the SDK's chat.send() method
 */
function buildSDKRequest(
  req: ChatRequest,
  tools: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: unknown;
    };
  }> | undefined,
  stream: boolean
): Record<string, any> {
  const provider = buildSDKProviderOptions(req.providerOptions);

  return {
    model: req.model,
    ...(req.models && { models: req.models }),
    messages: toSDKMessages(req.messages),
    ...(tools && { tools }),
    ...(tools && tools.length > 0 && { toolChoice: "auto" as const }),
    // Sampling parameters
    ...(req.temperature !== undefined && { temperature: req.temperature }),
    ...(req.topP !== undefined && { topP: req.topP }),
    ...(req.frequencyPenalty !== undefined && {
      frequencyPenalty: req.frequencyPenalty,
    }),
    ...(req.presencePenalty !== undefined && {
      presencePenalty: req.presencePenalty,
    }),
    ...(req.seed !== undefined && { seed: req.seed }),
    ...(req.stop !== undefined && { stop: req.stop }),
    ...(req.logitBias !== undefined && { logitBias: req.logitBias }),
    // Token limits
    ...(req.maxTokens !== undefined && { maxTokens: req.maxTokens }),
    // Logging
    ...(req.logprobs !== undefined && { logprobs: req.logprobs }),
    ...(req.topLogprobs !== undefined && { topLogprobs: req.topLogprobs }),
    // Output
    stream,
    ...(req.responseFormat && { responseFormat: req.responseFormat }),
    // Provider routing
    ...(provider && { provider }),
    // Reasoning
    ...(req.reasoning && { reasoning: req.reasoning }),
  };
}
```

### Step 2: Extract Provider Options from `chat()` Method

Replace lines 208-222 in the `chat()` method with a call to `buildSDKProviderOptions()`.

**Current code to replace**:
```typescript
// Build provider options for OpenRouter routing
const provider = req.providerOptions
  ? {
      sort: req.providerOptions.sort,
      order: req.providerOptions.order,
      only: req.providerOptions.only,
      ignore: req.providerOptions.ignore,
      zdr: req.providerOptions.zdr,
      dataCollection: req.providerOptions.dataCollection,
      allowFallbacks: req.providerOptions.allowFallbacks,
      requireParameters: req.providerOptions.requireParameters,
      maxPrice: req.providerOptions.maxPrice,
      quantizations: req.providerOptions.quantizations,
    }
  : undefined;
```

**Replace with**:
```typescript
// Build provider options for OpenRouter routing
const provider = buildSDKProviderOptions(req.providerOptions);
```

### Step 3: Extract Provider Options from `chatStream()` Method

Perform the same replacement in the `chatStream()` method (lines 318-331). Replace with the same single-line call.

### Step 4: Extract SDK Request Building from `chat()` Method

Replace lines 224-254 in the `chat()` method with:

```typescript
const sdkRequest = buildSDKRequest(req, tools, false);
```

### Step 5: Extract SDK Request Building from `chatStream()` Method

Replace lines 333-363 in the `chatStream()` method with:

```typescript
const sdkRequest = buildSDKRequest(req, tools, true);
```

### Step 6: Update `chat()` Method

After extraction, the method should look like:

```typescript
async chat(req: ChatRequest): Promise<ChatResponse> {
  // Convert our tool format to SDK format
  const tools = req.tools?.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));

  const sdkRequest = buildSDKRequest(req, tools, false);

  // Call the SDK's chat.send method
  // Cast to any to bypass complex type compatibility issues with the SDK
  const response = await this._client.chat.send(sdkRequest as any);

  // Type the response for proper type safety
  const typedResponse = response as OpenRouterChatResponse;
  const choice = typedResponse.choices[0];
  if (!choice) {
    throw new Error("OpenRouterProvider: No choices in response");
  }

  // Convert SDK response to our format
  const toolCalls: ChatToolCall[] | undefined = choice.message.toolCalls?.map(
    (tc) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }),
  );

  // Handle content - SDK can return string or array, we normalize to string
  let content: string | null = null;
  if (choice.message.content) {
    if (typeof choice.message.content === "string") {
      content = choice.message.content;
    } else if (Array.isArray(choice.message.content)) {
      // Extract text from content items
      const contentItems = choice.message.content;
      content = contentItems
        .map((item: OpenRouterContentItem) =>
          item.type === "text" ? item.text : "",
        )
        .join("");
    }
  }

  return {
    message: {
      role: "assistant",
      content,
      toolCalls: toolCalls,
    },
    finishReason: choice.finishReason ?? null,
    raw: response,
  };
}
```

### Step 7: Update `chatStream()` Method

Apply the same extraction pattern:

```typescript
async *chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk> {
  // Convert our tool format to SDK format
  const tools = req.tools?.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));

  const sdkRequest = buildSDKRequest(req, tools, true);

  // Call the SDK's chat.send method with stream: true
  // Cast to any to bypass complex type compatibility issues with the SDK
  const streamResponse = (await this._client.chat.send(
    sdkRequest as any,
  )) as unknown as AsyncIterable<any>;

  // The SDK returns an EventStream which is an AsyncIterable
  for await (const chunk of streamResponse) {
    const choice = chunk.choices[0];
    if (!choice) continue;

    const delta = choice.delta;
    const streamChunk: ChatStreamChunk = {};

    // Handle content delta
    if (delta.content) {
      streamChunk.content = delta.content;
    }

    // Handle tool calls delta
    if (delta.toolCalls && delta.toolCalls.length > 0) {
      streamChunk.toolCalls = delta.toolCalls.map((tc: any) => ({
        index: tc.index,
        id: tc.id,
        type: tc.type,
        function: tc.function
          ? {
              name: tc.function.name,
              arguments: tc.function.arguments,
            }
          : undefined,
      }));
    }

    // Handle finish reason
    if (choice.finishReason) {
      streamChunk.finishReason = choice.finishReason;
    }

    // Handle usage (typically in the final chunk)
    if (chunk.usage) {
      streamChunk.usage = {
        promptTokens: chunk.usage.promptTokens,
        completionTokens: chunk.usage.completionTokens,
        totalTokens: chunk.usage.totalTokens,
      };
    }

    yield streamChunk;
  }
}
```

---

## Acceptance Criteria

- [ ] **Helper Function 1**: `buildSDKProviderOptions()` extracted with complete JSDoc documentation
- [ ] **Helper Function 2**: `buildSDKRequest()` extracted with complete JSDoc documentation
- [ ] **Provider Options**: All duplicated provider options mapping code removed
- [ ] **Request Building**: All duplicated SDK request building code removed
- [ ] **Code Reduction**: Both `chat()` and `chatStream()` methods are significantly shorter (~50% line reduction in those methods)
- [ ] **Functionality Preserved**: All existing behavior maintained (no behavioral changes)
- [ ] **Type Safety**: Functions have proper TypeScript types (using `Record<string, any>` for now due to SDK type constraints)
- [ ] **JSDoc Complete**: Both helpers have complete JSDoc with:
  - [ ] Clear description of what the function does
  - [ ] @param documentation for all parameters
  - [ ] @returns documentation
- [ ] **No Regressions**: All existing tests pass
- [ ] **Code Style**: Formatting matches rest of codebase (indentation, spacing, comments)
- [ ] **Parameter Handling**: Both helpers correctly handle optional parameters
- [ ] **Stream Flag**: `buildSDKRequest()` correctly uses the `stream` parameter in both calls

---

## Testing Strategy

### Unit Tests to Update/Add

**File**: `/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts`

**Test Cases to Add**:

1. **Test buildSDKProviderOptions with full options**:
   ```typescript
   it('should build SDK provider options from ChatRequest provider options', () => {
     const providerOptions: ProviderOptions = {
       sort: 'rating',
       order: 'desc',
       only: 'free',
       ignore: 'gpt-4',
       zdr: true,
       dataCollection: 'deny',
       allowFallbacks: false,
       requireParameters: true,
       maxPrice: 1.5,
       quantizations: ['int8']
     };

     const result = buildSDKProviderOptions(providerOptions);

     expect(result).toEqual(providerOptions);
   });
   ```

2. **Test buildSDKProviderOptions with undefined**:
   ```typescript
   it('should return undefined when no provider options provided', () => {
     const result = buildSDKProviderOptions(undefined);
     expect(result).toBeUndefined();
   });
   ```

3. **Test buildSDKRequest with minimal options**:
   ```typescript
   it('should build SDK request with minimal options', () => {
     const req: ChatRequest = {
       model: 'gpt-4',
       messages: [{ role: 'user', content: 'hello' }],
     };

     const result = buildSDKRequest(req, undefined, false);

     expect(result.model).toBe('gpt-4');
     expect(result.messages).toBeDefined();
     expect(result.stream).toBe(false);
   });
   ```

4. **Test buildSDKRequest with full options**:
   ```typescript
   it('should build SDK request with all options', () => {
     const req: ChatRequest = {
       model: 'gpt-4',
       messages: [{ role: 'user', content: 'hello' }],
       temperature: 0.7,
       topP: 0.9,
       maxTokens: 1000,
       stop: ['stop'],
       responseFormat: { type: 'json_object' },
       reasoning: { type: 'enabled' },
     };

     const result = buildSDKRequest(req, undefined, true);

     expect(result.temperature).toBe(0.7);
     expect(result.topP).toBe(0.9);
     expect(result.maxTokens).toBe(1000);
     expect(result.stream).toBe(true);
   });
   ```

5. **Test buildSDKRequest includes tools**:
   ```typescript
   it('should include tools in SDK request when provided', () => {
     const tools = [{
       type: 'function' as const,
       function: {
         name: 'test',
         description: 'test tool',
         parameters: {},
       }
     }];

     const req: ChatRequest = {
       model: 'gpt-4',
       messages: [{ role: 'user', content: 'hello' }],
       tools: [/* matching tool format */],
     };

     const result = buildSDKRequest(req, tools, false);

     expect(result.tools).toEqual(tools);
     expect(result.toolChoice).toBe('auto');
   });
   ```

6. **Test chat() still works after refactoring**:
   - Verify existing chat tests still pass
   - Spot-check that response handling is unchanged

7. **Test chatStream() still works after refactoring**:
   - Verify existing streaming tests still pass
   - Spot-check that chunk handling is unchanged

### Test Execution

After implementation, run:
```bash
npm test -- openrouter.test.ts
```

All tests should pass, including:
- Existing `chat()` and `chatStream()` tests
- New helper function tests
- No regressions in behavior

---

## Files to Modify

### Primary Files

1. **`/home/markschaake/projects/schaake-agents/src/openrouter.ts`**
   - Add: `buildSDKProviderOptions()` helper function (before class definition)
   - Add: `buildSDKRequest()` helper function (before class definition)
   - Modify: `chat()` method (lines 197-304) - replace duplication with helper calls
   - Modify: `chatStream()` method (lines 306-415) - replace duplication with helper calls
   - Type: Implementation refactoring

### Test Files

1. **`/home/markschaake/projects/schaake-agents/tests/openrouter.test.ts`**
   - Add: Tests for `buildSDKProviderOptions()`
   - Add: Tests for `buildSDKRequest()`
   - Verify: Existing `chat()` tests pass
   - Verify: Existing `chatStream()` tests pass
   - Type: Test enhancement

---

## Specification References

- **Requirement File**: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-code-quality-phase2/requirements.md`
  - Section: "FR-3: Refactor openrouter.ts Helper Functions" (lines 62-65)

- **Design File**: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-code-quality-phase2/design.md`
  - Section: "Refactoring 2: openrouter.ts Helper Functions" (lines 117-168)

---

## Wave Information

This task is part of **Wave 3** of the agents-code-quality-phase2 specification:

**Wave 3 focuses on**:
- Extracting helper functions from openrouter.ts (this task)
- Completing other refactorings and improvements
- Final code quality enhancements

---

## Important Notes

### Code Structure Considerations

1. **Helper Function Placement**: Place both helper functions above the `OpenRouterProvider` class definition (around line 60, after the existing helper functions like `toSDKContent()` and `toSDKMessages()`)

2. **Type Safety**: The functions return `Record<string, any>` due to SDK type compatibility issues. This is acceptable for now - future improvements could create proper SDK request types.

3. **Parameter Ordering**: `buildSDKRequest()` takes three parameters:
   - `req: ChatRequest`
   - `tools: FormattedToolsArray | undefined`
   - `stream: boolean`

   The `tools` parameter is pre-formatted (our format → SDK format) before being passed to this helper.

4. **Conditional Parameters**: Both functions use the spread operator (`...`) pattern extensively to include optional parameters only when defined. This approach is important to avoid sending `undefined` values to the SDK.

### Backward Compatibility

This refactoring is **fully backward compatible**:
- No changes to public API
- No changes to method signatures
- Same behavior, just better organized
- All existing tests should pass without modification

### Performance Considerations

- Minimal performance impact (helper functions are simple object builders)
- No additional allocations beyond what already exists
- No behavioral changes

---

## Implementation Checklist

- [ ] Read this task file completely
- [ ] Review `/home/markschaake/projects/schaake-agents/src/openrouter.ts` to understand current structure
- [ ] Add `buildSDKProviderOptions()` function with JSDoc (before class)
- [ ] Add `buildSDKRequest()` function with JSDoc (before class)
- [ ] Update `chat()` method to use new helpers
- [ ] Update `chatStream()` method to use new helpers
- [ ] Add unit tests for `buildSDKProviderOptions()`
- [ ] Add unit tests for `buildSDKRequest()`
- [ ] Verify both methods still work correctly
- [ ] Run full test suite: `npm test`
- [ ] Verify no test regressions
- [ ] Verify code formatting and style consistency
- [ ] Review final code for clarity and correctness
- [ ] Commit changes with descriptive message

---

## Related Tasks

- **Task 001**: Standardize Zod Imports (prerequisite - ensures consistent imports)
- **Task 002**: Improve Provider Routing (may benefit from these helpers)
- **Task 003-005**: Other refactorings in agent.ts
- **Task 007+**: Future type safety improvements

---

## Questions & Clarifications

None at this time. The design is clear and the refactoring is straightforward.
