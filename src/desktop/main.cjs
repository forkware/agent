// The desktop window. All logic stays in the Node server; this only shows its page.
const { app, BrowserWindow, shell } = require("electron");

const url = process.env.AGENT_URL;
const origin = new URL(url).origin;

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    title: "agent",
    backgroundColor: "#0b0c0f",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // Links to other sites open in the user's browser, not in the app window.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== origin) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });
  win.loadURL(url);
});

app.on("window-all-closed", () => app.quit());
