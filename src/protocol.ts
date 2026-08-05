export const PROTOCOL_VERSION = 2;
export const MAX_MESSAGE_BYTES = 1024;
export const MAX_PET_LABEL_LENGTH = 100;
export const PROTOCOL_MISMATCH_ERROR =
  "The running Companion is incompatible. Quit and restart OpenAgentPet.";

export const ACTIVITIES = [
  "Idle",
  "Thinking",
  "Researching",
  "Working",
  "Needs input",
] as const;

export type Activity = (typeof ACTIVITIES)[number];
export type ToolActivity = "Researching" | "Working";

export type Pet = {
  sessionId: string;
  activity: Activity;
  label: string;
};

export type SpawnCommand = Pet & {
  version: typeof PROTOCOL_VERSION;
  command: "spawn";
};

export type RemoveCommand = {
  version: typeof PROTOCOL_VERSION;
  command: "despawn" | "session-end";
  sessionId: string;
};

export type ActivityCommand = {
  version: typeof PROTOCOL_VERSION;
  command: "activity";
  sessionId: string;
  activity: Activity;
};

export type PackUseCommand = {
  version: typeof PROTOCOL_VERSION;
  command: "pack-use";
  path: string;
};

export type Command = SpawnCommand | RemoveCommand | ActivityCommand | PackUseCommand;

export function spawnCommand(sessionId: string, label: string): SpawnCommand {
  return {
    version: PROTOCOL_VERSION,
    command: "spawn",
    sessionId,
    activity: "Idle",
    label,
  };
}

export function removeCommand(
  command: RemoveCommand["command"],
  sessionId: string,
): RemoveCommand {
  return { version: PROTOCOL_VERSION, command, sessionId };
}

export function activityCommand(
  sessionId: string,
  activity: Activity,
): ActivityCommand {
  return { version: PROTOCOL_VERSION, command: "activity", sessionId, activity };
}

export function packUseCommand(packPath: string): PackUseCommand {
  return { version: PROTOCOL_VERSION, command: "pack-use", path: packPath };
}

export function parseCommand(input: string): Command | undefined {
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
  if (command.version !== PROTOCOL_VERSION) return undefined;
  if (
    command.command === "pack-use" &&
    typeof command.path === "string" &&
    command.path.length > 0 &&
    command.path.length <= 768 &&
    keys.join(",") === "command,path,version"
  ) {
    return command as PackUseCommand;
  }
  if (
    typeof command.sessionId !== "string" ||
    command.sessionId.length === 0 ||
    command.sessionId.length > 256
  ) return undefined;
  if (
    command.command === "spawn" &&
    command.activity === "Idle" &&
    isPetLabel(command.label) &&
    keys.join(",") === "activity,command,label,sessionId,version"
  ) {
    return command as SpawnCommand;
  }
  if (
    (command.command === "despawn" || command.command === "session-end") &&
    keys.join(",") === "command,sessionId,version"
  ) {
    return command as RemoveCommand;
  }
  if (
    command.command === "activity" &&
    ACTIVITIES.includes(command.activity as Activity) &&
    keys.join(",") === "activity,command,sessionId,version"
  ) {
    return command as ActivityCommand;
  }
  return undefined;
}

export function isPetLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PET_LABEL_LENGTH &&
    value.trim() === value &&
    value !== "." &&
    value !== ".." &&
    !/[\\/\0-\x1F\x7F]/.test(value)
  );
}

export function hasProtocolVersionMismatch(input: string) {
  try {
    const value: unknown = JSON.parse(input);
    return (
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).version !== PROTOCOL_VERSION
    );
  } catch {
    return false;
  }
}
