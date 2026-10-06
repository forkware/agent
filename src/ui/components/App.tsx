import { useEffect } from "react";
import { onEvent, useUi } from "../api.ts";
import { t } from "../i18n.ts";
import { DialogHost, toast, Toaster } from "../kit/index.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { TaskView } from "./TaskView.tsx";
import { TopBar } from "./TopBar.tsx";

export function App() {
  const loaded = useUi((s) => s.data !== null);
  const connected = useUi((s) => s.connected);

  // Rule 7: a plugin that writes without declaring the permission is reported.
  useEffect(() => onEvent((name, p) => name === "audit.alarm" && toast(t("alarm", p), "error")), []);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      {!connected && loaded && (
        <div className="border-b border-line bg-[color-mix(in_srgb,var(--s-amber)_12%,transparent)] px-4 py-1.5 text-xs text-muted">
          {t("disconnected")}
        </div>
      )}
      {loaded && (
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <TaskView />
          </main>
        </div>
      )}
      <DialogHost />
      <Toaster />
    </div>
  );
}
