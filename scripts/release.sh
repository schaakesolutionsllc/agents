#!/usr/bin/env bash
set -euo pipefail

# Release script
# Usage: pnpm release [patch|minor|major]
# Bumps package.json, commits, and tags locally. Push with --follow-tags to publish.

VERSION_TYPE="${1:-patch}"

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

npm version "$VERSION_TYPE"

echo
echo "Release commit and tag created locally."
echo "Push with: git push origin HEAD --follow-tags"
