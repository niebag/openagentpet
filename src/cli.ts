#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { activityForHook, resetHookState } from "./claude-code.js";
import { defaultSocketPath } from "./companion.js";
import {
  discoverPetPacks,
  petPackSelectionPath as defaultPetPackSelectionPath,
  selectPetPack,
  userPetPackDirectory as defaultUserPetPackDirectory,
  type PetPack,
} from "./pet-pack.js";
import {
  activityCommand,
  packUseCommand,
  removeCommand,
  spawnCommand,
  type Command,
} from "./protocol.js";

type RunOptions = {
  socketPath?: string;
  startCompanion?: () => Promise<void>;
  readInput?: () => Promise<string>;
  writeError?: (message: string) => void;
  userPackDirectory?: string;
  input?: Readable;
  output?: Writable;
  selectionPath?: string;
};

export async function runCli(
  argv: string[],
  {
    socketPath = defaultSocketPath,
    startCompanion = launchCompanion,
    readInput = readStdin,
    writeError = console.error,
    userPackDirectory = defaultUserPetPackDirectory,
    input = process.stdin,
    output = process.stdout,
    selectionPath = defaultPetPackSelectionPath,
  }: RunOptions = {},
) {
  const [command, flag, sessionId, ...extra] = argv;
  const stateDirectory = path.dirname(socketPath);
  let message: Command;
  if (command === "pack" && flag === "use" && extra.length === 0) {
    let packPath = sessionId;
    if (!packPath) {
      const pack = await choosePetPack(
        await discoverPetPacks(userPackDirectory),
        input,
        output,
      );
      if (!pack) {
        writeError("OpenAgentPet: No Pet pack selected");
        return 64;
      }
      packPath = pack.directory;
    }
    message = packUseCommand(path.resolve(packPath));
  } else if ((command === "hook" || command === "session-end") && argv.length === 1) {
    let event: unknown;
    try {
      event = JSON.parse(await readInput());
    } catch {
      return 64;
    }
    if (!event || typeof event !== "object" || Array.isArray(event)) return 64;
    const hook = event as Record<string, unknown>;
    const hookSessionId = hook.session_id;
    if (
      typeof hookSessionId !== "string" ||
      hookSessionId.length === 0 ||
      hookSessionId.length > 256
    ) {
      return 64;
    }
    if (hook.hook_event_name === "SessionEnd") {
      await resetHookState(stateDirectory, hookSessionId, "Idle");
      message = removeCommand("session-end", hookSessionId);
    } else {
      if (command !== "hook") return 64;
      const activity = await activityForHook(stateDirectory, hookSessionId, hook);
      if (!activity) return 64;
      message = activityCommand(hookSessionId, activity);
    }
  } else {
    if (
      (command !== "spawn" && command !== "despawn") ||
      flag !== "--session-id" ||
      !sessionId ||
      extra.length > 0
    ) {
      return 64;
    }
    await resetHookState(stateDirectory, sessionId, "Idle");
    message =
      command === "spawn" ? spawnCommand(sessionId) : removeCommand("despawn", sessionId);
  }

  let response: string;
  try {
    response = await sendCommand(socketPath, message);
  } catch (error) {
    if (!isUnavailable(error)) throw error;
    if (message.command === "pack-use") {
      try {
        await selectPetPack(selectionPath, message.path);
        return 0;
      } catch (packError) {
        writeError(`OpenAgentPet: ${(packError as Error).message}`);
        return 1;
      }
    }
    if (message.command !== "spawn") return 0;
    await startCompanion();
    response = await sendWhenReady(socketPath, message);
  }
  const result = JSON.parse(response) as { ok?: boolean; error?: string };
  if (result.ok === true) return 0;
  writeError(`OpenAgentPet: ${result.error ?? "Command failed"}`);
  return 1;
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function choosePetPack(packs: PetPack[], input: Readable, output: Writable) {
  const prompt = createInterface({ input, output });
  try {
    for (const [index, pack] of packs.entries()) {
      output.write(`${index + 1}. ${pack.name} — ${pack.directory}\n`);
    }
    const answer = Number(await prompt.question("Select a Pet pack: "));
    return Number.isInteger(answer) ? packs[answer - 1] : undefined;
  } finally {
    prompt.close();
  }
}

function sendCommand(socketPath: string, command: Command) {
  return new Promise<string>((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let output = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.end(`${JSON.stringify(command)}\n`));
    socket.on("data", (chunk) => (output += chunk));
    socket.on("end", () => resolve(output));
    socket.on("error", reject);
  });
}

async function sendWhenReady(socketPath: string, command: Command) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      return await sendCommand(socketPath, command);
    } catch (error) {
      if (!isUnavailable(error)) throw error;
      await setTimeout(200);
    }
  }
  throw new Error("Companion did not become ready within 30 seconds");
}

function isUnavailable(error: unknown) {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ECONNREFUSED";
}

function launchCompanion() {
  const require = createRequire(import.meta.url);
  const electronPath = require("electron") as string;
  const companionPath = fileURLToPath(new URL("./electron.js", import.meta.url));
  return new Promise<void>((resolve, reject) => {
    const child = spawn(electronPath, [companionPath], {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`OpenAgentPet: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
