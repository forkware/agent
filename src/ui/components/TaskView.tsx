import { ChevronDown, Circle, Bot, Play, Plus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Session, StatusCategory, Task } from "../../sdk/types.ts";
import { api, useUi } from "../api.ts";
import { t } from "../i18n.ts";
import {
  attempt,
  Button,
  cx,
  EmptyState,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  StatusDot,
} from "../kit/index.tsx";
import { Slot } from "../slots.tsx";
import { Terminal } from "./Terminal.tsx";

export function TaskView() {
  const task = useUi((s) => s.data?.tasks.find((x) => x.id === s.selectedTaskId));
  if (!task) return <EmptyState icon={Circle} title={t("noTaskTitle")} body={t("noTaskBody")} />;
  return <TaskPanel key={task.id} task={task} />;
}

function TaskPanel({ task }: { task: Task }) {
  const folder = useUi((s) => s.data?.folders.find((f) => f.id === task.folderId));
  const sessions = useUi((s) => s.data?.sessions.filter((x) => x.taskId === task.id) ?? []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = sessions.find((s) => s.id === activeId) ?? sessions.at(-1);

  // A session that just started becomes the active tab.
  const newest = sessions.at(-1)?.id;
  useEffect(() => setActiveId(newest ?? null), [newest]);

  const start = async (provider?: string) => {
    const session = await attempt(() => api.post<Session>(`/api/tasks/${task.id}/sessions`, { provider }));
    if (session) setActiveId(session.id);
  };

  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
        <div className="min-w-0">
          {folder && <div className="truncate text-[11px] text-faint">{folder.name}</div>}
          <h1 className="truncate text-[15px] font-semibold leading-tight">{task.title}</h1>
        </div>
        <StatusPicker task={task} />
        <Slot name="task.header" task={task} />
        <div className="ml-auto">
          <StartAgent onStart={start} compact={sessions.length > 0} />
        </div>
      </header>

      {sessions.length > 0 && (
        <div role="tablist" className="flex h-9 shrink-0 items-end gap-1 overflow-x-auto border-b border-line px-3">
          {sessions.map((s, i) => (
            <SessionTab key={s.id} session={s} index={i + 1} active={s.id === active?.id} onSelect={() => setActiveId(s.id)} />
          ))}
        </div>
      )}

      {active && (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line bg-panel/60 px-4 text-xs text-muted">
          <span className="truncate font-mono text-[11px]" title={active.cwd}>
            {active.cwd}
          </span>
          {active.state === "exited" && <span className="text-faint">· {t("exited", { code: active.exitCode ?? "?" })}</span>}
          <span className="ml-auto flex items-center gap-1">
            <Slot name="session.toolbar" task={task} session={active} />
            {active.state === "running" && (
              <Button
                size="sm"
                variant="ghost"
                icon={Square}
                onClick={() => void attempt(() => api.post(`/api/sessions/${active.id}/kill`))}
              >
                {t("stop")}
              </Button>
            )}
          </span>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {sessions.length === 0 ? (
          <EmptyState icon={Bot} title={t("noSessionsTitle")} body={t("noSessionsBody")}>
            <StartAgent onStart={start} />
          </EmptyState>
        ) : (
          sessions.map((s) => <Terminal key={s.id} sessionId={s.id} visible={s.id === active?.id} />)
        )}
      </div>
    </section>
  );
}

const categoryOrder: StatusCategory[] = ["open", "active", "done"];

function StatusPicker({ task }: { task: Task }) {
  const statuses = useUi((s) => s.data?.statuses ?? []);
  const current = statuses.find((s) => s.id === task.status);
  const label = (id: string, fallback: string) => {
    const key = `status.${id}`;
    const text = t(key);
    return text === key ? fallback : text;
  };
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          aria-label={t("status")}
          className="inline-flex h-7 shrink-0 items-center gap-2 rounded-full border border-line bg-raised pl-2.5 pr-2 text-xs font-medium transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          <StatusDot color={current?.color ?? "gray"} />
          {current ? label(current.id, current.label) : task.status}
          <ChevronDown size={12} className="text-faint" />
        </button>
      </MenuTrigger>
      <MenuContent>
        {categoryOrder.map((category, i) => {
          const group = statuses.filter((s) => s.category === category);
          if (group.length === 0) return null;
          return (
            <div key={category}>
              {i > 0 && <MenuSeparator />}
              {group.map((s) => (
                <MenuItem
                  key={s.id}
                  onSelect={() => void attempt(() => api.patch(`/api/tasks/${task.id}`, { status: s.id }))}
                >
                  <StatusDot color={s.color} />
                  <span className={cx(s.id === task.status && "font-semibold")}>{label(s.id, s.label)}</span>
                </MenuItem>
              ))}
            </div>
          );
        })}
      </MenuContent>
    </Menu>
  );
}

function StartAgent({ onStart, compact }: { onStart: (provider?: string) => void; compact?: boolean }) {
  const providers = useUi((s) => s.data?.providers ?? []);
  const available = providers.filter((p) => p.available);
  const [main] = available;

  if (providers.length === 0) return <span className="text-xs text-muted">{t("noProviders")}</span>;
  if (!main) return <span className="text-xs text-muted">{t("notInstalled", { agent: providers[0].label })}</span>;

  const label = compact ? t("newAgent") : t("startAgent", { agent: main.label });
  if (available.length === 1)
    return (
      <Button variant={compact ? "secondary" : "primary"} icon={compact ? Plus : Play} onClick={() => onStart(main.id)}>
        {label}
      </Button>
    );
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant={compact ? "secondary" : "primary"} icon={compact ? Plus : Play}>
          {compact ? t("newAgent") : t("startAgent", { agent: "" }).trim()}
          <ChevronDown size={12} />
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        {available.map((p) => (
          <MenuItem key={p.id} icon={Bot} onSelect={() => onStart(p.id)}>
            {p.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function SessionTab({
  session,
  index,
  active,
  onSelect,
}: {
  session: Session;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const provider = useUi((s) => s.data?.providers.find((p) => p.id === session.provider));
  const running = session.state === "running";
  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cx(
        "group relative flex h-8 cursor-default select-none items-center gap-2 rounded-t-md pl-3 pr-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60",
        active ? "bg-bg text-text" : "text-muted hover:text-text",
      )}
    >
      {active && <span className="absolute inset-x-2 top-0 h-[2px] rounded-full bg-accent" />}
      <span
        className={cx("size-1.5 rounded-full", running ? "animate-pulse-dot bg-[var(--s-green)]" : "bg-faint")}
        aria-hidden
      />
      <span className="font-medium">
        {provider?.label ?? session.provider} <span className="text-faint">#{index}</span>
      </span>
      <IconButton
        icon={X}
        label={t("close")}
        className="size-5 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          void attempt(() => api.del(`/api/sessions/${session.id}`));
        }}
      />
    </div>
  );
}
