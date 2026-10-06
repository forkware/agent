// Places in the interface plugins add to. Each plugin's ui.tsx is found at build time.
import type { ComponentType } from "react";
import type { Folder, Session, Task } from "../sdk/types.ts";
import { useUi } from "./api.ts";

/** Slot name → props its components receive. */
export interface SlotProps {
  /** Top bar, right side. */
  "header.actions": {};
  /** Above the folder tree. */
  "sidebar.header": {};
  /** After a folder's name. */
  "folder.badge": { folder: Folder };
  /** Items in a folder's menu: render <MenuItem>s. */
  "folder.menu": { folder: Folder };
  /** After a task's name in the tree. */
  "task.badge": { task: Task };
  /** Items in a task's menu: render <MenuItem>s. */
  "task.menu": { task: Task };
  /** Next to the status in the task header. */
  "task.header": { task: Task };
  /** Above the agent terminal. */
  "session.toolbar": { task: Task; session: Session };
}

export type SlotName = keyof SlotProps;

export interface UiPlugin {
  slots?: { [K in SlotName]?: ComponentType<SlotProps[K]> | ComponentType<SlotProps[K]>[] };
}

const modules = import.meta.glob<{ default: UiPlugin }>("../../plugins/*/ui.tsx", { eager: true });

const plugins = Object.entries(modules).map(([path, mod]) => ({
  id: path.split("/").at(-2)!,
  plugin: mod.default,
}));

/** Renders what enabled plugins contributed to a slot. */
export function Slot<K extends SlotName>({ name, ...props }: { name: K } & SlotProps[K]) {
  const enabled = useUi((s) => s.data?.plugins);
  return (
    <>
      {plugins
        .filter(({ id }) => enabled?.some((p) => p.id === id))
        .flatMap(({ id, plugin }) => {
          const contributed = plugin.slots?.[name];
          const components = (Array.isArray(contributed) ? contributed : contributed ? [contributed] : []) as ComponentType<
            SlotProps[K]
          >[];
          return components.map((Component, i) => <Component key={`${id}-${i}`} {...(props as unknown as SlotProps[K])} />);
        })}
    </>
  );
}
