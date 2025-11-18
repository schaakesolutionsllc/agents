# Task 014: Document Error Handling Patterns in README

## Task Metadata

| Property | Value |
|----------|-------|
| **ID** | 014 |
| **Name** | Document error handling patterns in README |
| **Wave** | 4 (Final - Documentation Phase) |
| **Estimated Duration** | 20 minutes |
| **Category** | Documentation |
| **Priority** | Medium |
| **Dependencies** | Task 001, Task 002, Task 008 |
| **Status** | Pending |

## Objective

Add a comprehensive error handling documentation section to the README that covers:
1. How tool errors are handled by the agent framework
2. API key validation errors and how to resolve them
3. Error recovery patterns and best practices
4. Security considerations for tool handlers (avoiding sensitive data storage)
5. How to properly wrap handlers in try-catch to prevent information leakage

This documentation will help developers understand error handling patterns and implement robust agents that fail gracefully.

## Context

### Requirements (NFR-3: Documentation)

From the specification:

> All public APIs documented with JSDoc; Error handling guide in README; Streaming usage examples

This task addresses the "Error handling guide in README" requirement.

### Design Section: Security Considerations

From `design.md`:

**Tool Handler Safety**
- Document that handlers should not store sensitive data in context
- Wrap handlers in try-catch to prevent information leakage via stack traces

### Functional Requirements Context

This documentation task depends on the implementation of:

1. **FR-1: Tool Handler Error Handling** (Task 001)
   - Tool handlers are wrapped in try-catch
   - Errors are reported back to model as tool results
   - Handler errors are logged with context

2. **FR-2: API Key Validation** (Task 002)
   - API key validation occurs at OpenRouterProvider construction time
   - Clear error message with resolution steps

3. **FR-7: Input/Output Validation** (Task 008)
   - Tool arguments are validated against schema before calling handler
   - responseFormat schema structure is validated before API call

### Current README State

The current README at `/home/markschaake/projects/schaake-agents/README.md` includes:
- Installation instructions
- Quick start example
- Core concepts (Providers, Agents, Tools)
- Logging section
- Examples directory reference
- API Reference section

However, it lacks a dedicated error handling section.

### Documentation Goals

The new error handling section should:

1. **Be practical and actionable** - Show developers how to handle errors in their code
2. **Cover the framework's error handling** - Explain how the framework handles tool errors
3. **Address common error scenarios** - API key missing, tool throws, invalid arguments
4. **Provide best practices** - Security, logging, recovery patterns
5. **Include code examples** - Real examples showing correct patterns

---

## Implementation Steps

### Step 1: Review Existing Error Handling Implementation

1. Read the implementation of error handling in `/home/markschaake/projects/schaake-agents/src/agent.ts`
2. Verify the error handling patterns from Task 001 (tool handler try-catch)
3. Verify API key validation from Task 002
4. Verify input validation from Task 008
5. Understand the error message formats and logging patterns used

### Step 2: Analyze Error Scenarios

Identify the error scenarios that need documentation:

1. **Tool Handler Errors**
   - What happens when a tool throws an exception
   - How the agent continues after tool failure
   - How the model receives the error information
   - Error message format sent to model

2. **API Key Validation Errors**
   - Missing OPENROUTER_API_KEY environment variable
   - Error message and resolution steps
   - How to provide API key to OpenRouterProvider

3. **Tool Argument Validation Errors**
   - Invalid arguments passed to tool handler
   - Schema validation failures
   - How to fix argument schemas

4. **Response Format Errors**
   - Invalid structured output format
   - Schema validation failures for outputSchema
   - Error recovery patterns

5. **API Errors**
   - OpenRouter API errors
   - Network errors
   - Rate limiting (future)

### Step 3: Design the Documentation Section

Create a new "Error Handling" section in the README with subsections:

**Structure**:
```
## Error Handling

### Overview
- Brief explanation of error handling philosophy
- How the framework prevents crashes
- Three types of errors: setup errors, API errors, tool errors

### API Key Validation
- How to provide API key (environment variable, constructor)
- Error message when key is missing
- Code example

### Tool Handler Errors
- How tool exceptions are caught
- Error is reported to model as tool result
- Agent continues execution
- Code example showing try-catch pattern
- How to handle errors in tool handlers

### Error Recovery Patterns
- Graceful degradation strategies
- Retrying tool calls
- Logging and monitoring
- Code examples

### Security Considerations
- Avoid storing sensitive data in context
- Stack traces in logs vs. user-facing messages
- Sanitizing error messages for model
- Best practices checklist

### Common Error Scenarios and Solutions
- Missing API key: solution
- Tool throws exception: what happens and how to handle
- Invalid arguments: validation
- Network errors: handling
- Rate limits: future handling
```

### Step 4: Write Code Examples

Create concrete, runnable examples for:

1. **Basic error handling in tool handler**
   ```typescript
   const searchTool = defineTool(
     { name: "search", ... },
     async (args) => {
       try {
         const results = await apiCall(args.query);
         return results;
       } catch (error) {
         // Framework catches this and reports to model
         throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
       }
     }
   );
   ```

2. **API key validation**
   ```typescript
   try {
     const openRouter = new OpenRouterProvider({
       apiKey: process.env.OPENROUTER_API_KEY,
     });
   } catch (error) {
     console.error("Failed to initialize OpenRouter provider:", error.message);
     process.exit(1);
   }
   ```

3. **Handling tool errors from agent perspective**
   ```typescript
   const result = await agent.run(userQuery);
   // If tool threw an error, agent continues and model provides alternative response
   ```

4. **Schema validation errors**
   - Example of incorrect tool parameter schema
   - What error message user sees
   - How to fix it

### Step 5: Draft the Markdown Content

Write the complete error handling section with:
- Clear headings and subheadings
- Inline code examples
- Code blocks for longer examples
- Emphasis on key points
- Links to relevant sections
- Table of error types and resolutions

Focus on:
- Accuracy: Match implementation details exactly
- Clarity: Explain concepts in simple terms
- Completeness: Cover all major error scenarios
- Practicality: Show real, working examples

### Step 6: Integrate into README

1. Decide on placement (should be after "Core Concepts" and before "Examples")
2. Add navigation in table of contents if one exists
3. Ensure consistent formatting with existing sections
4. Maintain consistent code example style

### Step 7: Cross-Reference Related Sections

- Link to "Logging" section for error monitoring
- Link to "Tools" section for tool definition details
- Link to relevant type definitions in API Reference
- Reference Zod validation documentation if needed

### Step 8: Review and Validate

1. Read the complete README with new section
2. Verify all code examples are correct
3. Check for typos and grammar
4. Ensure code examples match actual API
5. Test any provided code patterns mentally or with a quick test
6. Ensure section fits naturally with surrounding content

---

## Acceptance Criteria

### Documentation Content

- [ ] Error Handling section exists in README with clear subsections
- [ ] API Key Validation subsection covers:
  - How to provide OPENROUTER_API_KEY
  - Error message when key is missing
  - Resolution steps
  - Code example

- [ ] Tool Handler Errors subsection covers:
  - How framework catches tool handler exceptions
  - Error reported to model as tool result
  - Agent continues after error
  - Code example showing handler with error
  - Explanation of error message format

- [ ] Error Recovery Patterns subsection covers:
  - Graceful degradation strategies
  - Example of handling multiple tools with potential failures
  - Logging and monitoring recommendations
  - Retry strategies (if applicable)

- [ ] Security Considerations subsection covers:
  - Avoid storing sensitive data in context
  - Stack traces in logs vs. model messages
  - Sanitizing error information
  - Best practices checklist

- [ ] Common Error Scenarios subsection includes:
  - Missing API key error and solution
  - Tool throws exception and explanation
  - Invalid tool arguments and solution
  - Response validation failure and solution

### Code Quality

- [ ] All code examples are syntactically correct
- [ ] All code examples follow existing patterns in README
- [ ] No typos or grammar errors
- [ ] Consistent formatting and style
- [ ] TypeScript examples properly typed

### Accuracy

- [ ] Error handling descriptions match implementation (Task 001)
- [ ] API key validation matches implementation (Task 002)
- [ ] Tool error format matches actual implementation
- [ ] Code examples are consistent with Quick Start example
- [ ] No contradictions with other documentation

### Completeness

- [ ] Covers all major error scenarios
- [ ] Addresses the design security considerations
- [ ] Satisfies NFR-3 documentation requirement
- [ ] Sufficient for developers to understand error handling

### Integration

- [ ] Section placed logically in README (after Core Concepts, before Examples)
- [ ] Cross-references to related sections where appropriate
- [ ] Consistent with existing README style and formatting
- [ ] Proper heading hierarchy

---

## Files to Modify

| File Path | Changes | Priority |
|-----------|---------|----------|
| `/home/markschaake/projects/schaake-agents/README.md` | Add "Error Handling" section with subsections covering API key validation, tool errors, recovery patterns, security considerations, and common scenarios | Required |

---

## Content Outline

The Error Handling section should include (in order):

1. **Overview**
   - Philosophy of graceful error handling
   - Three categories of errors: validation, API, tool execution
   - How errors are handled at each level

2. **API Key Validation**
   - How to provide API key
   - Environment variable pattern
   - Error message and resolution
   - Code example

3. **Tool Handler Errors**
   - Framework wraps handlers in try-catch
   - Exceptions become tool results
   - Model receives error and can respond
   - Code examples
   - Error message format

4. **Error Recovery Patterns**
   - Agent continues after tool failure
   - Model can try different approach
   - Example: multi-tool scenario with one failure
   - Logging for observability
   - Optional: retry patterns

5. **Security Considerations**
   - Don't store secrets in context
   - Stack traces in logs only
   - Sanitize error messages for model
   - Validation of tool arguments
   - Checklist

6. **Common Error Scenarios**
   - Table or list format:
     - Scenario
     - Root cause
     - Error message
     - Solution
   - Include: missing API key, tool throws, invalid args, response format

---

## Technical Considerations

### Code Examples Should Show

1. Framework's error handling (auto-wrapped, no try-catch needed)
2. Developer's error handling (in tool handlers, in agent code)
3. Both success and error paths
4. Common mistakes to avoid

### Avoid Over-Documenting

- Don't document every parameter (that's in JSDoc)
- Don't duplicate API Reference
- Focus on patterns and practices
- Focus on "why" not just "what"

### Keep Examples Minimal

- Show essential patterns only
- No more than 10-15 lines per example
- Remove unnecessary code
- Link to examples/ directory for full code

### Consider Developer Experience

- Anticipate common mistakes
- Explain "why" things fail, not just "how to fix"
- Provide clear error messages in examples
- Make it easy to find solutions

---

## Success Criteria Summary

The implementation is successful when:

1. ✓ Error Handling section exists in README with appropriate subsections
2. ✓ API key validation errors are documented with clear resolution steps
3. ✓ Tool handler error patterns are explained with working code examples
4. ✓ Error recovery patterns are documented
5. ✓ Security considerations from design are documented
6. ✓ Common error scenarios have documented solutions
7. ✓ All code examples are correct and follow existing patterns
8. ✓ Documentation matches actual implementation from Tasks 001, 002, 008
9. ✓ No grammatical errors or typos
10. ✓ Section integrates naturally into README

---

## References

**Spec Files**:
- Requirements: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/requirements.md`
  - NFR-3: Documentation requirement
  - FR-1: Tool Handler Error Handling
  - FR-2: API Key Validation
  - FR-7: Input/Output Validation
- Design: `/home/markschaake/projects/schaake-agents/specs/backlog/agents-codebase-improvements/design.md`
  - Architecture Overview
  - Workflow 1: Tool Execution with Error Handling
  - Security Considerations section

**Related Tasks**:
- Task 001: Implement Tool Handler Error Catching
- Task 002: Add API Key Validation
- Task 008: Input/Output Validation

**Current Files**:
- README: `/home/markschaake/projects/schaake-agents/README.md`
- Agent implementation: `/home/markschaake/projects/schaake-agents/src/agent.ts`
- OpenRouter provider: `/home/markschaake/projects/schaake-agents/src/openrouter.ts`
- Types: `/home/markschaake/projects/schaake-agents/src/types.ts`

---

## Notes

### Implementation Order

This task is positioned in Wave 4 (Documentation Phase) because:

1. It depends on the implementation of error handling (Tasks 001, 002, 008)
2. It's lower priority than core features but necessary for production quality
3. It should be completed after error handling features are stable and tested
4. Documentation is more effective when implementations are finalized

### Best Practices for Writing This Documentation

1. **Be Accurate**: The actual behavior matters more than the documentation style
2. **Be Practical**: Focus on what developers need to do, not theory
3. **Be Clear**: Use simple language, avoid jargon
4. **Be Complete**: Cover all major scenarios
5. **Be Maintainable**: Keep examples in sync with code as it evolves

### Future Documentation Tasks

After this task is complete:
- Task 015+: Streaming usage examples (per NFR-3)
- Task 016+: Comprehensive JSDoc for all public APIs (per NFR-3)

### Key Points to Emphasize

1. The framework catches tool errors automatically - developers don't need to wrap handlers
2. Errors are passed to the model as tool results - agent continues executing
3. Developers should avoid storing sensitive data in context
4. Logging is available for monitoring and debugging
5. Proper schema validation prevents many errors

### Example Section Placement

The Error Handling section should be positioned as:

```
## Core Concepts
  ### Providers
  ### Agents
  ### Tools
  ### Logging

## Error Handling          <-- NEW SECTION HERE
  ### Overview
  ### API Key Validation
  ### Tool Handler Errors
  ### Error Recovery Patterns
  ### Security Considerations
  ### Common Error Scenarios

## Examples
  See the examples/ directory...
```

This placement makes sense because:
- It comes after developers understand the concepts
- It comes before they look at full examples
- It's grouped with Logging (related topic)
- It flows naturally from Tools section

### Documentation Versioning

Note: This documentation should be updated when:
- Error handling implementation changes
- New error types are added
- New features affect error scenarios
- Best practices are discovered through real usage
