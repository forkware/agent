# agent

A manager for AI coding agents, built by the rules in [forkware/manifesto.md](forkware/manifesto.md). Users install it as their own fork and change it by asking an agent, usually through the "Improve the app" button, which starts you in this directory.

## Ground rules

- **Every change starts with an issue** in this repository (`gh issue create`). Say what the user asked for in their words.
- **Change the app through a plugin** in `plugins/<id>/` whenever the plugin API allows it. Touch `src/` only when the core is missing an extension point, and then add the extension point, not the feature.
- **Each plugin carries a recipe**: `RECIPE.md` with the intent, a short spec and how to check it. The diff can go stale, the intent stays.
- **Tests are the contract.** Add tests next to the plugin (`plugins/<id>/tests/*.test.ts`). Before you finish: `npm run check && npm test`.
- **Do not restart the app yourself.** It runs your terminal session. UI changes reload by themselves; for server changes, ask the user to restart.

## Commands

| | |
|---|---|
| `npm start` | Desktop window (Electron showing the local server's page) |
| `npm run server` | Web server on 127.0.0.1:4870; prints a link with the login token |
| `npm start -- --server --host 0.0.0.0 --port 8080` | Server reachable from the network |
| `npm test` | Vitest: core and plugin tests |
| `npm run check` | TypeScript |
| `npm run build` | Build the UI into `dist/ui` for `--built` |

Data lives outside the repository: `~/.local/share/forkware-agent` on Linux (SQLite database, session logs). `--data-dir` or `AGENT_DATA_DIR` moves it.

## Layout

```
src/cli.ts           entry: --server or the desktop window
src/server/          the core: store (folders, tasks, statuses), sessions (PTYs), plugins, http
src/sdk/             types and definePlugin: the contract for plugins' server parts
src/ui/              React UI; sdk.tsx is what plugins' UI parts import as "#sdk/ui"
src/desktop/main.cjs the Electron window; no logic there
plugins/<id>/        plugin.json, server.ts, ui.tsx, RECIPE.md, tests/
```

The server runs TypeScript directly through Node's type stripping: no enums, no parameter properties, no namespaces, and relative imports end in `.ts`.

## Writing a plugin

`plugins/<id>/plugin.json`:

```json
{
  "name": "Review step",
  "description": "Adds a Review status that tasks must pass before Done.",
  "permissions": {
    "statuses:register": "Adds the Review status.",
    "tasks:guard": "Blocks Done until the task was in Review."
  }
}
```

Permissions: `folders:write`, `tasks:write`, `tasks:guard`, `statuses:register`, `agents:provide`, `agents:spawn`, `workspaces:resolve`. Reads need none. A write without its permission still works but is recorded and raises an alarm in the UI (rule 7), so declare what you use and say why.

`plugins/<id>/server.ts`:

```ts
import { definePlugin } from "#sdk/server";

export default definePlugin((ctx) => {
  ctx.statuses.register([{ id: "review", label: "Review", color: "amber", category: "active" }]);
  ctx.tasks.guardTransition((task, from, to) => (to === "done" && from !== "review" ? "Review it first" : true));
  ctx.events.on("session.exited", ({ taskId }) => ctx.log("agent finished", taskId));
  ctx.rpc.handle("ping", () => "pong"); // the UI calls rpc("<id>", "ping")
});
```

The full context is in `src/sdk/server.ts`: `events`, `statuses`, `folders`, `tasks`, `agents` (providers and sessions), `workspaces` (which directory an agent starts in), `rpc`, `kv`. Plugin data on folders and tasks goes in `meta[<plugin id>]`.

Core events: `folder.created|updated|deleted`, `task.created|updated|deleted`, `task.status.changed` `{ task, from, to }`, `session.started|exited|removed`, `audit.alarm`.

`plugins/<id>/ui.tsx`:

```tsx
import { Button, defineUiPlugin, rpc, toast, type Task } from "#sdk/ui";

function Ping({ task }: { task: Task }) {
  return <Button size="sm" onClick={async () => toast(await rpc<string>("<id>", "ping"))}>Ping</Button>;
}

export default defineUiPlugin({ slots: { "task.header": Ping } });
```

Slots (`src/ui/slots.tsx`): `header.actions`, `sidebar.header`, `folder.badge`, `folder.menu`, `task.badge`, `task.menu`, `task.header`, `session.toolbar`. Menu slots render `<MenuItem>`s.

Use the kit from `#sdk/ui` (Button, IconButton, Menu*, Dialog, `prompt()`, `confirm()`, `toast()`, Badge, StatusDot, EmptyState) and the Tailwind tokens (`bg-panel`, `bg-raised`, `border-line`, `text-muted`, `text-faint`, `bg-accent`, ...) instead of raw colors, so the plugin looks native in both themes. Strings go through `addStrings({ en, ru })` and `t()`. No emoji in the interface; icons come from `lucide-react`.

Workflows are LangGraph graphs (`@langchain/langgraph`); see `plugins/improve-app/workflow.ts`.

Set `"enabled": false` in plugin.json to switch a plugin off without deleting it.
