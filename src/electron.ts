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
import { runtimeDirectory as defaultRuntimeDirectory } from "./platform.js";
import {
  petPackSelectionPath as defaultPetPackSelectionPath,
  type PetPack,
} from "./pet-pack.js";
import type { Pet } from "./protocol.js";

const petPage = fileURLToPath(new URL("../../public/pet.html", import.meta.url));
const appIcon = nativeImage.createFromPath(
  fileURLToPath(new URL("../../public/openagentpet-icon.png", import.meta.url)),
);
// The menu bar wants an 18pt template image that macOS recolours for the
// current appearance; the Windows notification area wants a 16px icon it draws
// as-is, so the template flag has to stay off there or it renders as a blob.
const trayIconSize = process.platform === "darwin" ? 18 : 16;
const trayIcon = nativeImage
  .createFromPath(
    fileURLToPath(
      new URL("../../public/openagentpet-tray-icon.png", import.meta.url),
    ),
  )
  .resize({ width: trayIconSize, height: trayIconSize });
if (process.platform === "darwin") trayIcon.setTemplateImage(true);

/** Matches the label row in the Pet page grid. */
const petLabelHeight = 24;

app.setName("OpenAgentPet");
if (process.platform === "darwin") app.setActivationPolicy("accessory");

type ElectronAppOptions = {
  socketPath?: string;
  stateDirectory?: string;
  selectionPath?: string;
};

export async function startElectronApp({
  socketPath = defaultSocketPath,
  stateDirectory = defaultRuntimeDirectory,
  selectionPath = defaultPetPackSelectionPath,
}: ElectronAppOptions = {}) {
  await app.whenReady();
  Menu.setApplicationMenu(null);
  app.dock?.setIcon(appIcon);

  const windows = new Map<
    string,
    { window: BrowserWindow; pet: Pet; pack: PetPack }
  >();
  let locked = false;
  let hidden = false;
  let reducedMotion = false;
  let quitApp = () => undefined;
  let menu: Menu;

  const tray = new Tray(trayIcon);
  tray.setToolTip("OpenAgentPet");
  // macOS opens the menu on any click; Windows reserves left-click for the app.
  if (process.platform === "win32") tray.on("click", () => tray.popUpContextMenu());

  /**
   * A Pet is a square of artwork above a fixed-height label. macOS expresses
   * that as a 1:1 ratio plus extra height; Windows ignores the extra size
   * argument and would square the whole window, so there the shape is held by
   * hand for the edge the user is dragging.
   */
  const lockAspectRatio = (window: BrowserWindow) => {
    if (process.platform !== "win32") {
      window.setAspectRatio(1, { width: 0, height: petLabelHeight });
      return;
    }
    window.on("will-resize", (event, newBounds, details) => {
      const [minWidth] = window.getMinimumSize();
      const [maxWidth] = window.getMaximumSize();
      // Windows reports a plain "top" edge that the published types omit.
      const edge: string = details.edge;
      const dragged =
        edge === "top" || edge === "bottom"
          ? newBounds.height - petLabelHeight
          : newBounds.width;
      const width = Math.min(Math.max(dragged, minWidth), maxWidth);
      const height = width + petLabelHeight;
      if (width === newBounds.width && height === newBounds.height) return;
      event.preventDefault();
      window.setBounds({ ...newBounds, width, height });
    });
  };

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
    stateDirectory,
    selectionPath,
    createWindow: (pet, options, onClosed, pack) => {
      const window = new BrowserWindow({
        ...options,
        icon: appIcon,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      lockAspectRatio(window);
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
    icon: () => appIcon,
    menu: () => menu,
    tray: () => tray,
    trayIcon: () => trayIcon,
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
