// Data shared by the server, the UI and plugins.

/** Plugin-owned data, keyed by plugin id: `meta["local-dir"] = { path }`. */
export type Meta = Record<string, unknown>;

export interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
  meta: Meta;
  createdAt: number;
}

export interface Task {
  id: string;
  folderId: string;
  title: string;
  body: string;
  status: string;
  position: number;
  meta: Meta;
  createdAt: number;
  updatedAt: number;
}

/** The core sorts and filters by category; it knows nothing about the statuses themselves. */
export type StatusCategory = "open" | "active" | "done";

export type StatusColor = "gray" | "blue" | "amber" | "green" | "red" | "violet";

export interface StatusDef {
  id: string;
  label: string;
  color: StatusColor;
  category: StatusCategory;
  /** Plugin that registered it, or "core". */
  plugin: string;
}

export type SessionState = "running" | "exited";

export interface Session {
  id: string;
  taskId: string;
  provider: string;
  cwd: string;
  state: SessionState;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
}

export interface ProviderInfo {
  id: string;
  label: string;
  plugin: string;
  /** Whether its command was found in PATH. */
  available: boolean;
}

export interface Permission {
  id: string;
  reason: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface AppInfo {
  name: string;
  version: string;
  /** Directory of the app's own source code: the user's fork. */
  root: string;
}

export interface AppState {
  app: AppInfo;
  folders: Folder[];
  tasks: Task[];
  statuses: StatusDef[];
  providers: ProviderInfo[];
  sessions: Session[];
  plugins: PluginInfo[];
}

/** A write a plugin made, recorded by rule 7 of the manifesto. */
export interface AuditEntry {
  at: number;
  plugin: string;
  action: string;
  permission: string;
  /** False when the plugin did not declare the permission: an alarm. */
  declared: boolean;
}
