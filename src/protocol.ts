export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 1024;

export type Pet = {
  sessionId: string;
  activity: "Idle";
};

export type SpawnCommand = Pet & {
  version: typeof PROTOCOL_VERSION;
  command: "spawn";
};

export function spawnCommand(sessionId: string): SpawnCommand {
  return {
    version: PROTOCOL_VERSION,
    command: "spawn",
    sessionId,
    activity: "Idle",
  };
}

export function parseCommand(input: string): SpawnCommand | undefined {
  if (Buffer.byteLength(input) > MAX_MESSAGE_BYTES) return undefined;

  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const command = value as Record<string, unknown>;
  const keys = Object.keys(command).sort();
  if (keys.join(",") !== "activity,command,sessionId,version") return undefined;
  if (
    command.version !== PROTOCOL_VERSION ||
    command.command !== "spawn" ||
    command.activity !== "Idle" ||
    typeof command.sessionId !== "string" ||
    command.sessionId.length === 0 ||
    command.sessionId.length > 256
  ) {
    return undefined;
  }
  return command as SpawnCommand;
}
