#!/usr/bin/env bash
set -euo pipefail

# Upgrade dependencies and release if changes exist
# Usage: ./scripts/upgrade-and-release.sh [patch|minor|major]

VERSION_TYPE="${1:-patch}"

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

echo "==> Upgrading dependencies..."
pnpm update

# Check if there are any changes to commit
if git diff --quiet pnpm-lock.yaml package.json 2>/dev/null; then
  echo "==> No dependency changes detected. Nothing to do."
  exit 0
fi

echo "==> Dependencies updated. Running checks..."

echo "==> Type checking..."
pnpm type-check

echo "==> Linting..."
pnpm lint

echo "==> Formatting..."
pnpm format

echo "==> Running tests..."
pnpm test

echo "==> All checks passed. Committing changes..."
git add pnpm-lock.yaml package.json
git commit -m "chore(deps): upgrade dependencies"

echo "==> Creating $VERSION_TYPE release..."
npm version "$VERSION_TYPE" && git push --follow-tags

echo "==> Done! Release created and pushed."
