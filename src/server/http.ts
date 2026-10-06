// One HTTP server for both modes: the desktop window and a browser load the same UI from it.
// The UI talks to the core only through /api and /ws, never through Electron.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { UserError } from "./store.ts";
import type { Core } from "./app.ts";

export interface HttpOptions {
  host: string;
  port: number;
  token: string;
  /** Serve the prebuilt UI from dist/ui instead of compiling it live with Vite. */
  built?: boolean;
}

type Params = Record<string, string>;
type Route = [method: string, pattern: RegExp, handler: (p: Params, body: any) => unknown];


export async function startHttp(core: Core, options: HttpOptions) {
  const { store, sessions, plugins, state } = core;
  // Per port, so a desktop window and a server on the same host keep separate logins.
  let cookieName = "agent_token";

  const routes: Route[] = [
    ["GET", /^\/api\/state$/, () => state()],
    ["GET", /^\/api\/audit$/, () => plugins.audit()],
    ["POST", /^\/api\/folders$/, (_, b) => store.createFolder({ name: b.name, parentId: b.parentId })],
    ["PATCH", /^\/api\/folders\/(?<id>[^/]+)$/, (p, b) => store.updateFolder(p.id, { name: b.name, parentId: b.parentId })],
    ["DELETE", /^\/api\/folders\/(?<id>[^/]+)$/, (p) => store.deleteFolder(p.id)],
    ["POST", /^\/api\/tasks$/, (_, b) => store.createTask({ folderId: b.folderId, title: b.title, body: b.body })],
    [
      "PATCH",
      /^\/api\/tasks\/(?<id>[^/]+)$/,
      (p, b) => {
        if (b.status !== undefined) store.setStatus(p.id, b.status);
        const { title, body, folderId } = b;
        return title !== undefined || body !== undefined || folderId !== undefined
          ? store.updateTask(p.id, { title, body, folderId })
          : store.task(p.id);
      },
    ],
    ["DELETE", /^\/api\/tasks\/(?<id>[^/]+)$/, (p) => store.deleteTask(p.id)],
    ["POST", /^\/api\/tasks\/(?<id>[^/]+)\/sessions$/, (p, b) => sessions.start(p.id, { provider: b.provider })],
    ["POST", /^\/api\/sessions\/(?<id>[^/]+)\/kill$/, (p) => sessions.kill(p.id)],
    ["DELETE", /^\/api\/sessions\/(?<id>[^/]+)$/, (p) => sessions.remove(p.id)],
    [
      "POST",
      /^\/api\/plugins\/(?<plugin>[^/]+)\/rpc\/(?<name>[^/]+)$/,
      (p, b) => {
        const handler = plugins.loaded.get(p.plugin)?.rpc.get(p.name);
        if (!handler) throw new UserError(`No procedure ${p.plugin}.${p.name}`);
        return handler(b);
      },
    ],
  ];

  const isAuthorized = (req: IncomingMessage) => {
    const header = req.headers.authorization?.replace(/^Bearer /, "");
    const cookie = parseCookies(req.headers.cookie)[cookieName];
    return [header, cookie].some((t) => t !== undefined && safeEqual(t, options.token));
  };

  let vite: Awaited<ReturnType<typeof createVite>> | undefined;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    // The link with ?token= logs the browser in once, then the cookie does.
    const token = url.searchParams.get("token");
    if (token !== null) {
      if (!safeEqual(token, options.token)) return send(res, 401, unauthorizedPage, "text/html");
      url.searchParams.delete("token");
      res.setHeader("Set-Cookie", `${cookieName}=${options.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);
      res.setHeader("Location", url.pathname + url.search);
      return send(res, 302, "");
    }
    if (!isAuthorized(req)) return send(res, 401, unauthorizedPage, "text/html");

    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url.pathname);
    if (vite) return vite.middlewares(req, res);
    return serveStatic(res, url.pathname);
  });

  vite = options.built ? undefined : await createVite();

  async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
    for (const [method, pattern, handler] of routes) {
      const match = req.method === method && pattern.exec(path);
      if (!match) continue;
      try {
        const body = method === "GET" ? {} : await readJson(req);
        const result = await handler(match.groups ?? {}, body);
        return send(res, 200, JSON.stringify(result ?? null), "application/json");
      } catch (error) {
        const user = error instanceof UserError;
        if (!user) console.error(error);
        return send(res, user ? 400 : 500, JSON.stringify({ error: (error as Error).message }), "application/json");
      }
    }
    send(res, 404, JSON.stringify({ error: "Not found" }), "application/json");
  }

  // WebSocket: events to every client, terminal streams to the clients attached to a session.
  const wss = new WebSocketServer({ noServer: true });
  const attached = new Map<WebSocket, Set<string>>();
  server.on("upgrade", (req, socket, head) => {
    if (new URL(req.url ?? "/", "http://localhost").pathname !== "/ws") return; // Vite's HMR socket
    if (!isAuthorized(req)) {
      socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });
  wss.on("connection", (ws: WebSocket) => {
    attached.set(ws, new Set());
    ws.on("close", () => attached.delete(ws));
    ws.on("message", (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.t === "attach") {
        attached.get(ws)?.add(msg.id);
        ws.send(JSON.stringify({ t: "pty-reset", id: msg.id, data: sessions.scrollback(msg.id) }));
      } else if (msg.t === "detach") attached.get(ws)?.delete(msg.id);
      else if (msg.t === "input") sessions.write(msg.id, String(msg.data));
      else if (msg.t === "resize") sessions.resize(msg.id, Number(msg.cols), Number(msg.rows));
    });
  });
  core.events.onAny((name, payload) => {
    if (name === "session.output") {
      const { id, data } = payload as { id: string; data: string };
      const frame = JSON.stringify({ t: "pty", id, data });
      for (const [ws, ids] of attached) if (ids.has(id)) ws.send(frame);
      return;
    }
    const frame = JSON.stringify({ t: "event", name, payload });
    for (const ws of attached.keys()) ws.send(frame);
  });

  async function createVite() {
    const { createServer: createViteServer } = await import("vite");
    return createViteServer({
      configFile: join(core.app.root, "vite.config.ts"),
      server: { middlewareMode: true, ws: { server }, allowedHosts: true },
      appType: "spa",
    });
  }

  function serveStatic(res: ServerResponse, pathname: string) {
    const dist = join(core.app.root, "dist", "ui");
    let file = normalize(join(dist, decodeURIComponent(pathname)));
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, "index.html");
    if (!existsSync(file)) return send(res, 500, "The UI is not built: run `npm run build` or start without --built");
    res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port, options.host, resolve);
    });
  } catch (error) {
    await vite?.close();
    throw error;
  }
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port;
  cookieName = `agent_token_${port}`;

  return {
    port,
    url: `http://${options.host.includes(":") ? `[${options.host}]` : options.host}:${port}/?token=${options.token}`,
    async close() {
      for (const ws of attached.keys()) ws.terminate();
      await vite?.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const unauthorizedPage = `<!doctype html><meta charset="utf-8"><title>agent</title>
<body style="font:15px system-ui;background:#0b0c0f;color:#e7e9ee;display:grid;place-items:center;height:100vh;margin:0">
<p>Open the link with <code>?token=</code> that <b>agent</b> printed in the terminal.</p>`;

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

function send(res: ServerResponse, status: number, body: string, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

async function readJson(req: IncomingMessage): Promise<any> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new UserError("Request body is not JSON");
  }
}

function parseCookies(header?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key) cookies[key] = value.join("=");
  }
  return cookies;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
