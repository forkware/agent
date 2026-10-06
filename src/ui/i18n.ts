// Interface strings. Plugins add theirs with addStrings.
type Strings = Record<string, string>;

const dictionaries: Record<string, Strings> = {
  en: {
    folders: "Folders",
    newFolder: "New folder",
    newSubfolder: "New subfolder",
    newTask: "New task",
    rename: "Rename",
    delete: "Delete",
    deleteFolderTitle: "Delete folder “{name}”?",
    deleteFolderBody: "Its subfolders, tasks and agent sessions are deleted too.",
    deleteTaskTitle: "Delete task “{name}”?",
    deleteTaskBody: "Its agent sessions are stopped and deleted.",
    cancel: "Cancel",
    save: "Save",
    noFoldersTitle: "Nothing here yet",
    noFoldersBody: "Folders hold tasks. Each task runs its own agents.",
    createFolder: "Create a folder",
    noTaskTitle: "Pick a task",
    noTaskBody: "Or create one in a folder on the left.",
    startAgent: "Start {agent}",
    newAgent: "New agent",
    noSessionsTitle: "No agents yet",
    noSessionsBody: "An agent runs in its own terminal, with your own subscription.",
    notInstalled: "{agent} is not installed",
    noProviders: "No agent plugins are installed",
    exited: "Exited with code {code}",
    stop: "Stop",
    close: "Close",
    disconnected: "Reconnecting to agent…",
    alarm: "Plugin {plugin} did {action} without declaring {permission}",
    status: "Status",
    "status.todo": "To do",
    "status.in_progress": "In progress",
    "status.done": "Done",
  },
  ru: {
    folders: "Папки",
    newFolder: "Новая папка",
    newSubfolder: "Новая подпапка",
    newTask: "Новая задача",
    rename: "Переименовать",
    delete: "Удалить",
    deleteFolderTitle: "Удалить папку «{name}»?",
    deleteFolderBody: "Вместе с ней удалятся подпапки, задачи и сессии агентов.",
    deleteTaskTitle: "Удалить задачу «{name}»?",
    deleteTaskBody: "Её агенты будут остановлены, а сессии удалены.",
    cancel: "Отмена",
    save: "Сохранить",
    noFoldersTitle: "Здесь пока пусто",
    noFoldersBody: "В папках лежат задачи. У каждой задачи свои агенты.",
    createFolder: "Создать папку",
    noTaskTitle: "Выберите задачу",
    noTaskBody: "Или создайте её в папке слева.",
    startAgent: "Запустить {agent}",
    newAgent: "Новый агент",
    noSessionsTitle: "Агентов пока нет",
    noSessionsBody: "Каждый агент работает в своём терминале, по вашей подписке.",
    notInstalled: "{agent} не установлен",
    noProviders: "Не установлено ни одного плагина агентов",
    exited: "Завершился с кодом {code}",
    stop: "Остановить",
    close: "Закрыть",
    disconnected: "Переподключаюсь к agent…",
    alarm: "Плагин {plugin} вызвал {action}, не объявив {permission}",
    status: "Статус",
    "status.todo": "К работе",
    "status.in_progress": "В работе",
    "status.done": "Готово",
  },
};

export const lang = navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";

export function addStrings(strings: Record<string, Strings>): void {
  for (const [code, entries] of Object.entries(strings)) {
    dictionaries[code] = { ...dictionaries[code], ...entries };
  }
}

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const text = dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}
