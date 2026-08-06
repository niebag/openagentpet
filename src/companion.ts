import { chmod, lstat, mkdir, unlink } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import {
  loadSelectedPetPack,
  selectPetPack,
  type PetPack,
} from "./pet-pack.js";
import {
  hasProtocolVersionMismatch,
  MAX_MESSAGE_BYTES,
  parseCommand,
  PROTOCOL_MISMATCH_ERROR,
  type Command,
  type Pet,
} from "./protocol.js";

const runtimeDirectory = path.join(os.tmpdir(), `openagentpet-${process.getuid?.() ?? "user"}`);
export const defaultSocketPath = path.join(runtimeDirectory, "control.sock");

const idleWindowOptions = {
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
  show: false,
} as const;

export type PetWindowOptions = typeof idleWindowOptions;

type CompanionOptions = {
  createWindow: (
    pet: Pet,
    options: PetWindowOptions,
    onClosed: () => void,
    pack: PetPack,
  ) => void;
  refreshWindow: (pet: Pet, pack: PetPack) => void;
  removeWindow: (sessionId: string) => void;
  socketPath?: string;
  selectionPath?: string;
};

export function createCompanion({
  createWindow,
  refreshWindow,
  removeWindow,
  socketPath = defaultSocketPath,
  selectionPath = path.join(path.dirname(socketPath), "selected-pack.json"),
}: CompanionOptions) {
  const registry = new Map<string, Pet>();
  let activePack: PetPack;
  const server = net.createServer({ allowHalfOpen: true }, (socket) => {
    let input = "";
    let handled = false;

    const reject = (error?: string) => {
      handled = true;
      socket.end(`${JSON.stringify({ ok: false, ...(error && { error }) })}\n`);
    };

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      if (handled) return;
      input += chunk;
      if (Buffer.byteLength(input) > MAX_MESSAGE_BYTES) {
        reject();
        return;
      }
      const newline = input.indexOf("\n");
      if (newline === -1) return;

      const command = parseCommand(input.slice(0, newline));
      if (!command || input.slice(newline + 1).trim()) {
        reject(
          hasProtocolVersionMismatch(input.slice(0, newline))
            ? PROTOCOL_MISMATCH_ERROR
            : undefined,
        );
        return;
      }
      handled = true;
      void handleCommand(command)
        .then(() => socket.end('{"ok":true}\n'))
        .catch((error: Error) =>
          socket.end(`${JSON.stringify({ ok: false, error: error.message })}\n`),
        );
    });
    socket.on("end", () => {
      if (!handled) reject();
    });
    socket.on("error", () => undefined);
  });

  async function handleCommand(command: Command) {
    if (command.command === "pack-use") {
      const pack = await selectPetPack(selectionPath, command.path);
      activePack = pack;
      for (const pet of registry.values()) refreshWindow(pet, activePack);
    } else if (command.command === "spawn") {
      const existingPet = registry.get(command.sessionId);
      if (existingPet) {
        existingPet.activity = "Idle";
        refreshWindow(existingPet, activePack);
      } else {
        const pet = {
          sessionId: command.sessionId,
          activity: command.activity,
          label: command.label,
        } satisfies Pet;
        registry.set(pet.sessionId, pet);
        createWindow(
          pet,
          idleWindowOptions,
          () => {
            if (registry.get(pet.sessionId) === pet) registry.delete(pet.sessionId);
          },
          activePack,
        );
      }
    } else if (command.command === "activity") {
      const pet = registry.get(command.sessionId);
      if (pet && pet.activity !== command.activity) {
        pet.activity = command.activity;
        refreshWindow(pet, activePack);
      }
    } else if (registry.delete(command.sessionId)) {
      removeWindow(command.sessionId);
    }
  }

  return {
    socketPath,
    pets: () => [...registry.values()],
    async start() {
      activePack = await loadSelectedPetPack(selectionPath);
      await mkdir(path.dirname(socketPath), { recursive: true, mode: 0o700 });
      await chmod(path.dirname(socketPath), 0o700);
      try {
        const staleSocket = await lstat(socketPath);
        if (!staleSocket.isSocket()) throw new Error(`${socketPath} is not a socket`);
        await unlink(socketPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once("error", onError);
        server.listen(socketPath, () => {
          server.off("error", onError);
          resolve();
        });
      });
      await chmod(socketPath, 0o600);
    },
    async quit() {
      if (server.listening) {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
      await unlink(socketPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      for (const sessionId of registry.keys()) removeWindow(sessionId);
      registry.clear();
    },
  };
}
