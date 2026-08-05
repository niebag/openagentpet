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
  platform?: NodeJS.Platform;
  nodeVersion?: string;
  runProcess?: (command: string, args: string[]) => Promise<ProcessResult>;
  ask?: (prompt: string) => Promise<string>;
  packageVersion?: string;
};

type ProcessResult = { status: number; stdout: string; stderr: string };

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
    platform = process.platform,
    nodeVersion = process.versions.node,
    runProcess = execute,
    ask,
    packageVersion = readPackageVersion(),
  }: RunOptions = {},
) {
  const [command, flag, sessionId, ...extra] = argv;
  if (command === "install" && argv.length === 1) {
    if (platform !== "darwin") {
      writeError("OpenAgentPet requires macOS 13 or newer.");
      return 1;
    }
    if (!versionAtLeast(nodeVersion, [22, 12])) {
      writeError("OpenAgentPet requires Node.js 22.12 or newer. Update Node.js and retry.");
      return 1;
    }
    const macOS = await runProcess("sw_vers", ["-productVersion"]);
    if (macOS.status !== 0 || !versionAtLeast(macOS.stdout.trim(), [13])) {
      writeError("OpenAgentPet requires macOS 13 or newer. Update macOS and retry.");
      return 1;
    }
    const npm = await runProcess("npm", ["--version"]);
    if (npm.status !== 0) {
      writeError("OpenAgentPet: npm is required. Install npm and retry.");
      return 1;
    }
    const prompt = ask ? undefined : createInterface({ input, output });
    const question = ask ?? ((message: string) => prompt!.question(message));
    try {
      output.write("Agent integrations:\n1. Claude Code\n2. Codex (Coming soon)\n");
      const integration = (await question("Select an Agent integration: ")).trim();
      if (integration === "2") {
        writeError("OpenAgentPet: Codex integration is not available yet.");
        return 1;
      }
      if (integration !== "1") {
        writeError("OpenAgentPet: Select Claude Code to continue.");
        return 1;
      }
      const claude = await runProcess("claude", ["--version"]);
      if (claude.status !== 0) {
        writeError("OpenAgentPet requires Claude Code. Install it and retry.");
        return 1;
      }
      const [npmList, marketplaceList, pluginList] = await Promise.all([
        runProcess("npm", ["list", "--global", "--depth=0", "--json", "openagentpet"]),
        runProcess("claude", ["plugin", "marketplace", "list", "--json"]),
        runProcess("claude", ["plugin", "list", "--json"]),
      ]);
      const npmState = parseJson(npmList.stdout) as {
        dependencies?: { openagentpet?: { version?: string } };
      } | undefined;
      const marketplaces = parseJson(marketplaceList.stdout);
      const plugins = parseJson(pluginList.stdout);
      if (!npmState || marketplaceList.status !== 0 || !Array.isArray(marketplaces) ||
          pluginList.status !== 0 || !Array.isArray(plugins)) {
        writeError("OpenAgentPet could not inspect the current installation. Check npm and Claude Code, then retry.");
        return 1;
      }
      const companionVersion = npmState.dependencies?.openagentpet?.version;
      const marketplace = marketplaces.find(
        (entry) => isRecord(entry) && entry.name === "openagentpet",
      );
      const marketplaceCurrent =
        isRecord(marketplace) && marketplace.repo === "niebag/openagentpet";
      const plugin = plugins.find(
        (entry) =>
          isRecord(entry) &&
          entry.id === "openagentpet@openagentpet" &&
          entry.scope === "user",
      );
      const pluginVersion = isRecord(plugin) ? plugin.version : undefined;
      const companionNeedsUpdate = companionVersion !== packageVersion;
      const pluginNeedsUpdate = pluginVersion !== packageVersion;
      if (!companionNeedsUpdate && marketplaceCurrent && !pluginNeedsUpdate) {
        output.write("OpenAgentPet is already installed and up to date.\n");
        return 0;
      }
      output.write(
        companionVersion || pluginVersion
          ? "OpenAgentPet will repair or update the local Companion app and Claude Code plugin for your user account.\n"
          : "OpenAgentPet will install the local Companion app and the Claude Code plugin for your user account.\n",
      );
      const confirmed = (await question("Continue? [y/N] ")).trim().toLowerCase();
      if (confirmed !== "y" && confirmed !== "yes") {
        output.write("Installation cancelled.\n");
        return 0;
      }
      const actions: Array<[string, string[]]> = [];
      if (companionNeedsUpdate) {
        actions.push(["npm", ["install", "--global", `openagentpet@${packageVersion}`]]);
      }
      if (!marketplaceCurrent) {
        actions.push([
          "claude",
          ["plugin", "marketplace", "add", "niebag/openagentpet", "--scope", "user"],
        ]);
      } else if (pluginNeedsUpdate) {
        actions.push(["claude", ["plugin", "marketplace", "update", "openagentpet"]]);
      }
      if (!plugin) {
        actions.push([
          "claude",
          ["plugin", "install", "openagentpet@openagentpet", "--scope", "user"],
        ]);
      } else if (pluginNeedsUpdate) {
        actions.push([
          "claude",
          ["plugin", "update", "openagentpet@openagentpet", "--scope", "user"],
        ]);
      }
      for (const [action, args] of actions) {
        const result = await runProcess(action, args);
        if (result.status !== 0) {
          writeError(`OpenAgentPet: ${result.stderr.trim() || "Installation failed"}`);
          return 1;
        }
      }
      output.write("OpenAgentPet is installed. Start a fresh Claude Code session and run /openagentpet:spawn.\n");
      return 0;
    } finally {
      prompt?.close();
    }
  }
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

function versionAtLeast(version: string, minimum: number[]) {
  const parts = version.split(".").map(Number);
  if (parts.length < minimum.length || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  for (const [index, part] of minimum.entries()) {
    if (parts[index]! > part) return true;
    if (parts[index]! < part) return false;
  }
  return true;
}

function execute(command: string, args: string[]) {
  return new Promise<ProcessResult>((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", (error) => resolve({ status: 127, stdout, stderr: error.message }));
    child.once("close", (status) => resolve({ status: status ?? 1, stdout, stderr }));
  });
}

function readPackageVersion() {
  return (createRequire(import.meta.url)("../../package.json") as { version: string }).version;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`OpenAgentPet: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
