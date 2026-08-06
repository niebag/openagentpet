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
import {
  petPackSelectionPath as defaultPetPackSelectionPath,
  type PetPack,
} from "./pet-pack.js";
import type { Pet } from "./protocol.js";

const petPage = fileURLToPath(new URL("../../public/pet.html", import.meta.url));

type ElectronAppOptions = {
  socketPath?: string;
  selectionPath?: string;
};

export async function startElectronApp({
  socketPath = defaultSocketPath,
  selectionPath = defaultPetPackSelectionPath,
}: ElectronAppOptions = {}) {
  await app.whenReady();

  const windows = new Map<
    string,
    { window: BrowserWindow; pet: Pet; pack: PetPack }
  >();
  let locked = false;
  let hidden = false;
  let reducedMotion = false;
  let quitApp = () => undefined;
  let menu: Menu;

  const tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("🐾");
  tray.setToolTip("OpenAgentPet");

  const applyWindowMode = (window: BrowserWindow) => {
    window.setIgnoreMouseEvents(locked);
    window.setMovable(!locked);
    window.setResizable(!locked);
  };

  const loadPet = (window: BrowserWindow, pet: Pet, pack: PetPack) =>
    window.loadFile(petPage, {
      hash: pet.activity.replace(" ", "-"),
      query: {
        asset: pathToFileURL(pack.assets[pet.activity]).href,
        label: pet.label,
        reducedMotion: String(reducedMotion),
      },
    });

  const reportLoadError = (window: BrowserWindow, error: unknown) => {
    if (
      !window.isDestroyed() &&
      (error as { code?: string }).code !== "ERR_ABORTED"
    ) console.error(error);
  };

  const setMenu = () => {
    const template: MenuItemConstructorOptions[] = [
      {
        id: "lock",
        label: "Lock Pets",
        type: "checkbox",
        checked: locked,
        click: (item) => {
          locked = item.checked;
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
          for (const { window, pet, pack } of windows.values()) {
            void loadPet(window, pet, pack).catch((error) =>
              reportLoadError(window, error),
            );
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
    selectionPath,
    createWindow: (pet, options, onClosed, pack) => {
      const window = new BrowserWindow({
        ...options,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      window.setAspectRatio(1, { width: 0, height: 24 });
      applyWindowMode(window);
      window.once("ready-to-show", () => {
        if (!hidden) window.showInactive();
      });
      window.on("closed", () => {
        windows.delete(pet.sessionId);
        onClosed();
      });
      windows.set(pet.sessionId, { window, pet, pack });
      void loadPet(window, pet, pack).catch((error) =>
        reportLoadError(window, error),
      );
    },
    refreshWindow: (pet, pack) => {
      const entry = windows.get(pet.sessionId);
      if (entry) {
        entry.pack = pack;
        void loadPet(entry.window, pet, pack)
          .then(() => {
            if (!hidden) entry.window.showInactive();
          })
          .catch((error) => reportLoadError(entry.window, error));
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
