#!/usr/bin/env bash
set -euo pipefail

# Release script - run directly (not via pnpm) to avoid npm config warnings
# Usage: ./scripts/release.sh [patch|minor|major]

VERSION_TYPE="${1:-patch}"

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

npm version "$VERSION_TYPE" && git push --follow-tags
