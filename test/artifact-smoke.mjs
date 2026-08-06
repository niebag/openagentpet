import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const onWindows = process.platform === "win32";

// npm, claude and the .bin shims are .cmd files on Windows, which only run
// through a shell; the shell in turn needs paths with spaces quoted.
const run = (command, args, options) =>
  execFileAsync(
    onWindows ? quote(command) : command,
    onWindows ? args.map(quote) : args,
    { ...options, shell: onWindows },
  );
const quote = (value) => (/\s/.test(value) ? `"${value}"` : value);
const shim = (directory, name) =>
  path.join(directory, "node_modules", ".bin", onWindows ? `${name}.cmd` : name);

const root = fileURLToPath(new URL("../", import.meta.url));
const releaseVersion = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version;
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-artifact-"));

try {
  assert.ok(
    onWindows || process.platform === "darwin",
    "Release artifacts support macOS and Windows only",
  );

  await run("npm", ["pack", "--pack-destination", temporaryDirectory], {
    cwd: root,
  });
  const tarball = (await readdir(temporaryDirectory)).find((file) => file.endsWith(".tgz"));
  assert.ok(tarball, "npm pack did not produce a tarball");

  const installDirectory = path.join(temporaryDirectory, "install");
  await run(
    "npm",
    [
      "install",
      "--prefix",
      installDirectory,
      "--no-audit",
      "--no-fund",
      path.join(temporaryDirectory, tarball),
    ],
    { cwd: root },
  );

  const packageDirectory = path.join(
    installDirectory,
    "node_modules",
    "openagentpet",
  );
  const packageJson = JSON.parse(
    await readFile(path.join(packageDirectory, "package.json"), "utf8"),
  );
  assert.equal(packageJson.version, releaseVersion);
  assert.equal(packageJson.bin.openagentpet, "dist/src/cli.js");

  const { stdout: version } = await run(shim(installDirectory, "openagentpet"), [
    "--version",
  ]);
  assert.equal(version.trim(), releaseVersion);

  const { stdout: electronVersion } = await run(shim(installDirectory, "electron"), [
    "--version",
  ]);
  assert.match(electronVersion, /v43\./);

  assert.deepEqual(await packageFiles(packageDirectory), [
    "LICENSE",
    "README.md",
    "dist/src/claude-code.js",
    "dist/src/cli.js",
    "dist/src/companion.js",
    "dist/src/electron.js",
    "dist/src/gif.js",
    "dist/src/pet-pack.js",
    "dist/src/platform.js",
    "dist/src/protocol.js",
    "package.json",
    "public/default-pet-pack/clawd-building.gif",
    "public/default-pet-pack/clawd-idea.gif",
    "public/default-pet-pack/clawd-researching.gif",
    "public/default-pet-pack/clawd-thinking.gif",
    "public/default-pet-pack/clawd-vibing.gif",
    "public/default-pet-pack/manifest.json",
    "public/openagentpet-icon.png",
    "public/openagentpet-tray-icon.png",
    "public/pet.html",
    "public/pet.js",
  ]);

  const installedSmoke = path.join(packageDirectory, "dist", "test", "electron-smoke.js");
  await mkdir(path.dirname(installedSmoke), { recursive: true });
  await copyFile(path.join(root, "dist", "test", "electron-smoke.js"), installedSmoke);
  const { stdout: smokeOutput, stderr: smokeError } = await run(
    shim(installDirectory, "electron"),
    [installedSmoke],
  );
  assert.match(
    smokeOutput,
    /Electron smoke test passed on/,
    `Installed Companion smoke test did not pass: ${smokeError}`,
  );

  const claudeEnvironment = {
    ...process.env,
    CLAUDE_CONFIG_DIR: path.join(temporaryDirectory, "claude"),
  };
  await run(
    "claude",
    ["plugin", "marketplace", "add", root, "--scope", "user"],
    { env: claudeEnvironment },
  );
  await run(
    "claude",
    ["plugin", "install", "openagentpet@openagentpet", "--scope", "user"],
    { env: claudeEnvironment },
  );
  const { stdout: pluginsJson } = await run(
    "claude",
    ["plugin", "list", "--json"],
    { env: claudeEnvironment },
  );
  const plugins = JSON.parse(pluginsJson);
  assert.equal(plugins.length, 1);
  assert.deepEqual(
    Object.fromEntries(
      ["id", "version", "scope", "enabled"].map((field) => [
        field,
        plugins[0][field],
      ]),
    ),
    {
      id: "openagentpet@openagentpet",
      version: releaseVersion,
      scope: "user",
      enabled: true,
    },
  );

  console.log("npm artifact and user-scope plugin install smoke test passed");
} finally {
  await rm(temporaryDirectory, { recursive: true });
}

async function packageFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(path.join(directory, prefix), {
    withFileTypes: true,
  })) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await packageFiles(directory, relativePath)));
    // The allowlist is written with the separator npm uses in the tarball.
    else files.push(relativePath.split(path.sep).join("/"));
  }
  return files.sort();
}
