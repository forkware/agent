import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { definePlugin } from "#sdk/server";

export interface Binding {
  path: string;
}

export default definePlugin((ctx) => {
  // The nearest folder with a directory wins, so subfolders inherit it.
  ctx.workspaces.registerResolver((_task, folders) => {
    for (const folder of folders) {
      const binding = folder.meta[ctx.id] as Binding | undefined;
      if (binding?.path && existsSync(binding.path)) return binding.path;
    }
    return undefined;
  });

  ctx.rpc.handle("bind", ({ folderId, path }: { folderId: string; path: string }) => {
    if (!path?.trim()) return ctx.folders.update(folderId, { meta: { [ctx.id]: null } });
    const dir = resolve(path.trim().replace(/^~(?=$|[/\\])/, homedir()));
    if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`Not a directory: ${dir}`);
    return ctx.folders.update(folderId, { meta: { [ctx.id]: { path: dir } satisfies Binding } });
  });
});
