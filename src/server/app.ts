// Wires the core together. The HTTP layer and the tests both start from here.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "./db.ts";
import { EventBus } from "./events.ts";
import { Plugins } from "./plugins.ts";
import { Sessions } from "./sessions.ts";
import { Store } from "./store.ts";
import type { AppInfo, AppState } from "../sdk/types.ts";

export interface AppOptions {
  /** The app's source directory. */
  root: string;
  dataDir: string;
  /** Defaults to <root>/plugins. */
  pluginsDir?: string;
  defaultProvider?: string;
}

export type Core = Awaited<ReturnType<typeof createCore>>;

export async function createCore(options: AppOptions) {
  mkdirSync(options.dataDir, { recursive: true });
  const pkg = JSON.parse(readFileSync(join(options.root, "package.json"), "utf8"));
  const app: AppInfo = { name: pkg.name, version: pkg.version, root: options.root };
  const db = openDb(join(options.dataDir, "agent.db"));
  const events = new EventBus();
  const store = new Store(db, events);
  const sessions = new Sessions(db, events, store, options.dataDir);
  sessions.defaultProvider = options.defaultProvider;
  const plugins = new Plugins({ app, db, events, store, sessions });
  await plugins.loadDir(options.pluginsDir ?? join(options.root, "plugins"));

  const state = (): AppState => ({
    app,
    folders: store.folders(),
    tasks: store.tasks(),
    statuses: store.statuses(),
    providers: sessions.providerInfo(),
    sessions: sessions.list(),
    plugins: [...plugins.loaded.values()].map((p) => p.info),
  });

  const close = () => {
    sessions.stopAll();
    db.close();
  };

  return { app, db, events, store, sessions, plugins, state, close };
}
