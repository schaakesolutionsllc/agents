# Pivot Log: Agents Code Quality Phase 2

This file tracks all pivots (requirement changes) made during implementation.

---

## Pivot Template

Copy this template for each pivot:

```markdown
## Pivot XXX - [Short Description]
**Date**: YYYY-MM-DD HH:MM:SS
**Status**: [Completed | In Progress | Rolled Back]

### Description
[Detailed description of what changed]

### Rationale
[Why did we make this change? Customer feedback? Technical blocker? Better approach discovered?]

### Impact
- Modified: [Number] tasks
- Removed: [Number] tasks
- Added: [Number] tasks
- Affected waves: [Which waves changed]

### Implementation Notes
[Any technical details about how the pivot was implemented]

### Lessons Learned
[Optional: What did we learn from this pivot? Would we do it again?]
```

---

<!-- Pivots will be appended below by /specs:pivot command -->

## Pivot 001 - Replace Unit Tests with E2E Test Infrastructure
**Date**: 2025-11-18
**Status**: Completed

### Description
Removed 4 tasks for creating unit test suites (embeddings.ts, discovery.ts, extraction.ts, web-search.ts) and replaced with a single task to refactor the existing e2e test infrastructure.

### Rationale
Unit tests for the API wrapper modules would essentially just be testing mocks of the OpenRouter API - not valuable. The existing `test-live.ts` and `test-multi-step.ts` files actually test real behavior against the API and are more useful. Better to invest in improving that infrastructure than creating mock-heavy unit tests.

### Impact
- Modified: 1 task (task-012 renumbered to task-009)
- Removed: 4 tasks (008-011 unit test tasks)
- Added: 1 task (008 e2e test infrastructure)
- Affected waves: Wave 3 (reduced from 7 to 4 tasks), Wave 5 (task renumbered)

### Implementation Notes
- Task graph updated with new structure
- Old task files deleted
- New task-008-refactor-e2e-tests.md created
- Task-009-reenable-eslint-rules.md created (was task-012)
- Total tasks reduced from 12 to 9
- Estimated duration reduced from 90-120m to 60-90m

### Lessons Learned
Mock-heavy unit tests for API wrappers provide limited value. E2E tests that call actual APIs are more valuable for ensuring real-world functionality.
