# Improve the app

## Intent

The user changes the app by asking for it. A prominent button in the top right starts an agent on the app's own source code, so a wish turns into a change in the user's fork without leaving the app.

## Spec

- The "Improve the app" button sits in `header.actions` and stands out from every other control.
- Pressing it:
  1. finds the folder named after the app (`package.json` name), creating it on first use; if the user deleted it, it is created again;
  2. creates a task in it, "Improvement N", with the title in the UI's language;
  3. runs the improvement workflow, a LangGraph graph (`workflow.ts`). Today it has one node, `runAgent`, which starts the default agent for the task with a prompt about the manifesto, CLAUDE.md and the issue-first rule;
  4. opens the task, so the user sees the agent's terminal.
- Agents for tasks in that folder start in the app's source directory.

## Check

`npm test` runs `tests/improve-app.test.ts`: one folder for many presses, numbered tasks, the agent's directory and prompt, folder re-creation.
