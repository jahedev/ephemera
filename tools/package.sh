#!/usr/bin/env bash
# Build a distributable zip of the extension.
#
#   ./tools/package.sh            package the committed tree (what ships)
#   ./tools/package.sh --working  package the working directory instead
#
# Output: dist/ephemera-<version>.zip, with manifest.json at the top level,
# which is what both "Load unpacked" and the Chrome Web Store expect.

set -euo pipefail
cd "$(dirname "$0")/.."

version=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -1)
out="dist/ephemera-${version}.zip"
mkdir -p dist
rm -f "$out"

if [[ "${1:-}" == "--working" ]]; then
  # Tracked files only, but read from disk - useful before committing.
  git ls-files -z ':!:tools' ':!:.gitignore' ':!:.gitattributes' \
    | xargs -0 zip -q -X "$out"
else
  if ! git diff --quiet HEAD -- . ':!:dist'; then
    echo "note: uncommitted changes are not included (use --working to include them)" >&2
  fi
  git archive --format=zip -o "$out" HEAD
fi

echo "$out"
unzip -l "$out" | tail -n +4 | head -30
