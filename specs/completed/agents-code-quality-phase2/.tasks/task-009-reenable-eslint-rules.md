# Task 009: Re-enable ESLint Type Safety Rules

**Status**: Pending
**Wave**: 5
**Dependencies**: 003, 004, 005, 006, 007
**Estimated Duration**: 45 minutes
**Category**: config

---

## Context

### From Requirements

> Gradually re-enable disabled TypeScript safety rules. Start with `warn` level to identify issues. Fix underlying type issues to achieve clean lint.

### From Design

The ESLint configuration currently disables crucial TypeScript safety rules. This task re-enables them after all type improvements are complete.

**Three-phase approach**:
1. Phase 1: Enable at `warn` level
2. Phase 2: Fix identified issues
3. Phase 3: Upgrade to `error` level

---

## Implementation Details

**Files to Modify**:
- `eslint.config.js` - Re-enable rules
- `src/agent.ts` - Fix any remaining type issues
- `src/openrouter.ts` - Fix any remaining type issues
- `src/types.ts` - Fix any remaining type issues

### Phase 1: Warning Level

Update `eslint.config.js`:

```javascript
rules: {
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unsafe-assignment": "warn",
  "@typescript-eslint/no-unsafe-member-access": "warn",
  "@typescript-eslint/no-unsafe-call": "warn",
  "@typescript-eslint/no-unsafe-return": "warn",
  "@typescript-eslint/no-unsafe-argument": "warn",
}
```

### Phase 2: Fix Issues

For each warning:
1. Add proper type annotations
2. Use type guards where needed
3. Only use `eslint-disable-next-line` with documentation when truly necessary (e.g., SDK interactions)

Example of documented disable:
```typescript
// SDK returns unknown type for tool arguments
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const args = toolCall.function.arguments;
```

### Phase 3: Error Level

After fixing issues, upgrade critical rules:
```javascript
rules: {
  "@typescript-eslint/no-explicit-any": "error",
  // Others can stay at warn if SDK requires them
}
```

---

## Acceptance Criteria

Task is complete when:

- [ ] ESLint rules re-enabled at warn level
- [ ] `npm run lint` runs without errors
- [ ] Warnings reduced to minimum (only documented SDK interactions)
- [ ] Any remaining `eslint-disable` comments have explanatory documentation
- [ ] `@typescript-eslint/no-explicit-any` upgraded to error level
- [ ] Build completes successfully
- [ ] All tests pass

---

## Agent Notes

### Implementation Notes
- [Agent can write notes about implementation decisions]
- [Challenges encountered]
- [Assumptions made]

### Questions/Blockers
- [Agent can note any questions or blockers]

### Testing Notes
- [Agent can describe tests written]
- [Test coverage achieved]

---

## Progress Log

- **Created**: 2025-11-18
- **Started**: [Timestamp when execution agent began work]
- **Completed**: [Timestamp when task marked complete]
- **Duration**: [Actual time taken]
