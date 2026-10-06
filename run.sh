#!/usr/bin/env bash
# Starts the app; the installer runs it right after cloning.
# Arguments go to the app: ./run.sh --server --port 8080
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1 || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)'; then
  echo "agent needs Node.js 22.18 or newer: https://nodejs.org"
  exit 1
fi

# Install dependencies on the first run and whenever package-lock.json changes.
stamp=node_modules/.package-lock.json
if [ ! -f "$stamp" ] || [ package-lock.json -nt "$stamp" ]; then
  npm install --no-audit --no-fund
fi

exec npm start --silent -- "$@"
