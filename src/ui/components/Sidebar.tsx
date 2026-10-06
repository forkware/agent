import { ChevronRight, Folder as FolderIcon, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Folder, Task } from "../../sdk/types.ts";
import { api, getState, setState, useUi } from "../api.ts";
import { t } from "../i18n.ts";
import {
  attempt,
  Button,
  confirm,
  cx,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  StatusDot,
} from "../kit/index.tsx";
import { selectTask } from "../sdk.tsx";
import { Slot } from "../slots.tsx";

/** Id of the row being renamed inline. */
type Editing = string | null;

export function Sidebar() {
  const folders = useUi((s) => s.data?.folders ?? []);
  const [editing, setEditing] = useState<Editing>(null);

  const createFolder = async (parentId: string | null) => {
    const folder = await attempt(() => api.post<Folder>("/api/folders", { name: t("newFolder"), parentId }));
    if (folder) setEditing(folder.id);
  };

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-10 items-center justify-between px-3 pl-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{t("folders")}</span>
        <IconButton icon={FolderPlus} label={t("newFolder")} onClick={() => createFolder(null)} />
      </div>
      <Slot name="sidebar.header" />
      <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label={t("folders")}>
        {folders.length === 0 ? (
          <div className="mx-2 mt-2 rounded-lg border border-dashed border-line p-4 text-center">
            <FolderOpen size={18} className="mx-auto text-faint" strokeWidth={1.75} />
            <div className="mt-2 font-medium">{t("noFoldersTitle")}</div>
            <div className="mt-1 text-xs text-muted">{t("noFoldersBody")}</div>
            <Button size="sm" icon={FolderPlus} className="mt-3" onClick={() => createFolder(null)}>
              {t("createFolder")}
            </Button>
          </div>
        ) : (
          <FolderList parentId={null} depth={0} editing={editing} setEditing={setEditing} createFolder={createFolder} />
        )}
      </nav>
    </aside>
  );
}

interface TreeProps {
  editing: Editing;
  setEditing: (id: Editing) => void;
  createFolder: (parentId: string | null) => void;
}

function FolderList({ parentId, depth, ...tree }: { parentId: string | null; depth: number } & TreeProps) {
  const folders = useUi((s) => s.data?.folders ?? []);
  return (
    <ul role={depth === 0 ? "tree" : "group"}>
      {folders
        .filter((f) => f.parentId === parentId)
        .map((folder) => (
          <FolderNode key={folder.id} folder={folder} depth={depth} {...tree} />
        ))}
    </ul>
  );
}

function FolderNode({ folder, depth, ...tree }: { folder: Folder; depth: number } & TreeProps) {
  const collapsed = useUi((s) => !!s.collapsed[folder.id]);
  const tasks = useUi((s) => s.data?.tasks ?? []).filter((task) => task.folderId === folder.id);
  const toggle = () => setState({ collapsed: { ...getState().collapsed, [folder.id]: !collapsed } });

  const createTask = async () => {
    const task = await attempt(() => api.post<Task>("/api/tasks", { folderId: folder.id, title: t("newTask") }));
    if (!task) return;
    setState({ collapsed: { ...getState().collapsed, [folder.id]: false } });
    tree.setEditing(task.id);
  };

  return (
    <li role="treeitem" aria-expanded={!collapsed}>
      <Row depth={depth} onClick={toggle}>
        <ChevronRight size={13} className={cx("shrink-0 text-faint transition-transform", !collapsed && "rotate-90")} />
        <FolderIcon size={14} className="shrink-0 text-muted" strokeWidth={1.75} />
        <Name
          value={folder.name}
          editing={tree.editing === folder.id}
          onDone={(name) => {
            tree.setEditing(null);
            if (name && name !== folder.name) void attempt(() => api.patch(`/api/folders/${folder.id}`, { name }));
          }}
          className="font-medium"
        />
        <Slot name="folder.badge" folder={folder} />
        <span className="ml-auto flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <IconButton icon={Plus} label={t("newTask")} onClick={(e) => (e.stopPropagation(), createTask())} />
          <Menu>
            <MenuTrigger asChild>
              <IconButton icon={MoreHorizontal} label={folder.name} onClick={(e) => e.stopPropagation()} />
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={Plus} onSelect={createTask}>
                {t("newTask")}
              </MenuItem>
              <MenuItem icon={FolderPlus} onSelect={() => tree.createFolder(folder.id)}>
                {t("newSubfolder")}
              </MenuItem>
              <MenuItem icon={Pencil} onSelect={() => tree.setEditing(folder.id)}>
                {t("rename")}
              </MenuItem>
              <Slot name="folder.menu" folder={folder} />
              <MenuSeparator />
              <MenuItem
                icon={Trash2}
                danger
                onSelect={() =>
                  confirm({
                    title: t("deleteFolderTitle", { name: folder.name }),
                    description: t("deleteFolderBody"),
                    confirm: t("delete"),
                    onConfirm: () => void attempt(() => api.del(`/api/folders/${folder.id}`)),
                  })
                }
              >
                {t("delete")}
              </MenuItem>
            </MenuContent>
          </Menu>
        </span>
      </Row>
      {!collapsed && (
        <>
          <FolderList parentId={folder.id} depth={depth + 1} {...tree} />
          <ul role="group">
            {tasks.map((task) => (
              <TaskNode key={task.id} task={task} depth={depth + 1} {...tree} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

function TaskNode({ task, depth, ...tree }: { task: Task; depth: number } & TreeProps) {
  const selected = useUi((s) => s.selectedTaskId === task.id);
  const status = useUi((s) => s.data?.statuses.find((x) => x.id === task.status));
  const running = useUi((s) => s.data?.sessions.some((x) => x.taskId === task.id && x.state === "running"));

  return (
    <li role="treeitem" aria-selected={selected}>
      <Row depth={depth} selected={selected} onClick={() => selectTask(task.id)}>
        <span className="grid w-[13px] shrink-0 place-items-center" />
        <span className="grid w-[14px] shrink-0 place-items-center">
          <StatusDot color={status?.color ?? "gray"} pulse={running} />
        </span>
        <Name
          value={task.title}
          editing={tree.editing === task.id}
          onDone={(title) => {
            tree.setEditing(null);
            if (title && title !== task.title) void attempt(() => api.patch(`/api/tasks/${task.id}`, { title }));
            selectTask(task.id);
          }}
        />
        <Slot name="task.badge" task={task} />
        <span className="ml-auto flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Menu>
            <MenuTrigger asChild>
              <IconButton icon={MoreHorizontal} label={task.title} onClick={(e) => e.stopPropagation()} />
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={Pencil} onSelect={() => tree.setEditing(task.id)}>
                {t("rename")}
              </MenuItem>
              <Slot name="task.menu" task={task} />
              <MenuSeparator />
              <MenuItem
                icon={Trash2}
                danger
                onSelect={() =>
                  confirm({
                    title: t("deleteTaskTitle", { name: task.title }),
                    description: t("deleteTaskBody"),
                    confirm: t("delete"),
                    onConfirm: () => void attempt(() => api.del(`/api/tasks/${task.id}`)),
                  })
                }
              >
                {t("delete")}
              </MenuItem>
            </MenuContent>
          </Menu>
        </span>
      </Row>
    </li>
  );
}

function Row({
  depth,
  selected,
  onClick,
  children,
}: {
  depth: number;
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ paddingLeft: 6 + depth * 14 }}
      className={cx(
        "group relative flex h-8 cursor-default select-none items-center gap-1.5 rounded-md pr-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60",
        selected ? "bg-hover text-text" : "text-text/90 hover:bg-hover/60",
      )}
    >
      {selected && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-accent" />}
      {children}
    </div>
  );
}

/** A name that turns into an input while renaming. */
function Name({
  value,
  editing,
  onDone,
  className,
}: {
  value: string;
  editing: boolean;
  onDone: (value: string) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  if (!editing) return <span className={cx("min-w-0 truncate", className)}>{value}</span>;
  return (
    <input
      ref={input}
      defaultValue={value}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => onDone(e.target.value.trim())}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = value;
          e.currentTarget.blur();
        }
      }}
      className="h-6 min-w-0 flex-1 rounded border border-accent bg-bg px-1.5 text-[13px] outline-none"
    />
  );
}
