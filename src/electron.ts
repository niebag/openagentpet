import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Tray,
  type MenuItemConstructorOptions,
} from "electron";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createCompanion, defaultSocketPath } from "./companion.js";
import type { Pet } from "./protocol.js";

const petPage = fileURLToPath(new URL("../../public/pet.html", import.meta.url));

type ElectronAppOptions = {
  socketPath?: string;
};

export async function startElectronApp({
  socketPath = defaultSocketPath,
}: ElectronAppOptions = {}) {
  await app.whenReady();

  const windows = new Map<string, { window: BrowserWindow; pet: Pet }>();
  let arranging = false;
  let hidden = false;
  let reducedMotion = false;
  let quitApp = () => undefined;
  let menu: Menu;

  const tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("🐾");
  tray.setToolTip("OpenAgentPet");

  const applyWindowMode = (window: BrowserWindow) => {
    window.setIgnoreMouseEvents(!arranging);
    window.setMovable(arranging);
  };

  const loadPet = (window: BrowserWindow, pet: Pet) =>
    window.loadFile(petPage, {
      hash: pet.activity.replace(" ", "-"),
      query: { reducedMotion: String(reducedMotion) },
    });

  const setMenu = () => {
    const template: MenuItemConstructorOptions[] = [
      {
        id: "arrange",
        label: "Arrange Pets",
        type: "checkbox",
        checked: arranging,
        click: (item) => {
          arranging = item.checked;
          for (const { window } of windows.values()) applyWindowMode(window);
        },
      },
      {
        id: "visibility",
        label: hidden ? "Show Pets" : "Hide Pets",
        click: () => {
          hidden = !hidden;
          for (const { window } of windows.values()) {
            if (hidden) window.hide();
            else window.showInactive();
          }
          setMenu();
        },
      },
      {
        id: "reduced-motion",
        label: "Reduced Motion",
        type: "checkbox",
        checked: reducedMotion,
        click: (item) => {
          reducedMotion = item.checked;
          for (const { window, pet } of windows.values()) {
            void loadPet(window, pet).catch(console.error);
          }
        },
      },
      { type: "separator" },
      { id: "quit", label: "Quit OpenAgentPet", click: () => quitApp() },
    ];
    menu = Menu.buildFromTemplate(template);
    tray.setContextMenu(menu);
  };
  setMenu();

  const companion = createCompanion({
    socketPath,
    createWindow: (pet, options, onClosed) => {
      const window = new BrowserWindow({
        ...options,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      applyWindowMode(window);
      window.once("ready-to-show", () => {
        if (!hidden) window.showInactive();
      });
      window.on("closed", () => {
        windows.delete(pet.sessionId);
        onClosed();
      });
      windows.set(pet.sessionId, { window, pet });
      void loadPet(window, pet).catch(console.error);
    },
    refreshWindow: (pet) => {
      const entry = windows.get(pet.sessionId);
      if (entry) {
        void loadPet(entry.window, pet)
          .then(() => {
            if (!hidden) entry.window.showInactive();
          })
          .catch(console.error);
      }
    },
    removeWindow: (sessionId) => {
      windows.get(sessionId)?.window.destroy();
      windows.delete(sessionId);
    },
  });

  let quitting = false;
  const quit = async () => {
    if (quitting) return;
    quitting = true;
    try {
      await companion.quit();
    } catch (error) {
      console.error(error);
    } finally {
      tray.destroy();
      app.quit();
    }
  };
  quitApp = () => void quit();
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    void quit();
  });

  try {
    await companion.start();
  } catch (error) {
    tray.destroy();
    throw error;
  }

  return {
    companion,
    menu: () => menu,
    windows: () => [...windows.values()].map(({ window }) => window),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    void startElectronApp().catch((error) => {
      console.error(error);
      app.quit();
    });
  }
}
