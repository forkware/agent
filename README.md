# agent

A manager for AI coding agents that you shape to fit yourself. Folders of tasks on the left, agents working on them on the right, and a button that changes the app itself.

A [Forkware](https://github.com/forkware/manifesto) app. Installing it gives you your own fork. Want a new status, a button, a workflow? Press **Improve the app**, say what you want, and an agent builds it into your fork. How it works: [the manifesto](forkware/manifesto.md).

- **Your subscriptions.** Agents run through their own CLIs (Claude Code first), logged in as you. No API keys.
- **Desktop or web.** The same app runs as a window or as a server you open in a browser.
- **Plugins all the way.** Statuses, buttons, folder bindings, workflows: everything past folders, tasks and terminals is a plugin you can change.

## Install

```sh
# Linux
curl -fsSL https://raw.githubusercontent.com/forkware/agent/main/installer/install-linux.sh | bash
# macOS
curl -fsSL https://raw.githubusercontent.com/forkware/agent/main/installer/install-macos.sh | bash
```

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/forkware/agent/main/installer/install-windows.ps1 | iex
```

Needs [Node.js](https://nodejs.org) 22.18 or newer and an agent CLI such as [Claude Code](https://claude.com/claude-code).

## Run

```sh
./run.sh                                  # desktop window
./run.sh --server                         # web: open the printed link
./run.sh --server --host 0.0.0.0 --port 8080
```

The link the server prints carries a login token. Anyone with it can run commands on the machine through the agents, so keep it private.

## Change it

Press **Improve the app**, or read [CLAUDE.md](CLAUDE.md) and [ARCHITECTURE.md](ARCHITECTURE.md) and write a plugin in `plugins/`.

## License

[Elastic License 2.0](LICENSE): use it, fork it, change it and share your changes; you may not offer it to others as a hosted or managed service. The manifesto in [`forkware/`](forkware/) stays [CC0](forkware/LICENSE).
