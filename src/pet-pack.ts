import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { ACTIVITIES, type Activity } from "./protocol.js";

const execFileAsync = promisify(execFile);

export type PetPack = {
  name: string;
  directory: string;
  assets: Record<Activity, string>;
};

export const defaultPetPackDirectory = fileURLToPath(
  new URL("../../public/default-pet-pack", import.meta.url),
);
const applicationSupportDirectory = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "OpenAgentPet",
);
export const userPetPackDirectory = path.join(
  applicationSupportDirectory,
  "Pet Packs",
);
export const petPackSelectionPath = path.join(
  applicationSupportDirectory,
  "selected-pack.json",
);

export async function loadPetPack(directory: string): Promise<PetPack> {
  const packDirectory = await realpath(directory).catch(() => {
    throw new Error(`Pet pack directory does not exist: ${directory}`);
  });
  if (!(await stat(packDirectory)).isDirectory()) {
    throw new Error(`Pet pack path is not a directory: ${directory}`);
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(await readFile(path.join(packDirectory, "manifest.json"), "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Pet pack manifest is not valid JSON");
    throw new Error(`Pet pack manifest is missing: ${path.join(directory, "manifest.json")}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Pet pack manifest must be an object");
  }

  const value = manifest as Record<string, unknown>;
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    throw new Error("Pet pack manifest requires a name");
  }
  if (!value.assets || typeof value.assets !== "object" || Array.isArray(value.assets)) {
    throw new Error("Pet pack manifest requires an assets object");
  }
  const assetValues = value.assets as Record<string, unknown>;
  if (Object.keys(assetValues).sort().join("\0") !== [...ACTIVITIES].sort().join("\0")) {
    throw new Error(`Pet pack assets must contain exactly: ${ACTIVITIES.join(", ")}`);
  }

  const assets = {} as Record<Activity, string>;
  for (const activity of ACTIVITIES) {
    const relativeAsset = assetValues[activity];
    if (
      typeof relativeAsset !== "string" ||
      path.isAbsolute(relativeAsset) ||
      path.extname(relativeAsset).toLowerCase() !== ".gif"
    ) {
      throw new Error(`${activity} must reference a local .gif file`);
    }
    const asset = await realpath(path.join(packDirectory, relativeAsset)).catch(() => {
      throw new Error(`${activity} GIF does not exist: ${relativeAsset}`);
    });
    const relativeResolvedAsset = path.relative(packDirectory, asset);
    if (relativeResolvedAsset.startsWith("..") || path.isAbsolute(relativeResolvedAsset)) {
      throw new Error(`${activity} GIF must stay inside the Pet pack directory`);
    }
    if (!(await isTransparentGif(asset))) {
      throw new Error(`${activity} must be a decodable transparent GIF: ${relativeAsset}`);
    }
    assets[activity] = asset;
  }
  if (new Set(Object.values(assets)).size !== ACTIVITIES.length) {
    throw new Error("Pet pack must contain five different GIF files");
  }
  const mappedAssets = new Set(Object.values(assets));
  const gifFiles = await findGifFiles(packDirectory);
  if (gifFiles.length !== ACTIVITIES.length || gifFiles.some((file) => !mappedAssets.has(file))) {
    throw new Error("Pet pack directory must contain exactly the five mapped GIF files");
  }

  return { name: value.name.trim(), directory: packDirectory, assets };
}

export async function loadSelectedPetPack(
  selectionPath: string,
) {
  let directory = defaultPetPackDirectory;
  try {
    const selection = JSON.parse(await readFile(selectionPath, "utf8")) as unknown;
    if (
      selection &&
      typeof selection === "object" &&
      !Array.isArray(selection) &&
      typeof (selection as Record<string, unknown>).path === "string"
    ) {
      directory = (selection as { path: string }).path;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      directory = defaultPetPackDirectory;
    }
  }
  try {
    return await loadPetPack(directory);
  } catch {
    return loadPetPack(defaultPetPackDirectory);
  }
}

export async function savePetPackSelection(selectionPath: string, pack: PetPack) {
  await mkdir(path.dirname(selectionPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${selectionPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify({ path: pack.directory }), { mode: 0o600 });
  await rename(temporaryPath, selectionPath);
}

export async function selectPetPack(selectionPath: string, directory: string) {
  const pack = await loadPetPack(directory);
  await savePetPackSelection(selectionPath, pack);
  return pack;
}

export async function discoverPetPacks(
  directory = userPetPackDirectory,
) {
  const packs = [await loadPetPack(defaultPetPackDirectory)];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return packs;
    throw error;
  }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    try {
      packs.push(await loadPetPack(path.join(directory, entry.name)));
    } catch {
      // Invalid directories are not selectable Pet packs.
    }
  }
  return packs;
}

async function isTransparentGif(asset: string) {
  const contents = await readFile(asset);
  if (
    contents.length < 14 ||
    contents.subarray(0, 3).toString("ascii") !== "GIF" ||
    contents.at(-1) !== 0x3b
  ) return false;

  const decodeDirectory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-gif-"));
  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/sips",
      ["-g", "format", "-g", "hasAlpha", asset],
      { encoding: "utf8" },
    );
    if (!/^\s*format: gif\s*$/m.test(stdout) || !/^\s*hasAlpha: yes\s*$/m.test(stdout)) {
      return false;
    }
    await execFileAsync("/usr/bin/sips", [
      "-s",
      "format",
      "png",
      "-z",
      "1",
      "1",
      asset,
      "--out",
      path.join(decodeDirectory, "frame.png"),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    await rm(decodeDirectory, { recursive: true });
  }
}

async function findGifFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await findGifFiles(entryPath)));
    else if (path.extname(entry.name).toLowerCase() === ".gif") {
      files.push(await realpath(entryPath));
    }
  }
  return files;
}
