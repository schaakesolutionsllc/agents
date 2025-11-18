# Update OpenRouter SDK

Updates the @openrouter/sdk dependency and regenerates the skill documentation with the latest types and official docs.

## Steps to Execute

### 1. Check Current Version

Run `pnpm list @openrouter/sdk` to see the current installed version.

### 2. Update the Dependency

Run `pnpm update @openrouter/sdk` to update to the latest version.

If updating to a specific version, use `pnpm add @openrouter/sdk@{version}`.

### 3. Verify Update

Check the new version with `pnpm list @openrouter/sdk`.

### 4. Fetch Latest Official Documentation

Fetch and extract information from these documentation URLs:
- https://openrouter.ai/docs/sdks/typescript - Main SDK overview
- https://openrouter.ai/docs/sdks/typescript/chat - Chat API details
- https://openrouter.ai/docs/sdks/typescript/embeddings - Embeddings API

Extract:
- New methods or parameters
- Changed type signatures
- New features or capabilities
- Updated code examples

### 5. Extract Updated Types from node_modules

Read the key type definition files from `node_modules/@openrouter/sdk/esm/`:
- `sdk/sdk.d.ts` - Main SDK class with all namespaces
- `models/chatgenerationparams.d.ts` - ChatGenerationParams type
- `models/chatresponse.d.ts` - ChatResponse type
- `models/chatstreamingresponsechunk.d.ts` - Streaming response types
- `models/message.d.ts` - Message types
- `models/tooldefinitionjson.d.ts` - Tool definition types
- `models/chatmessagetoolcall.d.ts` - Tool call types
- `models/assistantmessage.d.ts` - AssistantMessage type
- `lib/config.d.ts` - SDKOptions configuration

Note the SDK version from `lib/config.d.ts` (look for SDK_METADATA.sdkVersion).

### 6. Update Skill Documentation

Update the following files in `.claude/skills/openrouter-sdk/`:

#### docs/api-reference.md

- Update the SDK version at the top of the file
- Add any new types or parameters
- Update changed type signatures
- Add new API methods if any
- Update the wire format table if property mappings changed

#### docs/patterns.md

- Add examples for new features
- Update existing examples if APIs changed
- Add new sections for new capabilities

#### SKILL.md

- Update SDK Overview section if major changes
- Update Key Patterns if core usage changed

### 7. Verify Skill Files

Ensure all documentation:
- Uses camelCase for TypeScript (not snake_case)
- Includes accurate type definitions
- Has working code examples
- Documents any breaking changes

### 8. Report Summary

Provide a summary of:
- Previous version → New version
- New features added
- Breaking changes (if any)
- Files updated

## Documentation Sources

Primary: https://openrouter.ai/docs/sdks/typescript

Sub-pages to check:
- /chat - Chat completions
- /completions - Text completions
- /embeddings - Embeddings
- /models - Model listing
- /analytics - Usage analytics

## Important Notes

- The SDK is auto-generated from OpenAPI specs, so type changes reflect API changes
- Always preserve the camelCase → snake_case mapping documentation
- Check for new error types in `models/errors/`
- Look for new namespaces in `sdk/sdk.d.ts`
