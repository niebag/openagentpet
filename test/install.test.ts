import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import { runCli } from "../src/cli.js";

test("install rejects unsupported operating systems without changing the machine", async () => {
  const errors: string[] = [];
  const commands: string[] = [];

  assert.equal(
    await runCli(["install"], {
      platform: "linux",
      runProcess: async (command, args) => {
        commands.push([command, ...args].join(" "));
        return { status: 0, stdout: "", stderr: "" };
      },
      writeError: (message) => errors.push(message),
    }),
    1,
  );
  assert.deepEqual(commands, []);
  assert.match(errors[0] ?? "", /macOS 13 or newer/);
});

test("install shows Agent integrations and does not allow Codex selection", async () => {
  const output = captureOutput();
  const errors: string[] = [];
  const commands: string[] = [];

  assert.equal(
    await runCli(["install"], {
      platform: "darwin",
      nodeVersion: "22.12.0",
      ask: async () => "2",
      output,
      runProcess: prerequisiteRunner(commands),
      writeError: (message) => errors.push(message),
    }),
    1,
  );
  assert.match(output.text, /1\. Claude Code/);
  assert.match(output.text, /2\. Codex \(Coming soon\)/);
  assert.match(errors[0] ?? "", /Codex integration is not available yet/);
  assert.deepEqual(commands, ["sw_vers -productVersion", "npm --version"]);
});

test("declining first-install confirmation leaves the machine unchanged", async () => {
  const output = captureOutput();
  const prompts: string[] = [];
  const commands: string[] = [];
  const answers = ["1", "n"];

  assert.equal(
    await runCli(["install"], {
      platform: "darwin",
      nodeVersion: "22.12.0",
      ask: async (prompt) => {
        prompts.push(prompt);
        return answers.shift() ?? "";
      },
      output,
      runProcess: prerequisiteRunner(commands),
    }),
    0,
  );
  assert.match(output.text, /local Companion app/);
  assert.match(output.text, /Claude Code plugin/);
  assert.deepEqual(prompts, ["Select an Agent integration: ", "Continue? [y/N] "]);
  assert.equal(commands.some(isChangingCommand), false);
});

test("first install adds the Companion and Claude Code plugin at user scope", async () => {
  const commands: string[] = [];

  assert.equal(
    await runCli(["install"], {
      platform: "darwin",
      nodeVersion: "22.12.0",
      packageVersion: "1.2.3",
      ask: answers("1", "yes"),
      output: captureOutput(),
      runProcess: prerequisiteRunner(commands),
    }),
    0,
  );
  assert.deepEqual(commands.slice(-3), [
    "npm install --global openagentpet@1.2.3",
    "claude plugin marketplace add niebag/openagentpet --scope user",
    "claude plugin install openagentpet@openagentpet --scope user",
  ]);
});

test("rerunning install leaves a current user installation unchanged", async () => {
  const output = captureOutput();
  const commands: string[] = [];
  const runProcess = installedRunner(commands, "1.2.3");

  assert.equal(
    await runCli(["install"], {
      platform: "darwin",
      nodeVersion: "22.12.0",
      packageVersion: "1.2.3",
      ask: answers("1"),
      output,
      runProcess,
    }),
    0,
  );
  assert.match(output.text, /already installed and up to date/);
  assert.equal(commands.some(isChangingCommand), false);
});

test("rerunning install updates only an outdated Claude Code plugin", async () => {
  const commands: string[] = [];
  const runProcess = installedRunner(commands, "1.2.3", "1.0.0");

  assert.equal(
    await runCli(["install"], {
      platform: "darwin",
      nodeVersion: "22.12.0",
      packageVersion: "1.2.3",
      ask: answers("1", "y"),
      output: captureOutput(),
      runProcess,
    }),
    0,
  );
  assert.deepEqual(commands.filter(isChangingCommand), [
    "claude plugin marketplace update openagentpet",
    "claude plugin update openagentpet@openagentpet --scope user",
  ]);
});

test("rerunning install repairs only a missing Claude Code plugin", async () => {
  const commands: string[] = [];
  const runProcess = installedRunner(commands, "1.2.3", null);

  assert.equal(
    await runCli(["install"], {
      platform: "darwin",
      nodeVersion: "22.12.0",
      packageVersion: "1.2.3",
      ask: answers("1", "y"),
      output: captureOutput(),
      runProcess,
    }),
    0,
  );
  assert.deepEqual(commands.filter(isChangingCommand), [
    "claude plugin marketplace update openagentpet",
    "claude plugin install openagentpet@openagentpet --scope user",
  ]);
});

function prerequisiteRunner(commands: string[]) {
  return async (command: string, args: string[]) => {
    commands.push([command, ...args].join(" "));
    if (command === "sw_vers") return { status: 0, stdout: "15.6\n", stderr: "" };
    if (command === "npm" && args[0] === "--version") {
      return { status: 0, stdout: "11.0.0\n", stderr: "" };
    }
    if (command === "npm" && args[0] === "list") {
      return { status: 1, stdout: '{"dependencies":{}}', stderr: "" };
    }
    if (command === "claude" && args[0] === "--version") {
      return { status: 0, stdout: "2.1.222\n", stderr: "" };
    }
    return { status: 0, stdout: command === "claude" ? "[]" : "", stderr: "" };
  };
}

function installedRunner(
  commands: string[],
  companionVersion: string,
  pluginVersion: string | null = companionVersion,
) {
  return async (command: string, args: string[]) => {
    commands.push([command, ...args].join(" "));
    if (command === "sw_vers") return { status: 0, stdout: "15.6\n", stderr: "" };
    if (command === "npm" && args[0] === "--version") {
      return { status: 0, stdout: "11.0.0\n", stderr: "" };
    }
    if (command === "npm") {
      return {
        status: 0,
        stdout: JSON.stringify({
          dependencies: { openagentpet: { version: companionVersion } },
        }),
        stderr: "",
      };
    }
    if (args[0] === "--version") {
      return { status: 0, stdout: "2.1.222\n", stderr: "" };
    }
    if (args[1] === "marketplace" && args[2] === "list") {
      return {
        status: 0,
        stdout: JSON.stringify([{ name: "openagentpet", repo: "niebag/openagentpet" }]),
        stderr: "",
      };
    }
    if (args[1] === "list") {
      return {
        status: 0,
        stdout: JSON.stringify(
          pluginVersion
            ? [{ id: "openagentpet@openagentpet", version: pluginVersion, scope: "user" }]
            : [],
        ),
        stderr: "",
      };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
}

function answers(...values: string[]) {
  return async () => values.shift() ?? "";
}

function isChangingCommand(command: string) {
  return / install | marketplace (add|update) | plugin update /.test(command);
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

test("install reports outdated macOS, Node, and unavailable npm prerequisites", async () => {
  const cases = [
    {
      nodeVersion: "22.12.0",
      results: { sw_vers: { status: 0, stdout: "12.7.6\n", stderr: "" } },
      expected: /macOS 13 or newer/,
    },
    {
      nodeVersion: "22.12.0",
      results: { sw_vers: { status: 0, stdout: "unknown\n", stderr: "" } },
      expected: /macOS 13 or newer/,
    },
    {
      nodeVersion: "20.19.0",
      results: {},
      expected: /Node\.js 22\.12 or newer/,
    },
    {
      nodeVersion: "22.12.0",
      results: {
        sw_vers: { status: 0, stdout: "15.6\n", stderr: "" },
        npm: { status: 127, stdout: "", stderr: "npm not found" },
      },
      expected: /npm is required/,
    },
  ] as const;

  for (const { nodeVersion, results, expected } of cases) {
    const errors: string[] = [];
    assert.equal(
      await runCli(["install"], {
        platform: "darwin",
        nodeVersion,
        runProcess: async (command) =>
          results[command as keyof typeof results] ?? {
            status: 0,
            stdout: "",
            stderr: "",
          },
        writeError: (message) => errors.push(message),
      }),
      1,
    );
    assert.match(errors[0] ?? "", expected);
  }
});
