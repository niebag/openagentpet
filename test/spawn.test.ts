import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCompanion, type PetWindowOptions } from "../src/companion.js";
import { runCli } from "../src/cli.js";
import type { Pet } from "../src/protocol.js";

test("spawn creates one Idle Pet through the public command", async () => {
  const windowCreations: WindowCreation[] = [];
  const { companion, cleanup } = await testCompanion((pet, options) =>
    windowCreations.push({ pet, options }),
  );

  await companion.start();
  try {
    assert.equal((await stat(companion.socketPath)).mode & 0o777, 0o600);
    assert.equal((await stat(path.dirname(companion.socketPath))).mode & 0o777, 0o700);
    assert.equal(
      await runCli(["spawn", "--session-id", "opaque-session"], {
        socketPath: companion.socketPath,
      }),
      0,
    );
    assert.deepEqual(companion.pets(), [
      { sessionId: "opaque-session", activity: "Idle" },
    ]);
    assert.deepEqual(windowCreations, [
      {
        pet: { sessionId: "opaque-session", activity: "Idle" },
        options: {
          width: 320,
          height: 320,
          transparent: true,
          frame: false,
          resizable: false,
          hasShadow: false,
          alwaysOnTop: true,
          show: false,
        },
      },
    ]);
    assert.equal(
      await runCli(["spawn", "--session-id", "opaque-session"], {
        socketPath: companion.socketPath,
      }),
      0,
    );
    assert.equal(windowCreations.length, 1);
    assert.equal(companion.pets().length, 1);
  } finally {
    await cleanup();
  }
});

test("spawn starts the Companion when it is not running", async () => {
  const windowCreations: WindowCreation[] = [];
  const { companion, cleanup } = await testCompanion((pet, options) =>
    windowCreations.push({ pet, options }),
  );

  try {
    assert.equal(
      await runCli(["spawn", "--session-id", "new-session"], {
        socketPath: companion.socketPath,
        startCompanion: () => companion.start(),
      }),
      0,
    );
    assert.equal(windowCreations.length, 1);
    assert.deepEqual(companion.pets(), [{ sessionId: "new-session", activity: "Idle" }]);
  } finally {
    await cleanup();
  }
});

test("invalid socket messages cannot create or change a Pet instance", async () => {
  const windowCreations: WindowCreation[] = [];
  const { companion, cleanup } = await testCompanion((pet, options) =>
    windowCreations.push({ pet, options }),
  );

  await companion.start();
  try {
    const valid = {
      version: 1,
      command: "spawn",
      sessionId: "opaque-session",
      activity: "Idle",
    };
    const invalidMessages = [
      "not json",
      JSON.stringify({ ...valid, command: "unknown" }),
      JSON.stringify({ ...valid, version: 2 }),
      JSON.stringify({ ...valid, prompt: "private" }),
      JSON.stringify({ ...valid, padding: "x".repeat(4096) }),
    ];

    for (const message of invalidMessages) {
      assert.equal(JSON.parse(await sendRaw(companion.socketPath, message)).ok, false);
    }
    assert.deepEqual(companion.pets(), []);
    assert.deepEqual(windowCreations, []);
  } finally {
    await cleanup();
  }
});

type WindowCreation = { pet: Pet; options: PetWindowOptions };

async function testCompanion(createWindow: (pet: Pet, options: PetWindowOptions) => void) {
  const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-test-"));
  const companion = createCompanion({
    createWindow,
    socketPath: path.join(runtimeDirectory, "control.sock"),
  });
  return {
    companion,
    cleanup: async () => {
      try {
        await companion.stop();
      } finally {
        await rm(runtimeDirectory, { recursive: true });
      }
    },
  };
}

function sendRaw(socketPath: string, message: string) {
  return new Promise<string>((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let response = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.end(`${message}\n`));
    socket.on("data", (chunk) => (response += chunk));
    socket.on("end", () => resolve(response));
    socket.on("error", reject);
  });
}
