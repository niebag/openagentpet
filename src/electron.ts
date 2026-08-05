import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";

import { createCompanion } from "./companion.js";

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const windows = new Map<string, BrowserWindow>();
  const companion = createCompanion({
    createWindow: (pet, options) => {
      const window = new BrowserWindow({
        ...options,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      window.once("ready-to-show", () => window.showInactive());
      window.on("closed", () => windows.delete(pet.sessionId));
      windows.set(pet.sessionId, window);
      void window
        .loadFile(fileURLToPath(new URL("../../public/pet.html", import.meta.url)))
        .catch(console.error);
    },
  });

  let stopping = false;
  app.on("will-quit", (event) => {
    if (stopping) return;
    event.preventDefault();
    stopping = true;
    void companion.stop().finally(() => app.quit());
  });

  void app
    .whenReady()
    .then(() => companion.start())
    .catch((error) => {
      console.error(error);
      app.quit();
    });
}
