import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { app, BrowserWindow, type MenuItem } from "electron";

import { runCli } from "../src/cli.js";
import { startElectronApp } from "../src/electron.js";

const execFileAsync = promisify(execFile);
const mouseScript = fileURLToPath(new URL("../../test/native-mouse.swift", import.meta.url));

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
  const companionApp = await startElectronApp({
    socketPath: path.join(runtimeDirectory, "control.sock"),
    selectionPath: path.join(runtimeDirectory, "selection.json"),
  });

  try {
    for (const sessionId of ["smoke-one", "smoke-two"]) {
      assert.equal(
        await runCli(["spawn", "--session-id", sessionId], {
          socketPath: companionApp.companion.socketPath,
        }),
        0,
      );
    }

    const windows = companionApp.windows();
    assert.equal(windows.length, 2);
    await Promise.all(windows.map(waitForLoad));
    await Promise.all(windows.map(waitForVisible));
    for (const window of windows) {
      assert.equal(window.isAlwaysOnTop(), true);
      assert.equal(window.isVisible(), true);
      assert.equal(window.isMovable(), false);
      assert.equal(pointerModes.get(window.id)?.at(-1), true);
      const corner = (await window.capturePage()).toBitmap().subarray(0, 4);
      assert.equal(corner[3], 0);
      assert.equal(
        await window.webContents.executeJavaScript(
          'document.querySelectorAll("img").length === 1 && document.querySelector("img").src.endsWith("/clawd-vibing.gif")',
        ),
        true,
      );
    }

    const petWindow = windows[0]!;
    const [petX, petY] = petWindow.getPosition();
    windows[1]!.setPosition(petX + 350, petY);
    const backdrop = new BrowserWindow({
      ...petWindow.getBounds(),
      alwaysOnTop: true,
      frame: false,
    });
    await backdrop.loadURL(
      `data:text/html,${encodeURIComponent(
        '<script>addEventListener("mousedown", () => document.body.dataset.clicked = "true")</script>',
      )}`,
    );
    backdrop.showInactive();
    petWindow.moveTop();
    await setTimeout(100);
    await mouse("click", center(petWindow));
    await waitFor(backdrop, 'document.body.dataset.clicked === "true"');

    clickCheckbox(companionApp.menu().getMenuItemById("arrange"), true);
    for (const window of windows) {
      assert.equal(window.isMovable(), true);
      assert.equal(pointerModes.get(window.id)?.at(-1), false);
    }
    const originalPosition = petWindow.getPosition();
    const dragStart = center(petWindow);
    petWindow.moveTop();
    await setTimeout(100);
    await mouse("drag", dragStart, { x: dragStart.x + 30, y: dragStart.y + 30 });
    await setTimeout(100);
    const arrangedPosition = petWindow.getPosition();
    assert.notDeepEqual(arrangedPosition, originalPosition);

    clickCheckbox(companionApp.menu().getMenuItemById("arrange"), false);
    assert.deepEqual(petWindow.getPosition(), arrangedPosition);
    for (const window of windows) {
      assert.equal(window.isMovable(), false);
      assert.equal(pointerModes.get(window.id)?.at(-1), true);
    }
    backdrop.destroy();

    click(companionApp.menu().getMenuItemById("visibility"));
    assert.equal(windows.every((window) => !window.isVisible()), true);
    assert.equal(
      await runCli(["hook"], {
        socketPath: companionApp.companion.socketPath,
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

    click(companionApp.menu().getMenuItemById("visibility"));
    assert.equal(windows.every((window) => window.isVisible()), true);

    clickCheckbox(companionApp.menu().getMenuItemById("reduced-motion"), true);
    await Promise.all(windows.map(waitForReducedFrame));
    for (const window of windows) {
      const firstFrame = await window.webContents.executeJavaScript(
        'document.querySelector("canvas").toDataURL()',
      );
      await setTimeout(500);
      assert.equal(
        await window.webContents.executeJavaScript(
          'document.querySelector("canvas").toDataURL()',
        ),
        firstFrame,
      );
    }

    app.once("before-quit", () => {
      assert.deepEqual(companionApp.companion.pets(), []);
      assert.equal(windows.every((window) => window.isDestroyed()), true);
      rmSync(runtimeDirectory, { recursive: true });
      console.log("macOS Electron smoke test passed");
    });
    click(companionApp.menu().getMenuItemById("quit"));
  } catch (error) {
    console.error(error);
    await companionApp.companion.quit();
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

function center(window: BrowserWindow) {
  const bounds = window.getBounds();
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function mouse(
  action: "click" | "drag",
  start: { x: number; y: number },
  end?: { x: number; y: number },
) {
  await execFileAsync("/usr/bin/swift", [
    mouseScript,
    action,
    String(start.x),
    String(start.y),
    ...(end ? [String(end.x), String(end.y)] : []),
  ]);
}

async function waitFor(window: BrowserWindow, expression: string) {
  await waitUntil(
    () => window.webContents.executeJavaScript(expression),
    `Timed out waiting for ${expression}`,
  );
}

async function waitForLoad(window: BrowserWindow) {
  await waitUntil(() => !window.webContents.isLoadingMainFrame(), "Pet page did not load");
  await setTimeout(50);
}

async function waitForVisible(window: BrowserWindow) {
  await waitUntil(() => window.isVisible(), "Pet window did not become visible");
}

async function waitForReducedFrame(window: BrowserWindow) {
  await waitUntil(async () => {
    try {
      return await window.webContents.executeJavaScript(`
          document.querySelector("img")?.hidden === true &&
          document.querySelector("canvas")?.hidden === false
        `);
    } catch {
      return false;
    }
  }, "Reduced motion did not render a stable frame");
}

async function waitUntil(check: () => boolean | Promise<boolean>, failure: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await check()) return;
    await setTimeout(10);
  }
  assert.fail(failure);
}
