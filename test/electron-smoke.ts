import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

import { app, BrowserWindow, type MenuItem } from "electron";

import { runCli } from "../src/cli.js";
import { startElectronApp } from "../src/electron.js";

if (process.platform !== "darwin") {
  console.log("macOS Electron smoke test skipped");
  app.quit();
} else {
  void app.whenReady().then(runSmoke).catch(fail);
}

async function runSmoke() {
  const pointerModes = new Map<number, boolean[]>();
  const setIgnoreMouseEvents = BrowserWindow.prototype.setIgnoreMouseEvents;
  BrowserWindow.prototype.setIgnoreMouseEvents = function (ignore, options) {
    const modes = pointerModes.get(this.id) ?? [];
    modes.push(ignore);
    pointerModes.set(this.id, modes);
    return setIgnoreMouseEvents.call(this, ignore, options);
  };

  const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-smoke-"));
  const desktop = await startElectronApp({
    socketPath: path.join(runtimeDirectory, "control.sock"),
  });

  try {
    for (const sessionId of ["smoke-one", "smoke-two"]) {
      assert.equal(
        await runCli(["spawn", "--session-id", sessionId], {
          socketPath: desktop.companion.socketPath,
        }),
        0,
      );
    }

    const windows = desktop.windows();
    assert.equal(windows.length, 2);
    await Promise.all(windows.map(waitForLoad));
    for (const window of windows) {
      assert.equal(window.isAlwaysOnTop(), true);
      assert.equal(window.isVisible(), true);
      assert.equal(window.isMovable(), false);
      assert.equal(pointerModes.get(window.id)?.at(-1), true);
      const corner = (await window.capturePage()).toBitmap().subarray(0, 4);
      assert.equal(corner[3], 0);
    }

    clickCheckbox(desktop.menu().getMenuItemById("arrange"), true);
    for (const window of windows) {
      assert.equal(window.isMovable(), true);
      assert.equal(pointerModes.get(window.id)?.at(-1), false);
    }
    const [x, y] = windows[0]!.getPosition();
    windows[0]!.setPosition(x + 10, y + 10);
    const arrangedPosition = windows[0]!.getPosition();

    clickCheckbox(desktop.menu().getMenuItemById("arrange"), false);
    assert.deepEqual(windows[0]!.getPosition(), arrangedPosition);
    for (const window of windows) {
      assert.equal(window.isMovable(), false);
      assert.equal(pointerModes.get(window.id)?.at(-1), true);
    }

    click(desktop.menu().getMenuItemById("visibility"));
    assert.equal(windows.every((window) => !window.isVisible()), true);
    assert.equal(
      await runCli(["hook"], {
        socketPath: desktop.companion.socketPath,
        readInput: async () =>
          JSON.stringify({
            session_id: "smoke-one",
            hook_event_name: "PreToolUse",
            tool_name: "Bash",
            tool_use_id: "smoke-tool",
          }),
      }),
      0,
    );
    await waitForLoad(windows[0]!);
    assert.equal(windows[0]!.isVisible(), false);
    assert.equal(await windows[0]!.webContents.executeJavaScript("location.hash"), "#Working");

    click(desktop.menu().getMenuItemById("visibility"));
    assert.equal(windows.every((window) => window.isVisible()), true);

    clickCheckbox(desktop.menu().getMenuItemById("reduced-motion"), true);
    await Promise.all(windows.map(waitForReducedFrame));

    app.once("before-quit", () => {
      assert.deepEqual(desktop.companion.pets(), []);
      assert.equal(windows.every((window) => window.isDestroyed()), true);
      rmSync(runtimeDirectory, { recursive: true });
      console.log("macOS Electron smoke test passed");
    });
    click(desktop.menu().getMenuItemById("quit"));
  } catch (error) {
    console.error(error);
    await desktop.companion.quit();
    await rm(runtimeDirectory, { recursive: true });
    app.exit(1);
  }
}

function fail(error: unknown) {
  console.error(error);
  app.exit(1);
}

function click(item: MenuItem | null) {
  assert.ok(item?.click);
  (item.click as () => void)();
}

function clickCheckbox(item: MenuItem | null, checked: boolean) {
  assert.ok(item);
  if (item.checked !== checked) click(item);
  assert.equal(item.checked, checked);
}

async function waitForLoad(window: BrowserWindow) {
  for (let attempt = 0; attempt < 100 && window.webContents.isLoadingMainFrame(); attempt += 1) {
    await setTimeout(10);
  }
  await setTimeout(50);
}

async function waitForReducedFrame(window: BrowserWindow) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const ready = await window.webContents.executeJavaScript(`
        document.querySelector("img:target")?.hidden === true &&
        document.querySelector("canvas")?.hidden === false
      `);
      if (ready) return;
    } catch {
      // Navigation replaces the execution context while Reduced motion loads.
    }
    await setTimeout(10);
  }
  const state = await window.webContents.executeJavaScript(`({
    href: location.href,
    image: document.querySelector("img:target") && {
      complete: document.querySelector("img:target").complete,
      hidden: document.querySelector("img:target").hidden,
      width: document.querySelector("img:target").naturalWidth
    },
    canvasHidden: document.querySelector("canvas")?.hidden
  })`);
  assert.fail(`Reduced motion did not render a stable frame: ${JSON.stringify(state)}`);
}
