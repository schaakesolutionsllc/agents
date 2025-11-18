# Releasing

This document describes how to publish new versions of `@schaakesolutionsllc/agents` to GitHub Packages.

## Prerequisites

- You must have push access to the repository
- All changes must be committed and pushed to `main`
- CI must be passing on `main`

## Version Types

Follow [Semantic Versioning](https://semver.org/):

- **patch** (0.1.0 → 0.1.1): Bug fixes, documentation updates
- **minor** (0.1.0 → 0.2.0): New features, backwards-compatible changes
- **major** (0.1.0 → 1.0.0): Breaking changes

## Release Process

### 1. Ensure you're on main with latest changes

```bash
git checkout main
git pull origin main
```

### 2. Verify CI is passing

Check that all tests pass locally:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

### 3. Create the release

Choose the appropriate version bump:

```bash
# For bug fixes
pnpm release:patch

# For new features
pnpm release:minor

# For breaking changes
pnpm release:major
```

This command will:
- Bump the version in `package.json`
- Create a git commit with the new version
- Create a git tag (e.g., `v0.2.0`)

### 4. Push the release

```bash
git push --follow-tags
```

This will:
- Push the commit to `main`
- Push the tag to trigger the publish workflow

### 5. Monitor the release

1. Go to the [Actions tab](https://github.com/schaakesolutionsllc/agents/actions) in GitHub
2. Watch the "Publish Package" workflow run
3. Once complete, the new version will be available on GitHub Packages

## Installing the Package

To install the package in other projects:

### 1. Configure npm for GitHub Packages

Create or update `.npmrc` in your project:

```
@schaakesolutionsllc:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Replace `YOUR_GITHUB_TOKEN` with a personal access token that has `read:packages` scope.

### 2. Install the package

```bash
npm install @schaakesolutionsllc/agents
# or
pnpm add @schaakesolutionsllc/agents
```

## Troubleshooting

### Publish workflow fails

1. Check the workflow logs in GitHub Actions
2. Ensure the tag matches pattern `v*` (e.g., `v0.2.0`)
3. Verify `GITHUB_TOKEN` has `packages: write` permission (configured in workflow)

### Version already exists

If you get an error that the version already exists:
1. Delete the local tag: `git tag -d v0.x.x`
2. Increment the version again with the appropriate command
3. Push the new tag

### Tests fail during publish

The publish workflow runs tests before publishing. If tests fail:
1. Fix the failing tests
2. Delete the tag locally and remotely:
   ```bash
   git tag -d v0.x.x
   git push origin :refs/tags/v0.x.x
   ```
3. Create a new release after fixing
