import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { setTimeout } from "node:timers/promises";

import { app, BrowserWindow, type MenuItem } from "electron";

import { runCli } from "../src/cli.js";
import { startElectronApp } from "../src/electron.js";
import { defaultPetPackDirectory } from "../src/pet-pack.js";

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
    const longLabel = "very-long-project-name-".repeat(5);
    for (const [sessionId, currentWorkingDirectory] of [
      ["smoke-one", "/private/openagentpet"],
      ["smoke-two", `/private/${longLabel}`],
    ]) {
      assert.equal(
        await runCli(["spawn", "--session-id", sessionId], {
          socketPath: companionApp.companion.socketPath,
          currentWorkingDirectory,
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
      assert.equal(
        await window.webContents.executeJavaScript(
          'getComputedStyle(document.body).getPropertyValue("-webkit-app-region")',
        ),
        "drag",
      );
      const corner = (await window.capturePage()).toBitmap().subarray(0, 4);
      assert.equal(corner[3], 0);
      assert.equal(
        await window.webContents.executeJavaScript(
          'document.querySelectorAll("img").length === 1 && document.querySelector("img").src.endsWith("/clawd-vibing.gif")',
        ),
        true,
      );
    }
    assert.equal(
      await windows[0]!.webContents.executeJavaScript(`
        const label = document.querySelector("#label");
        label.textContent === "openagentpet" &&
        !label.hasAttribute("title") &&
        getComputedStyle(label).whiteSpace === "nowrap" &&
        getComputedStyle(label).textOverflow === "ellipsis" &&
        getComputedStyle(document.body).gridTemplateRows.endsWith("24px")
      `),
      true,
    );
    assert.equal(
      await windows[1]!.webContents.executeJavaScript(`
        const label = document.querySelector("#label");
        label.textContent === ${JSON.stringify(longLabel.slice(0, 100))} &&
        label.scrollWidth > label.clientWidth
      `),
      true,
    );

    const petWindow = windows[0]!;
    const [petX, petY] = petWindow.getPosition();
    windows[1]!.setPosition(petX + 350, petY);

    clickCheckbox(companionApp.menu().getMenuItemById("arrange"), true);
    for (const window of windows) {
      assert.equal(window.isMovable(), true);
      assert.equal(pointerModes.get(window.id)?.at(-1), false);
    }
    const originalPosition = petWindow.getPosition();
    petWindow.setPosition(originalPosition[0] + 30, originalPosition[1] + 30);
    const arrangedPosition = petWindow.getPosition();
    assert.notDeepEqual(arrangedPosition, originalPosition);

    clickCheckbox(companionApp.menu().getMenuItemById("arrange"), false);
    assert.deepEqual(petWindow.getPosition(), arrangedPosition);
    for (const window of windows) {
      assert.equal(window.isMovable(), false);
      assert.equal(pointerModes.get(window.id)?.at(-1), true);
    }

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

    await expectActivity(
      petWindow,
      {
        session_id: "smoke-one",
        hook_event_name: "PermissionRequest",
        tool_name: "Bash",
      },
      "Needs-input",
    );
    await expectActivity(
      petWindow,
      {
        session_id: "smoke-one",
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_use_id: "smoke-tool",
      },
      "Thinking",
    );
    await expectActivity(
      petWindow,
      {
        session_id: "smoke-one",
        hook_event_name: "PreToolUse",
        tool_name: "WebSearch",
        tool_use_id: "smoke-research",
      },
      "Researching",
    );
    await expectActivity(
      petWindow,
      {
        session_id: "smoke-one",
        hook_event_name: "PostToolUse",
        tool_name: "WebSearch",
        tool_use_id: "smoke-research",
      },
      "Thinking",
    );
    await expectActivity(
      petWindow,
      { session_id: "smoke-one", hook_event_name: "Stop" },
      "Idle",
    );

    const updateCommands: string[] = [];
    assert.equal(
      await runCli(["spawn", "--session-id", "smoke-one"], {
        socketPath: companionApp.companion.socketPath,
        currentWorkingDirectory: "/private/renamed-project",
        updateCheckPath: path.join(runtimeDirectory, "update-check.json"),
        packageVersion: "1.0.0",
        ask: async () => "n",
        output: discardOutput(),
        runProcess: async (command, args) => {
          updateCommands.push([command, ...args].join(" "));
          if (args[0] === "outdated") {
            return {
              status: 1,
              stdout: '{"openagentpet":{"wanted":"1.1.0"}}',
              stderr: "",
            };
          }
          return { status: 0, stdout: '">=22.12.0"', stderr: "" };
        },
      }),
      0,
    );
    assert.deepEqual(updateCommands, [
      "npm outdated --global --json openagentpet",
      "npm view openagentpet@1.1.0 engines.node --json",
    ]);

    const customPack = path.join(runtimeDirectory, "custom-pack");
    await cp(defaultPetPackDirectory, customPack, { recursive: true });
    assert.equal(
      await runCli(["pack", "use", customPack], {
        socketPath: companionApp.companion.socketPath,
      }),
      0,
    );
    await waitFor(
      petWindow,
      'document.querySelector("img").src.includes("/custom-pack/")',
    );

    clickCheckbox(companionApp.menu().getMenuItemById("reduced-motion"), true);
    await Promise.all(windows.map(waitForReducedFrame));
    await Promise.all(windows.map(waitForLoad));
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

    const despawnedWindow = windows[1]!;
    assert.equal(
      await runCli(["despawn", "--session-id", "smoke-two"], {
        socketPath: companionApp.companion.socketPath,
      }),
      0,
    );
    await waitUntil(() => despawnedWindow.isDestroyed(), "Despawn left a Pet window open");

    assert.equal(
      await runCli(["spawn", "--session-id", "session-end-smoke"], {
        socketPath: companionApp.companion.socketPath,
      }),
      0,
    );
    await waitUntil(
      () => companionApp.windows().length === 2,
      "Session-end Pet window did not appear",
    );
    const sessionEndWindow = companionApp
      .windows()
      .find((window) => window !== petWindow)!;
    assert.equal(
      await runCli(["session-end"], {
        socketPath: companionApp.companion.socketPath,
        readInput: async () =>
          JSON.stringify({
            session_id: "session-end-smoke",
            hook_event_name: "SessionEnd",
          }),
      }),
      0,
    );
    await waitUntil(
      () => sessionEndWindow.isDestroyed(),
      "Session end left a Pet window open",
    );

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

  async function expectActivity(
    window: BrowserWindow,
    event: Record<string, unknown>,
    hash: string,
  ) {
    assert.equal(
      await runCli(["hook"], {
        socketPath: companionApp.companion.socketPath,
        readInput: async () => JSON.stringify(event),
      }),
      0,
    );
    await waitFor(window, `location.hash === "#${hash}"`);
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

function discardOutput() {
  return new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
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
