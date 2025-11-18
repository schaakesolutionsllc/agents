# Task 004: Add OpenRouter Response Type Definitions

## Task Metadata

- **ID**: 004
- **Name**: Add OpenRouter response type definitions
- **Wave**: 1 (Critical Phase)
- **Estimated Duration**: 20 minutes
- **Category**: Type Safety / Model
- **Status**: Pending
- **Dependencies**: None

## Objective

Create typed interfaces for OpenRouter API responses to replace unsafe `any` type assertions with concrete, compile-time type-safe interfaces. This task provides the foundational types needed for proper type safety throughout the codebase.

## Context

### Requirements Reference

From **FR-5: Type Safety Improvements**:
- Replace `any` types with concrete interfaces
- Create `OpenRouterResponse` interface
- Create `ToolCallResult` type
- Remove unsafe type assertions where possible

### Design Reference

The following type definitions are specified in the design document:

```typescript
// OpenRouter API choice object
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

// Complete OpenRouter API response
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

// Tool handler result type
export type ToolHandlerResult = Record<string, unknown> | void;

// Extended agent result with message history
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

### Current State

The codebase currently uses unsafe `any` type assertions:

**Example from openrouter.ts**:
```typescript
// Unsafe - loses type information
const choice = (response as any).choices[0];
```

This pattern appears in multiple locations and prevents TypeScript from catching errors at compile time.

### Why This Matters

1. **Type Safety**: TypeScript will catch property access errors at compile time instead of runtime
2. **IDE Support**: Better autocomplete and inline documentation in editors
3. **Refactoring Safety**: Renaming or restructuring these types becomes safe across all usages
4. **Contract Clarity**: Explicit types serve as executable documentation of the API contract

## Implementation Steps

### Step 1: Add Type Definitions to src/types.ts

1. Open `/home/markschaake/projects/schaake-agents/src/types.ts`
2. Add the following new exported interfaces (in logical order):

   a. **OpenRouterChoice** - Represents a single choice from the API response
      - Properties: `index`, `finishReason`, `message`
      - The `message` object contains the assistant's response and optional tool calls
      - Tool calls are typed as an array with `id`, `type`, `function.name`, and `function.arguments`

   b. **OpenRouterChatResponse** - The complete response from OpenRouter's chat API
      - Properties: `id`, `choices`, `created`, `model`, `object`, `usage`
      - Choices must be non-empty array of `OpenRouterChoice`
      - Usage is optional (some responses may not include token counts)

   c. **ToolHandlerResult** - Type for tool handler return values
      - Can be either an object (`Record<string, unknown>`) or `void`
      - Allows flexibility for tools that return data vs. those that only perform side effects

   d. **AgentRunResult<O>** - Extended result format for agent runs with history
      - Generic parameter `O` for output type
      - Includes output, full message history, iteration count, and optional usage stats

### Step 2: Export Types from Public API

1. Update `/home/markschaake/projects/schaake-agents/src/index.ts`
2. Add exports for the new types:
   ```typescript
   export type {
     OpenRouterChoice,
     OpenRouterChatResponse,
     ToolHandlerResult,
     AgentRunResult,
   } from './types';
   ```

### Step 3: Replace Unsafe Assertions in openrouter.ts

1. Open `/home/markschaake/projects/schaake-agents/src/openrouter.ts`
2. Find all instances of `(response as any)` or similar unsafe type assertions
3. Replace with proper type assertions to `OpenRouterChatResponse`:
   ```typescript
   // Before
   const choice = (response as any).choices[0];

   // After
   const typedResponse = response as OpenRouterChatResponse;
   const choice = typedResponse.choices[0];
   if (!choice) {
     throw new OpenRouterError('No choices in response');
   }
   ```
4. Add null/undefined checks for optional properties (`usage`)

### Step 4: Validate Type Correctness

1. Ensure all usages of response properties match the type definitions
2. Properties accessed should exist in the typed interfaces
3. Tool call structure matches the `toolCalls` array definition

## Acceptance Criteria

- [ ] **New types defined**: `OpenRouterChoice`, `OpenRouterChatResponse`, `ToolHandlerResult`, and `AgentRunResult<O>` are added to `src/types.ts`

- [ ] **Exports updated**: All new types are exported from `src/index.ts` for public API access

- [ ] **Unsafe assertions removed**: No `(response as any)` patterns remain in the codebase (check `openrouter.ts` especially)

- [ ] **Type safety applied**: Replace unsafe assertions with proper `OpenRouterChatResponse` type assertions

- [ ] **Property access validated**: All property accesses on typed responses are safe (no accessing undefined properties)

- [ ] **Optional properties handled**: Usage of optional properties (like `usage`) includes null/undefined checks

- [ ] **Compilation successful**: TypeScript compilation with `tsc --noEmit` succeeds with no errors

- [ ] **No compilation errors**: Running `npm run build` or equivalent build process succeeds

- [ ] **No new type-checking issues**: Running `npm run type-check` (if available) produces no new warnings

## Files to Modify

1. **`/home/markschaake/projects/schaake-agents/src/types.ts`**
   - Primary file: Add all four new type definitions
   - Location: Add after existing types, organized logically

2. **`/home/markschaake/projects/schaake-agents/src/index.ts`**
   - Secondary file: Add exports for the new types
   - Ensure backward compatibility (only adding, not removing)

3. **`/home/markschaake/projects/schaake-agents/src/openrouter.ts`**
   - Secondary file: Replace unsafe type assertions with typed assertions
   - Import `OpenRouterChatResponse` type from `./types`
   - Add validation for required vs. optional properties

## Related Context

### Design Decisions

- **Why these specific types?**: They directly map to the OpenRouter API response structure, ensuring the types match reality
- **Generic `AgentRunResult<O>`**: The output type is parameterized to work with different response formats (plain text, structured output with schemas, etc.)
- **Optional `usage`**: Some API responses may not include token usage information, so `usage?` is optional
- **Tool calls array**: Matches OpenAI's function calling format that OpenRouter implements

### Testing Considerations

This task doesn't require tests itself, but future tasks (PR validation, integration tests) will verify:
- Types properly enforce structure at compile time
- Response objects correctly cast to the new types
- IDE tooling recognizes the types for autocomplete

### Phase Context

This is a **Phase 2 (High Priority)** task that:
- Enables subsequent type safety improvements
- Provides the foundation for error handling improvements
- Improves developer experience with IDE support

### Rollback Plan

If issues arise:
1. Revert changes to `src/types.ts` and `src/index.ts`
2. Revert changes to `src/openrouter.ts` to use `any` assertions
3. No database or runtime state affected
4. All changes are purely compile-time/type-level

## Notes

- This task focuses solely on type definitions - it does not change runtime behavior
- The types serve as a contract for how the OpenRouter SDK responses should be structured
- Future tasks will use these types to eliminate more unsafe assertions throughout the codebase
- Once these types are in place, TypeScript's strict mode will prevent many common errors
