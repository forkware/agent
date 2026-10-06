// What a plugin's ui.tsx imports: `import { defineUiPlugin, Button, rpc } from "#sdk/ui"`.
import { getState, refresh, rpc, setState, useUi, onEvent } from "./api.ts";
import type { UiPlugin } from "./slots.tsx";

export type * from "../sdk/types.ts";
export type { SlotName, SlotProps, UiPlugin } from "./slots.tsx";
export * from "./kit/index.tsx";
export { addStrings, lang, t } from "./i18n.ts";
export { getState, onEvent, refresh, rpc, useUi };

export function defineUiPlugin(plugin: UiPlugin): UiPlugin {
  return plugin;
}

/** Opens a task in the right panel. */
export function selectTask(taskId: string | null): void {
  const { data, collapsed } = getState();
  const open = { ...collapsed };
  // Unfold the folders it is in.
  let folderId = data?.tasks.find((t) => t.id === taskId)?.folderId ?? null;
  while (folderId) {
    delete open[folderId];
    folderId = data?.folders.find((f) => f.id === folderId)?.parentId ?? null;
  }
  setState({ selectedTaskId: taskId, collapsed: open });
}
