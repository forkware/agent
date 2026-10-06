// Agent sessions: CLI agents (claude, codex, ...) running in pseudo-terminals.
import { randomUUID } from "node:crypto";
import { accessSync, appendFileSync, constants, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import pty from "@lydell/node-pty";
import type { Db } from "./db.ts";
import type { EventBus } from "./events.ts";
import { UserError, type Store } from "./store.ts";
import type { AgentProvider, StartOptions, WorkspaceResolver } from "../sdk/server.ts";
import type { ProviderInfo, Session } from "../sdk/types.ts";

/** How much output a session keeps in memory for clients that attach later. */
const SCROLLBACK = 2 * 1024 * 1024;

interface Live {
  pty: pty.IPty;
  buffer: string;
}

type Row = Record<string, any>;

const toSession = (r: Row): Session => ({
  id: r.id,
  taskId: r.task_id,
  provider: r.provider,
  cwd: r.cwd,
  state: r.state,
  exitCode: r.exit_code,
  startedAt: r.started_at,
  endedAt: r.ended_at,
});

export class Sessions {
  private providers = new Map<string, AgentProvider & { plugin: string }>();
  private resolvers: WorkspaceResolver[] = [];
  private live = new Map<string, Live>();
  /** Set when the app shuts down; output and exits after that are dropped. */
  private closed = false;
  private db: Db;
  private events: EventBus;
  private store: Store;
  private dataDir: string;
  /** Provider used when a start does not name one. */
  defaultProvider: string | undefined;

  constructor(db: Db, events: EventBus, store: Store, dataDir: string) {
    this.db = db;
    this.events = events;
    this.store = store;
    this.dataDir = dataDir;
    mkdirSync(join(dataDir, "sessions"), { recursive: true });
    // Sessions that were running when the app stopped are gone with it.
    db.prepare("UPDATE sessions SET state = 'exited', ended_at = ? WHERE state = 'running'").run(Date.now());
    events.on("task.deleting", (task) => {
      for (const s of this.list(task.id)) this.remove(s.id);
    });
  }

  registerProvider(plugin: string, provider: AgentProvider): void {
    this.providers.set(provider.id, { ...provider, plugin });
  }

  registerResolver(resolver: WorkspaceResolver): void {
    this.resolvers.push(resolver);
  }

  providerInfo(): ProviderInfo[] {
    return [...this.providers.values()].map((p) => ({
      id: p.id,
      label: p.label,
      plugin: p.plugin,
      available: findExecutable(p.command) !== undefined,
    }));
  }

  list(taskId?: string): Session[] {
    const rows = taskId
      ? this.db.prepare("SELECT * FROM sessions WHERE task_id = ? ORDER BY started_at").all(taskId)
      : this.db.prepare("SELECT * FROM sessions ORDER BY started_at").all();
    return rows.map(toSession);
  }

  get(id: string): Session | undefined {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    return row ? toSession(row) : undefined;
  }

  start(taskId: string, options: StartOptions = {}): Session {
    const task = this.store.task(taskId);
    if (!task) throw new UserError(`No task ${taskId}`);
    const providerId = options.provider ?? this.defaultProvider ?? this.providers.keys().next().value;
    const provider = providerId ? this.providers.get(providerId) : undefined;
    if (!provider) throw new UserError(providerId ? `No agent provider ${providerId}` : "No agent providers installed");
    const command = findExecutable(provider.command);
    if (!command) throw new UserError(`${provider.label} is not installed: \`${provider.command}\` is not in PATH`);

    const cwd = this.workspace(taskId);
    const session: Session = {
      id: randomUUID(),
      taskId,
      provider: provider.id,
      cwd,
      state: "running",
      exitCode: null,
      startedAt: Date.now(),
      endedAt: null,
    };
    const proc = pty.spawn(command, provider.args?.({ prompt: options.prompt }) ?? [], {
      name: "xterm-256color",
      cols: 120,
      rows: 32,
      cwd,
      env: { ...process.env, ...provider.env, TERM: "xterm-256color", COLORTERM: "truecolor" } as Record<string, string>,
    });
    this.db
      .prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, 'running', NULL, ?, NULL)")
      .run(session.id, taskId, provider.id, cwd, session.startedAt);

    const live: Live = { pty: proc, buffer: "" };
    this.live.set(session.id, live);
    const log = this.logFile(session.id);
    proc.onData((data) => {
      if (this.closed) return;
      live.buffer = (live.buffer + data).slice(-SCROLLBACK);
      appendFileSync(log, data);
      this.events.emit("session.output", { id: session.id, data });
    });
    proc.onExit(({ exitCode }) => {
      this.live.delete(session.id);
      if (this.closed || !this.get(session.id)) return;
      this.db
        .prepare("UPDATE sessions SET state = 'exited', exit_code = ?, ended_at = ? WHERE id = ?")
        .run(exitCode, Date.now(), session.id);
      this.events.emit("session.exited", { ...this.get(session.id), taskId });
    });

    this.events.emit("session.started", session);
    return session;
  }

  /** Output so far, for a client that attaches now. */
  scrollback(id: string): string {
    const live = this.live.get(id);
    if (live) return live.buffer;
    try {
      return readFileSync(this.logFile(id), "utf8").slice(-SCROLLBACK);
    } catch {
      return "";
    }
  }

  write(id: string, data: string): void {
    this.live.get(id)?.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    if (cols > 0 && rows > 0) this.live.get(id)?.pty.resize(Math.floor(cols), Math.floor(rows));
  }

  kill(id: string): void {
    this.live.get(id)?.pty.kill();
  }

  /** Stops the session and forgets it with its output. */
  remove(id: string): void {
    const session = this.get(id);
    this.kill(id);
    this.live.delete(id);
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    rmSync(this.logFile(id), { force: true });
    if (session) this.events.emit("session.removed", session);
  }

  stopAll(): void {
    this.closed = true;
    for (const id of this.live.keys()) this.kill(id);
  }

  private workspace(taskId: string): string {
    const task = this.store.task(taskId)!;
    const folders = this.store.chain(task.folderId);
    for (const resolve of this.resolvers) {
      const dir = resolve(task, folders);
      if (dir) return dir;
    }
    const scratch = join(this.dataDir, "workspaces", taskId);
    mkdirSync(scratch, { recursive: true });
    return scratch;
  }

  private logFile(id: string): string {
    return join(this.dataDir, "sessions", `${id}.log`);
  }
}

/** Full path of an executable in PATH, honouring PATHEXT on Windows. */
export function findExecutable(command: string): string | undefined {
  const exts = process.platform === "win32" ? ["", ...(process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")] : [""];
  const dirs = command.includes("/") || command.includes("\\") ? [""] : (process.env.PATH ?? "").split(delimiter);
  for (const dir of dirs) {
    for (const ext of exts) {
      const file = dir ? join(dir, command + ext) : command + ext;
      try {
        accessSync(file, constants.X_OK);
        if (statSync(file).isFile()) return file;
      } catch {}
    }
  }
  return undefined;
}
