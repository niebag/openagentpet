import { chmod, lstat, mkdir, unlink } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { MAX_MESSAGE_BYTES, parseCommand, type Pet } from "./protocol.js";

const runtimeDirectory = path.join(os.tmpdir(), `openagentpet-${process.getuid?.() ?? "user"}`);
export const defaultSocketPath = path.join(runtimeDirectory, "control.sock");

const idleWindowOptions = {
  width: 320,
  height: 320,
  transparent: true,
  frame: false,
  resizable: false,
  hasShadow: false,
  alwaysOnTop: true,
  show: false,
} as const;

export type PetWindowOptions = typeof idleWindowOptions;

type CompanionOptions = {
  createWindow: (pet: Pet, options: PetWindowOptions) => void;
  socketPath?: string;
};

export function createCompanion({
  createWindow,
  socketPath = defaultSocketPath,
}: CompanionOptions) {
  const registry = new Map<string, Pet>();
  const server = net.createServer((socket) => {
    let input = "";
    let handled = false;

    const reject = () => {
      handled = true;
      socket.end('{"ok":false}\n');
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
        reject();
        return;
      }
      handled = true;
      const pet = { sessionId: command.sessionId, activity: command.activity } satisfies Pet;
      const exists = registry.has(pet.sessionId);
      registry.set(pet.sessionId, pet);
      if (!exists) {
        createWindow(pet, idleWindowOptions);
      }
      socket.end('{"ok":true}\n');
    });
    socket.on("end", () => {
      if (!handled) reject();
    });
    socket.on("error", () => undefined);
  });

  return {
    socketPath,
    pets: () => [...registry.values()],
    async start() {
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
    async stop() {
      if (server.listening) {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
      await unlink(socketPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    },
  };
}
