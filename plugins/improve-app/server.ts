import { definePlugin } from "#sdk/server";
import { improveWorkflow } from "./workflow.ts";

export default definePlugin((ctx) => {
  const workflow = improveWorkflow(ctx);

  /** The folder named after the app, created on first use. */
  const appFolder = () => {
    const known = ctx.kv.get<string>("folderId");
    const existing = known ? ctx.folders.get(known) : undefined;
    if (existing) return existing;
    const folder = ctx.folders.create({ name: ctx.app.name, meta: { [ctx.id]: { app: true } } });
    ctx.kv.set("folderId", folder.id);
    return folder;
  };

  // Agents for tasks in that folder work on the app's own code.
  ctx.workspaces.registerResolver((_task, folders) => {
    const id = ctx.kv.get<string>("folderId");
    return folders.some((f) => f.id === id) ? ctx.app.root : undefined;
  });

  /** `title` comes from the UI, in the user's language. */
  ctx.rpc.handle("start", async ({ title = "Improvement" }: { title?: string }) => {
    const folder = appFolder();
    const count = ctx.tasks.list(folder.id).length;
    const task = ctx.tasks.create({ folderId: folder.id, title: `${title} ${count + 1}` });
    const { sessionId } = await workflow.invoke({ taskId: task.id });
    return { folderId: folder.id, taskId: task.id, sessionId };
  });
});
