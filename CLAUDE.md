# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**@schaake-solutions/agents** is a type-safe, provider-agnostic AI agent framework built on TypeScript and the OpenRouter API. It provides tool calling, structured output validation with Zod, streaming support, multimodal inputs, document extraction, web search, and embeddings generation.

## Build/Test/Lint Commands

```bash
# Build
pnpm build              # Compile TypeScript to dist/
pnpm type-check         # Type checking without emitting

# Testing
pnpm test              # Run unit tests
pnpm test:watch        # Unit tests in watch mode
pnpm test:coverage     # Unit tests with coverage
pnpm test:e2e          # E2E tests (requires OPENROUTER_API_KEY)
pnpm test:e2e:watch    # E2E tests in watch mode

# Code Quality
pnpm lint              # Lint TypeScript files
pnpm lint:fix          # Lint and auto-fix
pnpm format            # Format with Prettier
pnpm format:check      # Check formatting
```

### Running Single Tests

```bash
# Unit test by pattern
pnpm test -- agent.test.ts
pnpm test -- -t "test name pattern"

# E2E test by pattern
pnpm test:e2e -- basic-chat.e2e.ts
```

## Architecture

### Core Files

- **src/agent.ts** - Agent creation and execution loop (createAgent, run, runWithHistory, stream)
- **src/types.ts** - Comprehensive type definitions (1000+ lines)
- **src/tools.ts** - Tool definition helpers (defineTool, defineSyncTool)
- **src/openrouter.ts** - OpenRouter provider implementation
- **src/extraction.ts** - Document extraction (PDF processing)
- **src/embeddings.ts** - Text embeddings generation
- **src/web-search.ts** - Web search functionality
- **src/discovery.ts** - Model discovery and info
- **src/index.ts** - Public API exports

### Key Patterns

**Provider Pattern:** `LLMProvider` interface with `chat()` and `chatStream()` methods. `OpenRouterProvider` implements this, wrapping @openrouter/sdk.

**Agent Execution Flow:**
```
Agent.run(input)
  → Validate input (if inputSchema)
  → Convert to messages
  → Agent loop:
    - Call LLM with messages + tools
    - If tools: execute tools → add results → loop
    - If no tools: parse output (if outputSchema) → return
```

**Tool System:** Tools include validation, error handling, and context passing. Tool handlers receive args and AgentContext (runId, metadata, logger, onEvent).

### Test Organization

- **tests/agent.test.ts, tools.test.ts, openrouter.test.ts** - Unit tests (use mocks)
- **tests/fixtures/mocks.ts** - Test helpers (createMockProvider, createCapturingProvider, etc.)
- **tests/e2e/*.e2e.ts** - E2E tests with real API calls (60s timeout, sequential execution)

## Conventions

### TypeScript

- Strict mode enabled with all strict checks
- ESM-only with .js extensions in imports (e.g., `from "./agent.js"`)
- Generics for type-safe I/O: `Agent<I, O>`, `ToolDefinition<TArgs, TResult>`
- No `any` allowed (eslint error)

### Naming

- Functions: camelCase (createAgent, defineTool)
- Types: Descriptive suffixes (Provider, Config, Result, Options, Schema, Event, Context)
- Constants: UPPER_SNAKE_CASE (DEFAULT_MAX_TOOL_ITERATIONS)

### Error Handling

- Tools fail gracefully; errors sent to model for recovery
- Consistent error prefixes (ERROR_PREFIXES constant)
- Full stack traces logged, sanitized messages to model

## Dependencies

Core: @openrouter/sdk, zod
Node version: >= 18.0.0
Package type: ESM module

## Publishing

Registry: npm (`@schaake-solutions/agents`)
Setup: GitHub Actions publishes on `v*` tags using the `NPM_ACCESS_TOKEN` repository secret.
