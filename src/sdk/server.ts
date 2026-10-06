// The contract between the core and a plugin's server part (plugins/<id>/server.ts).
import type { AppInfo, Folder, Meta, Session, StatusDef, Task } from "./types.ts";

export type * from "./types.ts";

export type Unsubscribe = () => void;

/** Returns true to allow the transition, or a reason to refuse it. */
export type TransitionGuard = (task: Task, from: string, to: string) => true | string;

/** Returns the directory to run agents for the task in, or undefined to let others decide. */
export type WorkspaceResolver = (task: Task, folders: Folder[]) => string | undefined;

export interface AgentProvider {
  id: string;
  label: string;
  /** Executable looked up in PATH. */
  command: string;
  /** Arguments for a new session; `prompt` is the first message, when there is one. */
  args?: (options: { prompt?: string }) => string[];
  env?: Record<string, string>;
}

export interface StartOptions {
  /** Provider id; the app's default provider when omitted. */
  provider?: string;
  prompt?: string;
}

/**
 * What a plugin can do. Reads are free. Every write needs a permission declared in
 * plugin.json; the core records each write and raises an alarm for undeclared ones.
 */
export interface PluginContext {
  /** The plugin's id: its directory name. */
  id: string;
  app: AppInfo;
  log: (...args: unknown[]) => void;

  events: {
    /** Core events: folder.*, task.*, task.status.changed, session.*, audit.alarm. */
    on: (name: string, handler: (payload: any) => void) => Unsubscribe;
    /** Emits `<plugin id>.<name>`. */
    emit: (name: string, payload?: unknown) => void;
  };

  statuses: {
    list: () => StatusDef[];
    /** Permission: statuses:register */
    register: (defs: Omit<StatusDef, "plugin">[]) => void;
  };

  folders: {
    list: () => Folder[];
    get: (id: string) => Folder | undefined;
    /** The folder and its ancestors, nearest first. */
    chain: (id: string) => Folder[];
    /** Permission: folders:write */
    create: (input: { name: string; parentId?: string | null; meta?: Meta }) => Folder;
    /** Permission: folders:write. `meta` is merged per key. */
    update: (id: string, patch: { name?: string; parentId?: string | null; meta?: Meta }) => Folder;
  };

  tasks: {
    list: (folderId?: string) => Task[];
    get: (id: string) => Task | undefined;
    /** Permission: tasks:write */
    create: (input: { folderId: string; title: string; body?: string; status?: string; meta?: Meta }) => Task;
    /** Permission: tasks:write. `meta` is merged per key. */
    update: (id: string, patch: { title?: string; body?: string; folderId?: string; meta?: Meta }) => Task;
    /** Permission: tasks:write. Runs the guards, then emits task.status.changed. */
    setStatus: (id: string, status: string) => Task;
    /** Permission: tasks:guard */
    guardTransition: (guard: TransitionGuard) => Unsubscribe;
  };

  agents: {
    sessions: (taskId?: string) => Session[];
    /** Permission: agents:provide */
    registerProvider: (provider: AgentProvider) => void;
    /** Permission: agents:spawn */
    start: (taskId: string, options?: StartOptions) => Session;
  };

  workspaces: {
    /** Permission: workspaces:resolve */
    registerResolver: (resolver: WorkspaceResolver) => void;
  };

  /** Procedures the plugin's UI calls with `rpc(pluginId, name, input)`. */
  rpc: {
    handle: (name: string, handler: (input: any) => unknown) => void;
  };

  /** The plugin's own key-value storage. */
  kv: {
    get: <T = unknown>(key: string) => T | undefined;
    set: (key: string, value: unknown) => void;
  };
}

export interface ServerPlugin {
  setup: (ctx: PluginContext) => void | Promise<void>;
}

export function definePlugin(setup: ServerPlugin["setup"]): ServerPlugin {
  return { setup };
}
