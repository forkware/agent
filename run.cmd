@echo off
rem Starts the app; the installer runs it right after cloning.
rem Until the app has a start command of its own, this opens an AI agent
rem that builds the app with you by the rules in forkware\manifesto.md.
setlocal
cd /d "%~dp0"
if not defined FORKWARE_AGENT set "FORKWARE_AGENT=claude"
where "%FORKWARE_AGENT%" >nul 2>&1 || (
  echo Install an AI coding agent to start building, for example Claude Code: https://claude.com/claude-code
  echo Then run run.cmd again. Another agent: set FORKWARE_AGENT=^<command^>
  exit /b 0
)
"%FORKWARE_AGENT%" "Read forkware/manifesto.md. This repository is a Forkware app built by those rules. Ask me what the app should do, then build it with me. When the app can run, replace run.sh and run.cmd with its start command."
