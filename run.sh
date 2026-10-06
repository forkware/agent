#!/usr/bin/env bash
# Starts the app; the installer runs it right after cloning.
# Until the app has a start command of its own, this opens an AI agent
# that builds the app with you by the rules in forkware/manifesto.md.
set -euo pipefail
cd "$(dirname "$0")"

agent=${FORKWARE_AGENT:-claude}
if ! command -v "$agent" >/dev/null 2>&1; then
  echo "Install an AI coding agent to start building, for example Claude Code: https://claude.com/claude-code"
  echo "Then run ./run.sh again. Another agent: FORKWARE_AGENT=<command> ./run.sh"
  exit 0
fi
exec "$agent" "Read forkware/manifesto.md. This repository is a Forkware app built by those rules. Ask me what the app should do, then build it with me. When the app can run, replace run.sh and run.cmd with its start command."
