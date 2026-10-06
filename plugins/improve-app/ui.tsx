import { Sparkles } from "lucide-react";
import { useState } from "react";
import { addStrings, attempt, Button, defineUiPlugin, refresh, rpc, selectTask, t } from "#sdk/ui";

addStrings({
  en: {
    "improve-app.button": "Improve the app",
    "improve-app.hint": "Tell an agent what to change in this app",
    "improve-app.task": "Improvement",
  },
  ru: {
    "improve-app.button": "Доработать приложение",
    "improve-app.hint": "Скажите агенту, что изменить в этом приложении",
    "improve-app.task": "Доработка",
  },
});

function ImproveButton() {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    const result = await attempt(() => rpc<{ taskId: string }>("improve-app", "start", { title: t("improve-app.task") }));
    setBusy(false);
    if (!result) return;
    await refresh();
    selectTask(result.taskId);
  };
  return (
    <Button variant="glow" icon={Sparkles} disabled={busy} title={t("improve-app.hint")} onClick={start}>
      {t("improve-app.button")}
    </Button>
  );
}

export default defineUiPlugin({
  slots: { "header.actions": ImproveButton },
});
