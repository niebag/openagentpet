export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 1024;

export type Activity = "Idle" | "Thinking" | "Researching" | "Working" | "Needs input";
export type ToolActivity = "Researching" | "Working";

export type Pet = {
  sessionId: string;
  activity: Activity;
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

export type Command = SpawnCommand | RemoveCommand | ActivityCommand;

export function spawnCommand(sessionId: string): SpawnCommand {
  return {
    version: PROTOCOL_VERSION,
    command: "spawn",
    sessionId,
    activity: "Idle",
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
  if (
    command.version !== PROTOCOL_VERSION ||
    typeof command.sessionId !== "string" ||
    command.sessionId.length === 0 ||
    command.sessionId.length > 256
  ) {
    return undefined;
  }
  if (
    command.command === "spawn" &&
    command.activity === "Idle" &&
    keys.join(",") === "activity,command,sessionId,version"
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
    (command.activity === "Idle" ||
      command.activity === "Thinking" ||
      command.activity === "Researching" ||
      command.activity === "Working" ||
      command.activity === "Needs input") &&
    keys.join(",") === "activity,command,sessionId,version"
  ) {
    return command as ActivityCommand;
  }
  return undefined;
}
