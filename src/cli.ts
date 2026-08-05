#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { defaultSocketPath } from "./companion.js";
import { removeCommand, spawnCommand, type Command } from "./protocol.js";

type RunOptions = {
  socketPath?: string;
  startCompanion?: () => Promise<void>;
  readInput?: () => Promise<string>;
};

export async function runCli(
  argv: string[],
  {
    socketPath = defaultSocketPath,
    startCompanion = launchCompanion,
    readInput = readStdin,
  }: RunOptions = {},
) {
  const [command, flag, sessionId, ...extra] = argv;
  let message: Command;
  if (command === "session-end" && argv.length === 1) {
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
      hook.hook_event_name !== "SessionEnd" ||
      typeof hookSessionId !== "string" ||
      hookSessionId.length === 0 ||
      hookSessionId.length > 256
    ) {
      return 64;
    }
    message = removeCommand("session-end", hookSessionId);
  } else {
    if (
      (command !== "spawn" && command !== "despawn") ||
      flag !== "--session-id" ||
      !sessionId ||
      extra.length > 0
    ) {
      return 64;
    }
    message =
      command === "spawn" ? spawnCommand(sessionId) : removeCommand("despawn", sessionId);
  }

  let response: string;
  try {
    response = await sendCommand(socketPath, message);
  } catch (error) {
    if (!isUnavailable(error)) throw error;
    if (message.command !== "spawn") return 0;
    await startCompanion();
    response = await sendSpawnWhenReady(socketPath, message.sessionId);
  }
  return JSON.parse(response).ok === true ? 0 : 1;
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
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

async function sendSpawnWhenReady(socketPath: string, sessionId: string) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      return await sendCommand(socketPath, spawnCommand(sessionId));
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
