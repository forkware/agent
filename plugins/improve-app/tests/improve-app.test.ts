import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { definePlugin } from "../../../src/sdk/server.ts";
import { fakeProvider, root, testCore, waitFor } from "../../../test/helpers.ts";

async function setup() {
  const core = await testCore({ pluginsDir: join(root, "plugins"), defaultProvider: "fake" });
  await core.plugins.load(
    "fake-agent",
    { permissions: { "agents:provide": "" } },
    definePlugin((ctx) => ctx.agents.registerProvider(fakeProvider('printf "%s" "$1"'))),
  );
  const start = (input = {}) =>
    core.plugins.loaded.get("improve-app")!.rpc.get("start")!(input) as Promise<{
      folderId: string;
      taskId: string;
      sessionId: string;
    }>;
  return { core, start };
}

describe("improve-app", () => {
  it("creates the app folder once and a task per press", async () => {
    const { core, start } = await setup();
    const first = await start({ title: "Доработка" });
    const second = await start({ title: "Доработка" });

    expect(core.store.folders().map((f) => f.name)).toEqual(["agent"]);
    expect(second.folderId).toBe(first.folderId);
    expect(core.store.tasks(first.folderId).map((t) => t.title)).toEqual(["Доработка 1", "Доработка 2"]);
  });

  it("runs the workflow: an agent in the app's own source directory, told about the manifesto", async () => {
    const { core, start } = await setup();
    const { sessionId } = await start();

    const session = core.sessions.get(sessionId)!;
    expect(session.cwd).toBe(root);
    await waitFor(() => core.sessions.scrollback(sessionId).includes("forkware/manifesto.md"));
  });

  it("recreates the folder if the user deleted it", async () => {
    const { core, start } = await setup();
    const { folderId } = await start();
    core.store.deleteFolder(folderId);
    const again = await start();
    expect(again.folderId).not.toBe(folderId);
    expect(core.store.folders()).toHaveLength(1);
  });
});
