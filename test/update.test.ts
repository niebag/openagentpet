import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { runCli } from "../src/cli.js";

const day = 24 * 60 * 60 * 1_000;

test("successful update checks run at most once in 24 hours", async () => {
  await withUpdateState(async (socketPath, updateCheckPath) => {
    const commands: string[] = [];
    let now = 1_000_000_000;
    const options = {
      socketPath,
      updateCheckPath,
      now: () => now,
      runProcess: async (command: string, args: string[]) => {
        commands.push([command, ...args].join(" "));
        return { status: 0, stdout: "{}", stderr: "" };
      },
    };

    assert.equal(await runCli(["despawn", "--session-id", "session"], options), 0);
    now += day - 1;
    assert.equal(await runCli(["despawn", "--session-id", "session"], options), 0);
    now += 1;
    assert.equal(await runCli(["despawn", "--session-id", "session"], options), 0);

    assert.deepEqual(commands, [
      "npm outdated --global --json openagentpet",
      "npm outdated --global --json openagentpet",
    ]);
  });
});

test("parallel commands share one update check", async () => {
  await withUpdateState(async (socketPath, updateCheckPath) => {
    let checks = 0;
    const options = {
      socketPath,
      updateCheckPath,
      runProcess: async () => {
        checks += 1;
        return { status: 0, stdout: "{}", stderr: "" };
      },
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        runCli(["despawn", "--session-id", `session-${index}`], options),
      ),
    );
    assert.deepEqual(results, Array.from({ length: 20 }, () => 0));
    assert.equal(checks, 1);
  });
});

test("an abandoned update lock recovers", async () => {
  await withUpdateState(async (socketPath, updateCheckPath) => {
    const lockPath = `${updateCheckPath}.lock`;
    await mkdir(lockPath);
    const staleTime = new Date(Date.now() - 11 * 60 * 1_000);
    await utimes(lockPath, staleTime, staleTime);
    let checks = 0;

    assert.equal(
      await runCli(["despawn", "--session-id", "session"], {
        socketPath,
        updateCheckPath,
        runProcess: async () => {
          checks += 1;
          return { status: 0, stdout: "{}", stderr: "" };
        },
      }),
      0,
    );
    assert.equal(checks, 1);
  });
});

test("a current release completes without prompting", async () => {
  await withUpdateState(async (socketPath, updateCheckPath) => {
    let prompted = false;

    assert.equal(
      await runCli(["despawn", "--session-id", "session"], {
        socketPath,
        updateCheckPath,
        ask: async () => {
          prompted = true;
          return "yes";
        },
        runProcess: async () => ({ status: 0, stdout: "{}", stderr: "" }),
      }),
      0,
    );
    assert.equal(prompted, false);
  });
});

test("declining an available update leaves the requested command successful", async () => {
  await withUpdateState(async (socketPath, updateCheckPath) => {
    const commands: string[] = [];
    const prompts: string[] = [];
    const output = captureOutput();

    assert.equal(
      await runCli(["despawn", "--session-id", "private-session"], {
        socketPath,
        updateCheckPath,
        packageVersion: "1.2.3",
        output,
        ask: async (prompt) => {
          prompts.push(prompt);
          return "n";
        },
        runProcess: outdatedRunner(commands),
      }),
      0,
    );

    assert.match(output.text, /1\.2\.3/);
    assert.match(output.text, /1\.3\.0/);
    assert.match(output.text, /declined/i);
    assert.deepEqual(prompts, ["Update now? [y/N] "]);
    assert.deepEqual(commands, [
      "npm outdated --global --json openagentpet",
      "npm view openagentpet@1.3.0 engines.node --json",
    ]);
  });
});

test("a non-interactive command returns an update offer without waiting for input", {
  timeout: 1_000,
}, async () => {
  await withUpdateState(async (socketPath, updateCheckPath) => {
    const output = captureOutput();

    assert.equal(
      await runCli(["despawn", "--session-id", "session"], {
        socketPath,
        updateCheckPath,
        packageVersion: "1.2.3",
        input: Readable.from([]),
        output,
        runProcess: outdatedRunner([]),
      }),
      0,
    );
    assert.match(output.text, /1\.2\.3 installed, 1\.3\.0 available/);
    assert.match(output.text, /npm install --global openagentpet@1\.3\.0/);
  });
});

test("older and Node-incompatible releases are not offered", async () => {
  for (const { installed, available, engine } of [
    { installed: "1.3.0", available: "1.2.3", engine: ">=22.12.0" },
    { installed: "1.2.3", available: "1.3.0", engine: ">=99.0.0" },
  ]) {
    await withUpdateState(async (socketPath, updateCheckPath) => {
      const output = captureOutput();

      assert.equal(
        await runCli(["despawn", "--session-id", "session"], {
          socketPath,
          updateCheckPath,
          packageVersion: installed,
          nodeVersion: "22.12.0",
          output,
          runProcess: async (_command, args) =>
            args[0] === "outdated"
              ? {
                  status: 1,
                  stdout: JSON.stringify({
                    openagentpet: { current: installed, wanted: available, latest: available },
                  }),
                  stderr: "",
                }
              : { status: 0, stdout: JSON.stringify(engine), stderr: "" },
        }),
        0,
      );
      assert.equal(output.text, "");
    });
  }
});

test("confirming an available update installs the reported release", async () => {
  await withUpdateState(async (socketPath, updateCheckPath) => {
    const commands: string[] = [];
    const output = captureOutput();

    assert.equal(
      await runCli(["despawn", "--session-id", "private-session"], {
        socketPath,
        updateCheckPath,
        packageVersion: "1.2.3",
        output,
        ask: async () => "yes",
        runProcess: outdatedRunner(commands),
      }),
      0,
    );

    assert.deepEqual(commands, [
      "npm outdated --global --json openagentpet",
      "npm view openagentpet@1.3.0 engines.node --json",
      "npm install --global openagentpet@1.3.0",
    ]);
    assert.match(output.text, /updated to 1\.3\.0/i);
    assert.equal(commands.some((command) => command.includes("private-session")), false);
  });
});

test("an update failure is useful and does not fail the requested command", async () => {
  await withUpdateState(async (socketPath, updateCheckPath) => {
    const errors: string[] = [];

    assert.equal(
      await runCli(["despawn", "--session-id", "session"], {
        socketPath,
        updateCheckPath,
        packageVersion: "1.2.3",
        output: captureOutput(),
        ask: async () => "y",
        writeError: (message) => errors.push(message),
        runProcess: async (_command, args) => {
          if (args[0] === "outdated") return outdatedResult();
          if (args[0] === "view") {
            return { status: 0, stdout: JSON.stringify(">=22.12.0"), stderr: "" };
          }
          return { status: 1, stdout: "", stderr: "permission denied" };
        },
      }),
      0,
    );
    assert.match(errors[0] ?? "", /permission denied/);
  });
});

test("network failures do not block commands or cause repeated checks", async () => {
  await withUpdateState(async (socketPath, updateCheckPath) => {
    const errors: string[] = [];
    let checks = 0;
    const options = {
      socketPath,
      updateCheckPath,
      writeError: (message: string) => errors.push(message),
      runProcess: async () => {
        checks += 1;
        return { status: 1, stdout: "", stderr: "network unavailable" };
      },
    };

    assert.equal(await runCli(["despawn", "--session-id", "session"], options), 0);
    assert.equal(await runCli(["despawn", "--session-id", "session"], options), 0);
    assert.equal(checks, 1);
    assert.match(errors[0] ?? "", /network unavailable/);
  });
});

test("hook-only events never check for updates or launch the Companion", async () => {
  let companionStarts = 0;
  let processRuns = 0;

  assert.equal(
    await runCli(["hook"], {
      socketPath: path.join(os.tmpdir(), `missing-${process.pid}.sock`),
      readInput: async () =>
        JSON.stringify({
          session_id: "session",
          hook_event_name: "UserPromptSubmit",
        }),
      startCompanion: async () => {
        companionStarts += 1;
      },
      runProcess: async () => {
        processRuns += 1;
        return { status: 0, stdout: "{}", stderr: "" };
      },
    }),
    0,
  );
  assert.equal(companionStarts, 0);
  assert.equal(processRuns, 0);
});

function outdatedRunner(commands: string[]) {
  return async (command: string, args: string[]) => {
    commands.push([command, ...args].join(" "));
    if (args[0] === "outdated") return outdatedResult();
    if (args[0] === "view") {
      return { status: 0, stdout: JSON.stringify(">=22.12.0"), stderr: "" };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
}

function outdatedResult() {
  return {
    status: 1,
    stdout: JSON.stringify({
      openagentpet: { current: "1.2.3", wanted: "1.3.0", latest: "1.3.0" },
    }),
    stderr: "",
  };
}

async function withUpdateState(
  run: (socketPath: string, updateCheckPath: string) => Promise<void>,
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-update-test-"));
  try {
    await run(
      path.join(directory, "missing.sock"),
      path.join(directory, "update-check.json"),
    );
  } finally {
    await rm(directory, { recursive: true });
  }
}

function captureOutput() {
  const output = new Writable({
    write(chunk, _encoding, done) {
      output.text += chunk.toString();
      done();
    },
  }) as Writable & { text: string };
  output.text = "";
  return output;
}
