# Claude Code

## Intent

Run Claude Code as an agent with the user's own subscription and login: the app starts the `claude` CLI in a terminal and never sees an API key.

## Spec

- Provider id `claude-code`, the default agent.
- A start with a prompt passes it as the first argument, which opens an interactive session with that message.
- When `claude` is not in PATH, starting it says so instead of failing silently.

## Check

Start an agent in any task: Claude Code's interface appears in the terminal.
