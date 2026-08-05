import { createHash } from "node:crypto";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

import type { Activity, ToolActivity } from "./protocol.js";

const researchTools = new Set(["WebFetch", "WebSearch"]);

type HookTool = {
  sourceId: string;
  activity: ToolActivity;
  permissionKey: string;
  needsPermission: boolean;
  order: number;
};

type HookState = {
  fallbackActivity: "Idle" | "Thinking";
  nextOrder: number;
  tools: HookTool[];
  unmatchedPermissions: Record<string, number>;
};

export async function activityForHook(
  stateDirectory: string,
  sessionId: string,
  hook: Record<string, unknown>,
) {
  if (hook.hook_event_name === "UserPromptSubmit") {
    return resetHookState(stateDirectory, sessionId, "Thinking");
  }
  if (hook.hook_event_name === "Stop") {
    return resetHookState(stateDirectory, sessionId, "Idle");
  }
  if (
    hook.hook_event_name === "PermissionRequest" &&
    typeof hook.tool_name === "string" &&
    hook.tool_name.length > 0
  ) {
    const key = permissionKey(hook);
    return updateHookState(stateDirectory, sessionId, (state) => {
      let match: HookTool | undefined;
      for (const tool of state.tools) {
        if (
          tool.permissionKey === key &&
          !tool.needsPermission &&
          (!match || tool.order > match.order)
        ) {
          match = tool;
        }
      }
      if (match) match.needsPermission = true;
      else state.unmatchedPermissions[key] = (state.unmatchedPermissions[key] ?? 0) + 1;
      return resolveHookActivity(state);
    });
  }
  if (
    (hook.hook_event_name === "PreToolUse" ||
      hook.hook_event_name === "PostToolUse" ||
      hook.hook_event_name === "PostToolUseFailure") &&
    typeof hook.tool_name === "string" &&
    hook.tool_name.length > 0 &&
    typeof hook.tool_use_id === "string" &&
    hook.tool_use_id.length > 0 &&
    hook.tool_use_id.length <= 256
  ) {
    const activity = toolActivity(hook.tool_name);
    const sourceId = hook.tool_use_id;
    const key = permissionKey(hook);
    return updateHookState(stateDirectory, sessionId, (state) => {
      if (hook.hook_event_name === "PreToolUse") {
        state.nextOrder += 1;
        state.tools = state.tools.filter((tool) => tool.sourceId !== sourceId);
        state.tools.push({
          sourceId,
          activity,
          permissionKey: key,
          needsPermission: false,
          order: state.nextOrder,
        });
      } else {
        const tool = state.tools.find((candidate) => candidate.sourceId === sourceId);
        state.tools = state.tools.filter((candidate) => candidate.sourceId !== sourceId);
        if (!tool && state.unmatchedPermissions[key]) {
          state.unmatchedPermissions[key] -= 1;
        }
        state.fallbackActivity = "Thinking";
      }
      return resolveHookActivity(state);
    });
  }
  return undefined;
}

export function resetHookState(
  stateDirectory: string,
  sessionId: string,
  activity: "Idle" | "Thinking",
) {
  return updateHookState(stateDirectory, sessionId, (state) => {
    Object.assign(state, createHookState(activity));
    return activity;
  });
}

async function updateHookState(
  stateDirectory: string,
  sessionId: string,
  update: (state: HookState) => Activity,
) {
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  const statePath = path.join(stateDirectory, `activity-${hash(sessionId)}.json`);
  const lockPath = `${statePath}.lock`;
  const lock = await acquireLock(lockPath);
  try {
    const state = await readHookState(statePath);
    const activity = update(state);
    await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
    return activity;
  } finally {
    await lock.close();
    await unlink(lockPath).catch(ignoreMissing);
  }
}

async function acquireLock(lockPath: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      return await open(lockPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // ponytail: state updates are tiny; replace a lock after waiting one second.
      if (attempt === 100) await unlink(lockPath).catch(ignoreMissing);
      await setTimeout(10);
    }
  }
  throw new Error("Timed out waiting for the Activity state lock");
}

async function readHookState(statePath: string): Promise<HookState> {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8")) as HookState;
    if (
      (state.fallbackActivity === "Idle" || state.fallbackActivity === "Thinking") &&
      typeof state.nextOrder === "number" &&
      Array.isArray(state.tools) &&
      state.unmatchedPermissions
    ) {
      return state;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && error instanceof SyntaxError) {
      return createHookState("Idle");
    }
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return createHookState("Idle");
}

function createHookState(fallbackActivity: "Idle" | "Thinking"): HookState {
  return { fallbackActivity, nextOrder: 0, tools: [], unmatchedPermissions: {} };
}

function resolveHookActivity(state: HookState): Activity {
  if (
    Object.values(state.unmatchedPermissions).some((count) => count > 0) ||
    state.tools.some(({ needsPermission }) => needsPermission)
  ) {
    return "Needs input";
  }
  for (const activity of ["Researching", "Working"] as const) {
    if (state.tools.some((tool) => tool.activity === activity)) return activity;
  }
  return state.fallbackActivity;
}

function toolActivity(toolName: string): ToolActivity {
  return researchTools.has(toolName) ? "Researching" : "Working";
}

function permissionKey(hook: Record<string, unknown>) {
  return hash(JSON.stringify([hook.tool_name, hook.tool_input]));
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function ignoreMissing(error: NodeJS.ErrnoException) {
  if (error.code !== "ENOENT") throw error;
}
