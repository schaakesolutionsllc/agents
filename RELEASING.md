# Releasing

This package publishes to the public npm registry as `@schaake-solutions/agents`.

## One-time setup

1. Make sure the npm org `schaake-solutions` exists and your npm account can publish to it.
2. Create an npm access token that can publish packages. If your npm account uses 2FA, use an Automation token.
3. Add the token to this GitHub repository as an Actions secret named `NPM_ACCESS_TOKEN`.

## Release process

From `main` with a clean working tree:

```bash
git checkout main
git pull origin main
pnpm install --frozen-lockfile
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Bump and tag locally:

```bash
pnpm release patch   # or minor / major
```

Push the release commit and tag:

```bash
git push origin HEAD --follow-tags
```

Pushing a `v*` tag triggers `.github/workflows/publish.yml`, which installs dependencies, runs checks, builds, and publishes with:

```bash
pnpm publish --access public --no-git-checks
```

## Local publish dry run

```bash
pnpm publish --access public --dry-run
```

## Installing

```bash
pnpm add @schaake-solutions/agents
# or
npm install @schaake-solutions/agents
```

No GitHub Packages `.npmrc` is needed for consumers because this publishes to the public npm registry.
