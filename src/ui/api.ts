// Talks to the core over HTTP and one WebSocket, and keeps the UI state.
import { useRef, useSyncExternalStore } from "react";
import type { AppState } from "../sdk/types.ts";

export interface UiState {
  data: AppState | null;
  selectedTaskId: string | null;
  /** Folder id → collapsed. */
  collapsed: Record<string, boolean>;
  connected: boolean;
}

const saved = load<Partial<UiState>>("agent.ui", {});
let state: UiState = {
  data: null,
  selectedTaskId: saved.selectedTaskId ?? null,
  collapsed: saved.collapsed ?? {},
  connected: false,
};
const listeners = new Set<() => void>();

export function getState(): UiState {
  return state;
}

export function setState(patch: Partial<UiState>): void {
  state = { ...state, ...patch };
  save("agent.ui", { selectedTaskId: state.selectedTaskId, collapsed: state.collapsed });
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Subscribes to part of the state. Results equal item by item count as unchanged. */
export function useUi<T>(select: (s: UiState) => T): T {
  const last = useRef<T>(undefined as T);
  return useSyncExternalStore(subscribe, () => {
    const next = select(state);
    if (!shallowEqual(next, last.current)) last.current = next;
    return last.current;
  });
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.is((a as any)[k], (b as any)[k]));
}

// HTTP

export class ApiError extends Error {}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.error ?? `${res.status} ${res.statusText}`);
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

/** Calls a procedure a plugin registered with ctx.rpc.handle. */
export function rpc<T = unknown>(plugin: string, name: string, input: unknown = {}): Promise<T> {
  return api.post<T>(`/api/plugins/${plugin}/rpc/${name}`, input);
}

export async function refresh(): Promise<void> {
  const data = await api.get<AppState>("/api/state");
  const selected = data.tasks.some((t) => t.id === state.selectedTaskId) ? state.selectedTaskId : null;
  setState({ data, selectedTaskId: selected });
}

// WebSocket

type EventHandler = (name: string, payload: any) => void;
type PtyHandler = (msg: { t: "pty" | "pty-reset"; data: string }) => void;

const eventHandlers = new Set<EventHandler>();
const ptyHandlers = new Map<string, Set<PtyHandler>>();
let socket: WebSocket | undefined;

export function onEvent(handler: EventHandler): () => void {
  eventHandlers.add(handler);
  return () => eventHandlers.delete(handler);
}

export function send(msg: object): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

/** Streams a session's output; the first message replays what it printed so far. */
export function attach(id: string, handler: PtyHandler): () => void {
  let set = ptyHandlers.get(id);
  if (!set) ptyHandlers.set(id, (set = new Set()));
  set.add(handler);
  send({ t: "attach", id });
  return () => {
    set.delete(handler);
    if (set.size === 0) {
      ptyHandlers.delete(id);
      send({ t: "detach", id });
    }
  };
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

export function connect(): void {
  socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  socket.onopen = () => {
    setState({ connected: true });
    for (const id of ptyHandlers.keys()) send({ t: "attach", id });
    void refresh();
  };
  socket.onclose = () => {
    setState({ connected: false });
    setTimeout(connect, 1000);
  };
  socket.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.t === "pty" || msg.t === "pty-reset") {
      for (const handler of ptyHandlers.get(msg.id) ?? []) handler(msg);
    } else if (msg.t === "event") {
      for (const handler of eventHandlers) handler(msg.name, msg.payload);
      // The state is small: reload it after any change instead of patching it.
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 30);
    }
  };
}

function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
