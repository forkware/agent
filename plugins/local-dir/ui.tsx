import { FolderInput, HardDrive } from "lucide-react";
import {
  addStrings,
  Badge,
  defineUiPlugin,
  MenuItem,
  prompt,
  rpc,
  t,
  type Folder,
} from "#sdk/ui";

addStrings({
  en: {
    "local-dir.bind": "Bind a directory…",
    "local-dir.title": "Directory for “{name}”",
    "local-dir.body": "Agents for tasks in this folder and its subfolders start there. Leave empty to unbind.",
  },
  ru: {
    "local-dir.bind": "Привязать каталог…",
    "local-dir.title": "Каталог для «{name}»",
    "local-dir.body": "Агенты задач этой папки и её подпапок запускаются в нём. Оставьте пустым, чтобы отвязать.",
  },
});

const bound = (folder: Folder) => (folder.meta["local-dir"] as { path: string } | undefined)?.path;

function PathBadge({ folder }: { folder: Folder }) {
  const path = bound(folder);
  if (!path) return null;
  return (
    <span title={path}>
      <Badge>
        <HardDrive size={10} />
        {path.split(/[/\\]/).filter(Boolean).at(-1) ?? path}
      </Badge>
    </span>
  );
}

function BindItem({ folder }: { folder: Folder }) {
  const bind = () =>
    prompt({
      title: t("local-dir.title", { name: folder.name }),
      description: t("local-dir.body"),
      placeholder: "~/projects/my-app",
      initial: bound(folder) ?? "",
      onSubmit: async (path) => void (await rpc("local-dir", "bind", { folderId: folder.id, path })),
    });
  return (
    <MenuItem icon={FolderInput} onSelect={bind}>
      {t("local-dir.bind")}
    </MenuItem>
  );
}

export default defineUiPlugin({
  slots: { "folder.badge": PathBadge, "folder.menu": BindItem },
});
