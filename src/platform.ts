import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

export const isWindows = process.platform === "win32";

/**
 * The Companion listens on a Unix domain socket on macOS and on a named pipe on
 * Windows, where libuv has no filesystem sockets. Both are driven through the
 * same `node:net` API, so only the endpoint string differs.
 */
export function controlEndpointIn(directory: string) {
  return isWindows
    ? // Named pipes share one machine-global namespace, so the endpoint is
      // derived from the per-user runtime directory to keep sessions apart.
      `\\\\.\\pipe\\openagentpet-${createHash("sha256").update(directory).digest("hex").slice(0, 16)}`
    : path.join(directory, "control.sock");
}

export function isNamedPipe(endpoint: string) {
  return /^\\\\[.?]\\pipe\\/.test(endpoint);
}

/** Holds the control endpoint on macOS and the per-session Activity state everywhere. */
export const runtimeDirectory = path.join(
  os.tmpdir(),
  `openagentpet-${process.getuid?.() ?? "user"}`,
);

export const applicationDataDirectory = isWindows
  ? path.join(
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
      "OpenAgentPet",
    )
  : path.join(os.homedir(), "Library", "Application Support", "OpenAgentPet");
