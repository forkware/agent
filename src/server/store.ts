// Folders, tasks and the status model.
import { randomUUID } from "node:crypto";
import type { Db } from "./db.ts";
import type { EventBus } from "./events.ts";
import type { Folder, Meta, StatusDef, Task } from "../sdk/types.ts";
import type { TransitionGuard } from "../sdk/server.ts";

/** An error the user should see as is: bad input, a refused transition. */
export class UserError extends Error {}

const coreStatuses: StatusDef[] = [
  { id: "todo", label: "To do", color: "gray", category: "open", plugin: "core" },
  { id: "in_progress", label: "In progress", color: "blue", category: "active", plugin: "core" },
  { id: "done", label: "Done", color: "green", category: "done", plugin: "core" },
];

type Row = Record<string, any>;

const toFolder = (r: Row): Folder => ({
  id: r.id,
  parentId: r.parent_id,
  name: r.name,
  position: r.position,
  meta: JSON.parse(r.meta),
  createdAt: r.created_at,
});

const toTask = (r: Row): Task => ({
  id: r.id,
  folderId: r.folder_id,
  title: r.title,
  body: r.body,
  status: r.status,
  position: r.position,
  meta: JSON.parse(r.meta),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mergeMeta = (meta: Meta, patch?: Meta): Meta => (patch ? { ...meta, ...patch } : meta);

export class Store {
  private statusDefs = new Map(coreStatuses.map((s) => [s.id, s]));
  private guards = new Set<TransitionGuard>();
  private db: Db;
  private events: EventBus;

  constructor(db: Db, events: EventBus) {
    this.db = db;
    this.events = events;
  }

  // Statuses

  statuses(): StatusDef[] {
    return [...this.statusDefs.values()];
  }

  registerStatuses(plugin: string, defs: Omit<StatusDef, "plugin">[]): void {
    for (const def of defs) this.statusDefs.set(def.id, { ...def, plugin });
    this.events.emit("status.registered", { plugin, ids: defs.map((d) => d.id) });
  }

  guardTransition(guard: TransitionGuard): () => void {
    this.guards.add(guard);
    return () => this.guards.delete(guard);
  }

  // Folders

  folders(): Folder[] {
    return this.db.prepare("SELECT * FROM folders ORDER BY position").all().map(toFolder);
  }

  folder(id: string): Folder | undefined {
    const row = this.db.prepare("SELECT * FROM folders WHERE id = ?").get(id);
    return row ? toFolder(row) : undefined;
  }

  chain(id: string): Folder[] {
    const chain: Folder[] = [];
    for (let f = this.folder(id); f; f = f.parentId ? this.folder(f.parentId) : undefined) chain.push(f);
    return chain;
  }

  createFolder(input: { name: string; parentId?: string | null; meta?: Meta }): Folder {
    const parentId = input.parentId ?? null;
    if (parentId && !this.folder(parentId)) throw new UserError(`No folder ${parentId}`);
    const name = requireName(input.name);
    const { last } = this.db
      .prepare("SELECT max(position) AS last FROM folders WHERE parent_id IS ?")
      .get(parentId) as { last: number | null };
    const folder: Folder = {
      id: randomUUID(),
      parentId,
      name,
      position: (last ?? 0) + 1,
      meta: input.meta ?? {},
      createdAt: Date.now(),
    };
    this.db
      .prepare("INSERT INTO folders VALUES (?, ?, ?, ?, ?, ?)")
      .run(folder.id, parentId, name, folder.position, JSON.stringify(folder.meta), folder.createdAt);
    this.events.emit("folder.created", folder);
    return folder;
  }

  updateFolder(id: string, patch: { name?: string; parentId?: string | null; meta?: Meta }): Folder {
    const folder = this.folder(id);
    if (!folder) throw new UserError(`No folder ${id}`);
    if (patch.parentId !== undefined && patch.parentId !== null) {
      if (this.chain(patch.parentId).some((f) => f.id === id)) throw new UserError("A folder cannot move into itself");
    }
    const next: Folder = {
      ...folder,
      name: patch.name !== undefined ? requireName(patch.name) : folder.name,
      parentId: patch.parentId !== undefined ? patch.parentId : folder.parentId,
      meta: mergeMeta(folder.meta, patch.meta),
    };
    this.db
      .prepare("UPDATE folders SET name = ?, parent_id = ?, meta = ? WHERE id = ?")
      .run(next.name, next.parentId, JSON.stringify(next.meta), id);
    this.events.emit("folder.updated", next);
    return next;
  }

  /** Deletes the folder with its subfolders and tasks. */
  deleteFolder(id: string): void {
    const folder = this.folder(id);
    if (!folder) return;
    const ids = this.subtree(id);
    const tasks = ids.flatMap((fid) => this.tasks(fid));
    for (const task of tasks) this.events.emit("task.deleting", task);
    this.db.prepare("DELETE FROM folders WHERE id = ?").run(id);
    this.events.emit("folder.deleted", folder);
  }

  private subtree(id: string): string[] {
    const children = this.db.prepare("SELECT id FROM folders WHERE parent_id = ?").all(id) as { id: string }[];
    return [id, ...children.flatMap((c) => this.subtree(c.id))];
  }

  // Tasks

  tasks(folderId?: string): Task[] {
    const rows = folderId
      ? this.db.prepare("SELECT * FROM tasks WHERE folder_id = ? ORDER BY position").all(folderId)
      : this.db.prepare("SELECT * FROM tasks ORDER BY position").all();
    return rows.map(toTask);
  }

  task(id: string): Task | undefined {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    return row ? toTask(row) : undefined;
  }

  createTask(input: { folderId: string; title: string; body?: string; status?: string; meta?: Meta }): Task {
    if (!this.folder(input.folderId)) throw new UserError(`No folder ${input.folderId}`);
    const status = input.status ?? "todo";
    if (!this.statusDefs.has(status)) throw new UserError(`Unknown status ${status}`);
    const { last } = this.db
      .prepare("SELECT max(position) AS last FROM tasks WHERE folder_id = ?")
      .get(input.folderId) as { last: number | null };
    const now = Date.now();
    const task: Task = {
      id: randomUUID(),
      folderId: input.folderId,
      title: requireName(input.title),
      body: input.body ?? "",
      status,
      position: (last ?? 0) + 1,
      meta: input.meta ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare("INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(task.id, task.folderId, task.title, task.body, status, task.position, JSON.stringify(task.meta), now, now);
    this.events.emit("task.created", task);
    return task;
  }

  updateTask(id: string, patch: { title?: string; body?: string; folderId?: string; meta?: Meta }): Task {
    const task = this.task(id);
    if (!task) throw new UserError(`No task ${id}`);
    if (patch.folderId && !this.folder(patch.folderId)) throw new UserError(`No folder ${patch.folderId}`);
    const next: Task = {
      ...task,
      title: patch.title !== undefined ? requireName(patch.title) : task.title,
      body: patch.body ?? task.body,
      folderId: patch.folderId ?? task.folderId,
      meta: mergeMeta(task.meta, patch.meta),
      updatedAt: Date.now(),
    };
    this.saveTask(next);
    this.events.emit("task.updated", next);
    return next;
  }

  setStatus(id: string, status: string): Task {
    const task = this.task(id);
    if (!task) throw new UserError(`No task ${id}`);
    if (!this.statusDefs.has(status)) throw new UserError(`Unknown status ${status}`);
    if (task.status === status) return task;
    for (const guard of this.guards) {
      const verdict = guard(task, task.status, status);
      if (verdict !== true) throw new UserError(verdict);
    }
    const next: Task = { ...task, status, updatedAt: Date.now() };
    this.saveTask(next);
    this.events.emit("task.updated", next);
    this.events.emit("task.status.changed", { task: next, from: task.status, to: status });
    return next;
  }

  deleteTask(id: string): void {
    const task = this.task(id);
    if (!task) return;
    this.events.emit("task.deleting", task);
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    this.events.emit("task.deleted", task);
  }

  private saveTask(t: Task): void {
    this.db
      .prepare("UPDATE tasks SET folder_id = ?, title = ?, body = ?, status = ?, meta = ?, updated_at = ? WHERE id = ?")
      .run(t.folderId, t.title, t.body, t.status, JSON.stringify(t.meta), t.updatedAt, t.id);
  }
}

function requireName(name: unknown): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) throw new UserError("Name cannot be empty");
  return trimmed;
}
