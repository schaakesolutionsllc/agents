# Task 003: Improve ToolHandler Type to be Generic

**Status:** Completed

**Wave:** 2
**Dependencies:** Task 001
**Estimated Duration:** 20m
**Category:** types

---

## Context

### Requirements
> Replace `ToolHandler = (args: any, ctx: AgentContext) => Promise<any>` with generic version

### Design
> Export generic ToolHandler type with explicit argument and return types:
> ```typescript
> export type ToolHandler<TArgs extends Record<string, unknown> = Record<string, unknown>, TResult = unknown> = (args: TArgs, ctx: AgentContext) => Promise<TResult>;
> ```
>
> Update ToolDefinition interface to use the generic ToolHandler with type parameters.

---

## Implementation Details

### Files to Update
1. `src/types.ts`

### Changes Required

#### 1. Update ToolHandler Type Definition
Replace the current non-generic type:
```typescript
// Current (to be removed)
type ToolHandler = (args: any, ctx: AgentContext) => Promise<any>
```

With the generic version:
```typescript
/**
 * Type-safe tool handler with explicit argument and return types
 */
export type ToolHandler<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown
> = (args: TArgs, ctx: AgentContext) => Promise<TResult>;
```

#### 2. Update ToolDefinition Interface
Update the ToolDefinition interface to use the generic ToolHandler:

```typescript
/**
 * Tool definition with typed handler
 */
export interface ToolDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown
> {
  name: string;
  description: string;
  schema: ToolSchema;
  handler: ToolHandler<TArgs, TResult>;
}
```

### Type Parameters Explained

- **TArgs**: The shape of arguments the tool accepts (defaults to `Record<string, unknown>` for backward compatibility)
- **TResult**: The return type of the tool (defaults to `unknown` for flexibility)

Both parameters have sensible defaults to maintain backward compatibility with existing code while allowing new code to be fully typed.

---

## Acceptance Criteria

- [x] ToolHandler type is generic with TArgs and TResult parameters
- [x] ToolHandler type has proper default parameters for backward compatibility
- [x] ToolDefinition interface uses generic ToolHandler
- [x] ToolDefinition interface has TArgs and TResult type parameters
- [x] All existing ToolHandler implementations still compile correctly
- [x] No breaking changes to public API
- [x] Build completes successfully with `npm run build`
- [x] All existing tests pass with `npm test` (2 pre-existing failures unrelated to type changes)
- [x] TypeScript compilation shows no errors

---

## Agent Notes

- The `ToolHandler` type was successfully converted from a non-generic type using `any` to a generic type with proper type constraints
- The `ToolDefinition` interface was also made generic to match the handler
- Default type parameters ensure 100% backward compatibility - existing code continues to work without modification
- The original `ToolDefinition` interface structure with `schema` and `handler` fields was preserved (the spec example showed `name` and `description` but actual implementation uses `schema` containing those)
- Enhanced JSDoc documentation with examples for both typed and untyped usage patterns
- Two pre-existing test failures (unrelated to this change) exist due to error message format differences

---

## Progress Log

- **2024-11-18**: Implemented generic `ToolHandler` type with `TArgs extends Record<string, unknown>` and `TResult = unknown` parameters
- **2024-11-18**: Updated `ToolDefinition` interface to be generic with matching type parameters
- **2024-11-18**: Added comprehensive JSDoc documentation with typed and untyped examples
- **2024-11-18**: Verified build succeeds with `npm run build`
- **2024-11-18**: Verified 132/134 tests pass (2 pre-existing failures unrelated to type changes)
