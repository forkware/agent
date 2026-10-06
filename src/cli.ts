// Entry point.
//   node src/cli.ts                      desktop window
//   node src/cli.ts --server [--port N]  web server, open the printed link in a browser
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createCore } from "./server/app.ts";
import { startHttp } from "./server/http.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { values: args } = parseArgs({
  options: {
    server: { type: "boolean", default: false },
    host: { type: "string", default: "127.0.0.1" },
    port: { type: "string" },
    token: { type: "string" },
    built: { type: "boolean", default: false },
    "data-dir": { type: "string" },
    provider: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (args.help) {
  console.log(`Usage: npm start -- [options]

  --server          Run as a web server instead of a desktop window
  --host <host>     Address to listen on (default 127.0.0.1)
  --port <port>     Port (default 4870 for --server, any free one for the window)
  --token <token>   Login token for --server (default: kept in the data directory)
  --built           Serve the UI built by \`npm run build\` instead of compiling it live
  --data-dir <dir>  Where folders, tasks and sessions are stored
  --provider <id>   Default agent (default claude-code)`);
  process.exit(0);
}

const dataDir = args["data-dir"] ?? process.env.AGENT_DATA_DIR ?? defaultDataDir();
const core = await createCore({ root, dataDir, defaultProvider: args.provider ?? "claude-code" });
const httpOptions = {
  host: args.host,
  port: Number(args.port ?? (args.server ? 4870 : 4871)),
  token: args.token ?? process.env.AGENT_TOKEN ?? (args.server ? savedToken(dataDir) : newToken()),
  built: args.built,
};
// The window prefers a fixed port, so the page keeps its saved layout between launches.
const http = await startHttp(core, httpOptions).catch((error) => {
  if (args.server || args.port || error.code !== "EADDRINUSE") throw error;
  return startHttp(core, { ...httpOptions, port: 0 });
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await http.close();
  core.close();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

if (args.server) {
  console.log(`agent is running. Open this link, it carries your login token:\n\n  ${http.url}\n`);
  if (!["127.0.0.1", "localhost", "::1"].includes(args.host))
    console.log("Anyone with the link can run commands on this machine through the agents. Keep it private.\n");
} else {
  openWindow(http.url);
}

/** The desktop window is Electron showing the same page a browser would. */
function openWindow(url: string) {
  let electron: string;
  try {
    electron = createRequire(import.meta.url)("electron") as string;
  } catch {
    console.log(`Electron is not installed. Open ${url} in a browser, or run npm install.`);
    return;
  }
  const flags = process.platform === "linux" ? ["--no-sandbox"] : [];
  const child = spawn(electron, [...flags, join(root, "src", "desktop", "main.cjs")], {
    stdio: "inherit",
    env: { ...process.env, AGENT_URL: url, ELECTRON_RUN_AS_NODE: undefined },
  });
  child.on("error", () => console.log(`Could not open a window. Open ${url} in a browser.`));
  child.on("exit", stop);
}

function defaultDataDir(): string {
  const name = "forkware-agent";
  if (process.platform === "win32") return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), name);
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", name);
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), name);
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The server keeps its token, so the link stays valid across restarts. */
function savedToken(dir: string): string {
  const file = join(dir, "token");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync(dir, { recursive: true });
  const token = newToken();
  writeFileSync(file, token, { mode: 0o600 });
  return token;
}
