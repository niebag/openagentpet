import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCompanion, type PetWindowOptions } from "../src/companion.js";
import { runCli } from "../src/cli.js";
import { controlEndpointIn, isNamedPipe } from "../src/platform.js";
import { MAX_PET_LABEL_LENGTH, PROTOCOL_VERSION, type Pet } from "../src/protocol.js";

test("spawn creates one Idle Pet through the public command", async () => {
  const windowCreations: WindowCreation[] = [];
  const windowRefreshes: Pet[] = [];
  const { companion, cleanup } = await testCompanion(
    (pet, options) => windowCreations.push({ pet, options }),
    undefined,
    (pet) => windowRefreshes.push(pet),
  );

  await companion.start();
  try {
    if (!isNamedPipe(companion.socketPath)) {
      // Windows named pipes have no filesystem mode to assert on.
      assert.equal((await stat(companion.socketPath)).mode & 0o777, 0o600);
      assert.equal((await stat(companion.stateDirectory)).mode & 0o777, 0o700);
    }
    assert.equal(
      await runCli(["spawn", "--session-id", "opaque-session"], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
      }),
      0,
    );
    assert.deepEqual(companion.pets(), [
      { sessionId: "opaque-session", activity: "Idle", label: "openagentpet" },
    ]);
    assert.deepEqual(windowCreations, [
      {
        pet: { sessionId: "opaque-session", activity: "Idle", label: "openagentpet" },
        options: {
          width: 320,
          height: 344,
          minWidth: 160,
          minHeight: 184,
          maxWidth: 640,
          maxHeight: 664,
          transparent: true,
          frame: false,
          resizable: true,
          hasShadow: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          show: false,
        },
      },
    ]);
    assert.equal(
      await runCli(["spawn", "--session-id", "opaque-session"], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
      }),
      0,
    );
    assert.equal(windowCreations.length, 1);
    assert.equal(companion.pets().length, 1);
    assert.deepEqual(windowRefreshes, [
      { sessionId: "opaque-session", activity: "Idle", label: "openagentpet" },
    ]);
  } finally {
    await cleanup();
  }
});

test("Spawn sends only a bounded directory basename and keeps the first Pet label", async () => {
  const windowCreations: WindowCreation[] = [];
  const windowRefreshes: Pet[] = [];
  const { companion, cleanup } = await testCompanion(
    (pet, options) => windowCreations.push({ pet: { ...pet }, options }),
    undefined,
    (pet) => windowRefreshes.push({ ...pet }),
  );

  await companion.start();
  try {
    assert.equal(
      await runCli(["spawn", "--session-id", "labelled-session"], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
        currentWorkingDirectory: "/private/workspaces/openagentpet",
      }),
      0,
    );
    assert.deepEqual(companion.pets(), [
      { sessionId: "labelled-session", activity: "Idle", label: "openagentpet" },
    ]);
    assert.deepEqual(windowCreations.map(({ pet }) => pet), companion.pets());
    assert.equal(JSON.stringify(windowCreations).includes("/private/"), false);

    assert.equal(
      await runCli(["spawn", "--session-id", "labelled-session"], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
        currentWorkingDirectory: "/private/renamed-project",
      }),
      0,
    );
    assert.deepEqual(windowRefreshes, [
      { sessionId: "labelled-session", activity: "Idle", label: "openagentpet" },
    ]);

    for (const sessionId of ["same-label-one", "same-label-two"]) {
      await runCli(["spawn", "--session-id", sessionId], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
        currentWorkingDirectory: "/private/duplicate-name",
      });
    }
    assert.deepEqual(
      companion.pets().slice(1).map(({ sessionId, label }) => ({ sessionId, label })),
      [
        { sessionId: "same-label-one", label: "duplicate-name" },
        { sessionId: "same-label-two", label: "duplicate-name" },
      ],
    );

    await runCli(["spawn", "--session-id", "fallback-label"], {
      socketPath: companion.socketPath,
      stateDirectory: companion.stateDirectory,
      currentWorkingDirectory: "/",
    });
    assert.equal(companion.pets().at(-1)?.label, "Local session");

    const valid = {
      version: PROTOCOL_VERSION,
      command: "spawn",
      sessionId: "validated-session",
      activity: "Idle",
      label: "project",
    };
    for (const message of [
      { ...valid, label: undefined },
      { ...valid, label: "" },
      { ...valid, label: "x".repeat(MAX_PET_LABEL_LENGTH + 1) },
      { ...valid, label: "/private/project" },
      { ...valid, label: "project/name" },
      { ...valid, label: "project", workingDirectory: "/private/project" },
    ]) {
      assert.equal(
        JSON.parse(await sendRaw(companion.socketPath, JSON.stringify(message))).ok,
        false,
      );
    }
    const mismatch = JSON.parse(await sendRaw(companion.socketPath, JSON.stringify({
      ...valid,
      version: PROTOCOL_VERSION - 1,
    }))) as { error?: string };
    assert.match(mismatch.error ?? "", /quit and restart/i);
  } finally {
    await cleanup();
  }
});

test("Spawn tells the user to restart an incompatible running Companion", async () => {
  const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-old-companion-"));
  const socketPath = controlEndpointIn(runtimeDirectory);
  const errors: string[] = [];
  const server = net.createServer((socket) =>
    socket.once("data", () => socket.end('{"ok":false}\n')),
  );

  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  try {
    assert.equal(
      await runCli(["spawn", "--session-id", "new-session"], {
        socketPath,
        stateDirectory: runtimeDirectory,
        writeError: (message) => errors.push(message),
      }),
      1,
    );
    assert.match(errors[0] ?? "", /quit and restart/i);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(runtimeDirectory, { recursive: true });
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
        stateDirectory: companion.stateDirectory,
        startCompanion: () => companion.start(),
      }),
      0,
    );
    assert.equal(windowCreations.length, 1);
    assert.deepEqual(companion.pets(), [
      { sessionId: "new-session", activity: "Idle", label: "openagentpet" },
    ]);
  } finally {
    await cleanup();
  }
});

test("prompt submission and turn completion update an existing Pet", async () => {
  const windowRefreshes: Pet[] = [];
  const { companion, cleanup } = await testCompanion(
    () => undefined,
    undefined,
    (pet) => windowRefreshes.push({ ...pet }),
  );

  await companion.start();
  try {
    await runCli(["spawn", "--session-id", "active-session"], {
      socketPath: companion.socketPath,
      stateDirectory: companion.stateDirectory,
    });

    assert.equal(
      await submitHook(companion, {
        session_id: "active-session",
        hook_event_name: "UserPromptSubmit",
        prompt: "private prompt",
      }),
      0,
    );
    assert.deepEqual(companion.pets(), [
      { sessionId: "active-session", activity: "Thinking", label: "openagentpet" },
    ]);

    assert.equal(
      await submitHook(companion, {
        session_id: "active-session",
        hook_event_name: "Stop",
      }),
      0,
    );
    assert.deepEqual(companion.pets(), [
      { sessionId: "active-session", activity: "Idle", label: "openagentpet" },
    ]);
    assert.deepEqual(windowRefreshes, [
      { sessionId: "active-session", activity: "Thinking", label: "openagentpet" },
      { sessionId: "active-session", activity: "Idle", label: "openagentpet" },
    ]);
  } finally {
    await cleanup();
  }
});

test("tool lifecycle hooks select Researching or Working, then Thinking", async () => {
  const { companion, cleanup } = await testCompanion(() => undefined);
  const cases = [
    ["WebSearch", "Researching"],
    ["WebFetch", "Researching"],
    ["Bash", "Working"],
    ["mcp__github__search_repositories", "Working"],
    ["FutureUnknownTool", "Working"],
  ] as const;

  await companion.start();
  try {
    await runCli(["spawn", "--session-id", "tool-session"], {
      socketPath: companion.socketPath,
      stateDirectory: companion.stateDirectory,
    });

    for (const [toolName, expectedActivity] of cases) {
      assert.equal(
        await submitHook(companion, {
          session_id: "tool-session",
          hook_event_name: "PreToolUse",
          tool_name: toolName,
          tool_input: { private: "not forwarded" },
          tool_use_id: `tool-${toolName}`,
        }),
        0,
      );
      assert.equal(companion.pets()[0]?.activity, expectedActivity);

      assert.equal(
        await submitHook(companion, {
          session_id: "tool-session",
          hook_event_name: "PostToolUse",
          tool_name: toolName,
          tool_input: { private: "not forwarded" },
          tool_response: { private: "not forwarded" },
          tool_use_id: `tool-${toolName}`,
        }),
        0,
      );
      assert.equal(companion.pets()[0]?.activity, "Thinking");
    }
  } finally {
    await cleanup();
  }
});

test("only a tool permission request selects Needs input and failures return to Thinking", async () => {
  const { companion, cleanup } = await testCompanion(() => undefined);

  await companion.start();
  try {
    await runCli(["spawn", "--session-id", "permission-session"], {
      socketPath: companion.socketPath,
      stateDirectory: companion.stateDirectory,
    });
    await submitHook(companion, {
      session_id: "permission-session",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_use_id: "permission-tool",
      tool_input: { private: "not forwarded" },
    });

    assert.equal(
      await submitHook(companion, {
        session_id: "permission-session",
        hook_event_name: "PermissionRequest",
        tool_name: "Bash",
        tool_input: { private: "not forwarded" },
      }),
      0,
    );
    assert.equal(companion.pets()[0]?.activity, "Needs input");

    assert.equal(
      await submitHook(companion, {
        session_id: "permission-session",
        hook_event_name: "Notification",
        notification_type: "idle_prompt",
      }),
      64,
    );
    assert.equal(companion.pets()[0]?.activity, "Needs input");

    assert.equal(
      await submitHook(companion, {
        session_id: "permission-session",
        hook_event_name: "PostToolUseFailure",
        tool_name: "Bash",
        tool_use_id: "permission-tool",
        error: "private failure",
      }),
      0,
    );
    assert.equal(companion.pets()[0]?.activity, "Thinking");
  } finally {
    await cleanup();
  }
});

test("overlapping Activity states follow priority without crossing Session bindings", async () => {
  const { companion, cleanup } = await testCompanion(() => undefined);

  await companion.start();
  try {
    for (const sessionId of ["priority-session", "isolated-session"]) {
      await runCli(["spawn", "--session-id", sessionId], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
      });
    }
    await submitHook(companion, {
      session_id: "isolated-session",
      hook_event_name: "UserPromptSubmit",
    });

    await submitHook(companion, {
      session_id: "priority-session",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_use_id: "permission-tool",
    });
    assert.equal(companion.pets()[0]?.activity, "Working");

    await submitHook(companion, {
      session_id: "priority-session",
      hook_event_name: "PreToolUse",
      tool_name: "WebSearch",
      tool_use_id: "research-tool",
    });
    assert.equal(companion.pets()[0]?.activity, "Researching");

    await submitHook(companion, {
      session_id: "priority-session",
      hook_event_name: "PermissionRequest",
      tool_name: "Bash",
    });
    assert.equal(companion.pets()[0]?.activity, "Needs input");

    await submitHook(companion, {
      session_id: "priority-session",
      hook_event_name: "PreToolUse",
      tool_name: "mcp__github__search_repositories",
      tool_use_id: "other-working-tool",
    });

    await submitHook(companion, {
      session_id: "priority-session",
      hook_event_name: "PostToolUse",
      tool_name: "WebSearch",
      tool_use_id: "research-tool",
    });
    assert.equal(companion.pets()[0]?.activity, "Needs input");

    await submitHook(companion, {
      session_id: "priority-session",
      hook_event_name: "PostToolUse",
      tool_name: "mcp__github__search_repositories",
      tool_use_id: "other-working-tool",
    });
    assert.equal(companion.pets()[0]?.activity, "Needs input");

    await submitHook(companion, {
      session_id: "priority-session",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_use_id: "permission-tool",
    });
    assert.deepEqual(companion.pets(), [
      { sessionId: "priority-session", activity: "Thinking", label: "openagentpet" },
      { sessionId: "isolated-session", activity: "Thinking", label: "openagentpet" },
    ]);
  } finally {
    await cleanup();
  }
});

test("Activity state hooks neither create a Pet nor relaunch the Companion", async () => {
  const windowCreations: Pet[] = [];
  const { companion, cleanup } = await testCompanion((pet) =>
    windowCreations.push({ ...pet }),
  );
  let companionStarts = 0;
  const event = {
    session_id: "absent-session",
    hook_event_name: "UserPromptSubmit",
  };

  await companion.start();
  try {
    assert.equal(await submitHook(companion, event), 0);
    assert.deepEqual(companion.pets(), []);
    assert.deepEqual(windowCreations, []);

    await companion.quit();
    assert.equal(
      await runCli(["hook"], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
        readInput: async () => JSON.stringify(event),
        startCompanion: async () => {
          companionStarts += 1;
        },
      }),
      0,
    );
    assert.equal(companionStarts, 0);
  } finally {
    await cleanup();
  }
});

test("a closed Pet can be spawned again", async () => {
  let windowCreations = 0;
  let closeWindow: () => void = () => undefined;
  const { companion, cleanup } = await testCompanion((_pet, _options, onClosed) => {
    windowCreations += 1;
    closeWindow = onClosed;
  });

  await companion.start();
  try {
    assert.equal(
      await runCli(["spawn", "--session-id", "closed-session"], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
      }),
      0,
    );
    closeWindow();
    assert.deepEqual(companion.pets(), []);

    assert.equal(
      await runCli(["spawn", "--session-id", "closed-session"], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
      }),
      0,
    );
    assert.equal(windowCreations, 2);
  } finally {
    await cleanup();
  }
});

test("sessions can spawn and despawn independently", async () => {
  const windowRemovals: string[] = [];
  const { companion, cleanup } = await testCompanion(
    () => undefined,
    (sessionId) => windowRemovals.push(sessionId),
  );

  await companion.start();
  try {
    for (const sessionId of ["first-session", "second-session"]) {
      assert.equal(
        await runCli(["spawn", "--session-id", sessionId], {
          socketPath: companion.socketPath,
          stateDirectory: companion.stateDirectory,
        }),
        0,
      );
    }
    assert.deepEqual(companion.pets(), [
      { sessionId: "first-session", activity: "Idle", label: "openagentpet" },
      { sessionId: "second-session", activity: "Idle", label: "openagentpet" },
    ]);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.equal(
        await runCli(["despawn", "--session-id", "first-session"], {
          socketPath: companion.socketPath,
          stateDirectory: companion.stateDirectory,
        }),
        0,
      );
    }
    assert.deepEqual(companion.pets(), [
      { sessionId: "second-session", activity: "Idle", label: "openagentpet" },
    ]);
    assert.deepEqual(windowRemovals, ["first-session"]);
  } finally {
    await cleanup();
  }
});

test("session end removes its Pet without relaunching the Companion", async () => {
  const windowRemovals: string[] = [];
  const { companion, cleanup } = await testCompanion(
    () => undefined,
    (sessionId) => windowRemovals.push(sessionId),
  );
  let companionStarts = 0;
  const options = {
    socketPath: companion.socketPath,
    stateDirectory: companion.stateDirectory,
    startCompanion: async () => {
      companionStarts += 1;
    },
    readInput: async () =>
      JSON.stringify({
        session_id: "ending-session",
        transcript_path: "/private/transcript.jsonl",
        hook_event_name: "SessionEnd",
        reason: "other",
      }),
  };

  await companion.start();
  try {
    assert.equal(
      await runCli(["spawn", "--session-id", "ending-session"], {
        socketPath: companion.socketPath,
        stateDirectory: companion.stateDirectory,
      }),
      0,
    );
    assert.equal(await runCli(["session-end"], options), 0);
    assert.deepEqual(companion.pets(), []);
    assert.deepEqual(windowRemovals, ["ending-session"]);

    await companion.quit();
    assert.equal(await runCli(["session-end"], options), 0);
    assert.equal(companionStarts, 0);
  } finally {
    await cleanup();
  }
});

test("quitting the Companion removes all Pets and restart starts empty", async () => {
  const windowRemovals: string[] = [];
  const { companion, cleanup } = await testCompanion(
    () => undefined,
    (sessionId) => windowRemovals.push(sessionId),
  );

  await companion.start();
  try {
    for (const sessionId of ["first-session", "second-session"]) {
      assert.equal(
        await runCli(["spawn", "--session-id", sessionId], {
          socketPath: companion.socketPath,
          stateDirectory: companion.stateDirectory,
        }),
        0,
      );
    }

    await companion.quit();
    assert.deepEqual(companion.pets(), []);
    assert.deepEqual(windowRemovals, ["first-session", "second-session"]);

    await companion.start();
    assert.deepEqual(companion.pets(), []);
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
      JSON.stringify({
        version: 1,
        command: "activity",
        sessionId: "opaque-session",
        activity: "Working",
        update: "set",
      }),
      JSON.stringify({
        version: 1,
        command: "activity",
        sessionId: "opaque-session",
        activity: "Working",
        update: "start",
        toolName: "private",
      }),
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

async function testCompanion(
  createWindow: (
    pet: Pet,
    options: PetWindowOptions,
    onClosed: () => void,
  ) => void,
  removeWindow: (sessionId: string) => void = () => undefined,
  refreshWindow: (pet: Pet) => void = () => undefined,
) {
  const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-test-"));
  const companion = createCompanion({
    createWindow,
    removeWindow,
    refreshWindow,
    socketPath: controlEndpointIn(runtimeDirectory),
    stateDirectory: runtimeDirectory,
  });
  return {
    companion,
    cleanup: async () => {
      try {
        await companion.quit();
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

function submitHook(
  companion: { socketPath: string; stateDirectory: string },
  event: Record<string, unknown>,
) {
  return runCli(["hook"], {
    socketPath: companion.socketPath,
    stateDirectory: companion.stateDirectory,
    readInput: async () => JSON.stringify(event),
  });
}
