import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { runCli } from "../src/cli.js";
import { createCompanion } from "../src/companion.js";
import { defaultPetPackDirectory, loadPetPack } from "../src/pet-pack.js";
import type { Pet } from "../src/protocol.js";

const transparentGif = await readFile(
  path.join(defaultPetPackDirectory, "idle.gif"),
);
const packAssets = {
  Idle: "idle.gif",
  Thinking: "thinking.gif",
  Researching: "researching.gif",
  Working: "working.gif",
  "Needs input": "needs-input.gif",
};

test("the built-in default Pet pack provides every Activity state", async () => {
  const pack = await loadPetPack(defaultPetPackDirectory);

  assert.equal(pack.name, "Default");
  assert.deepEqual(Object.keys(pack.assets), [
    "Idle",
    "Thinking",
    "Researching",
    "Working",
    "Needs input",
  ]);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(pack.assets).map(([activity, asset]) => [
        activity,
        asset.slice(defaultPetPackDirectory.length + 1),
      ]),
    ),
    {
      Idle: "idle.gif",
      Thinking: "thinking.gif",
      Researching: "researching.gif",
      Working: "working.gif",
      "Needs input": "needs-input.gif",
    },
  );
});

test("path selection updates existing and future Pets and rolls back on failure", async () => {
  const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-pack-test-"));
  const selectedPack = await createPack(runtimeDirectory, "selected", "Selected");
  const malformedPack = await createPack(runtimeDirectory, "malformed", "Malformed");
  await writeFile(path.join(malformedPack, "working.gif"), "not a GIF");

  const creations: Array<{ pet: Pet; pack: string }> = [];
  const refreshes: Array<{ pet: Pet; pack: string }> = [];
  const errors: string[] = [];
  const companion = createCompanion({
    socketPath: path.join(runtimeDirectory, "control.sock"),
    selectionPath: path.join(runtimeDirectory, "selection.json"),
    createWindow: (pet, _options, _onClosed, pack) =>
      creations.push({ pet: { ...pet }, pack: pack.name }),
    refreshWindow: (pet, pack) =>
      refreshes.push({ pet: { ...pet }, pack: pack.name }),
    removeWindow: () => undefined,
  });

  await companion.start();
  try {
    assert.equal(
      await runCli(["spawn", "--session-id", "existing"], {
        socketPath: companion.socketPath,
      }),
      0,
    );
    assert.equal(creations[0]?.pack, "Default");

    assert.equal(
      await runCli(["pack", "use", selectedPack], {
        socketPath: companion.socketPath,
        writeError: (message) => errors.push(message),
      }),
      0,
    );
    assert.deepEqual(refreshes, [
      { pet: { sessionId: "existing", activity: "Idle" }, pack: "Selected" },
    ]);

    await runCli(["spawn", "--session-id", "future"], {
      socketPath: companion.socketPath,
    });
    assert.equal(creations.at(-1)?.pack, "Selected");

    assert.equal(
      await runCli(["pack", "use", malformedPack], {
        socketPath: companion.socketPath,
        writeError: (message) => errors.push(message),
      }),
      1,
    );
    assert.match(errors.at(-1) ?? "", /Working must be a decodable transparent GIF/);
    assert.equal(refreshes.length, 1);

    await companion.quit();
    await companion.start();
    await runCli(["spawn", "--session-id", "after-restart"], {
      socketPath: companion.socketPath,
    });
    assert.equal(creations.at(-1)?.pack, "Selected");
  } finally {
    await companion.quit();
    await rm(runtimeDirectory, { recursive: true });
  }
});

test("path selection while stopped does not relaunch the Companion", async () => {
  const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-pack-offline-"));
  const selectedPack = await createPack(runtimeDirectory, "selected", "Offline selection");
  const socketPath = path.join(runtimeDirectory, "control.sock");
  const selectionPath = path.join(runtimeDirectory, "selection.json");
  let starts = 0;

  try {
    assert.equal(
      await runCli(["pack", "use", selectedPack], {
        socketPath,
        selectionPath,
        startCompanion: async () => {
          starts += 1;
          throw new Error("Pack selection must not launch the Companion");
        },
      }),
      0,
    );
    assert.equal(starts, 0);

    const createdWith: string[] = [];
    const companion = createCompanion({
      socketPath,
      selectionPath,
      createWindow: (_pet, _options, _onClosed, pack) => createdWith.push(pack.name),
      refreshWindow: () => undefined,
      removeWindow: () => undefined,
    });
    await companion.start();
    try {
      await runCli(["spawn", "--session-id", "future"], { socketPath });
      assert.deepEqual(createdWith, ["Offline selection"]);
    } finally {
      await companion.quit();
    }
  } finally {
    await rm(runtimeDirectory, { recursive: true });
  }
});

test("interactive selection lists the default and valid user Pet packs", async () => {
  const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "openagentpet-pack-list-"));
  const userDirectory = path.join(runtimeDirectory, "Pet Packs");
  await mkdir(userDirectory);
  await createPack(userDirectory, "valid", "Valid custom pack");
  const invalidPack = await createPack(userDirectory, "invalid", "Invalid custom pack");
  await writeFile(path.join(invalidPack, "manifest.json"), "{}");

  const createdWith: string[] = [];
  const companion = createCompanion({
    socketPath: path.join(runtimeDirectory, "control.sock"),
    selectionPath: path.join(runtimeDirectory, "selection.json"),
    createWindow: (_pet, _options, _onClosed, pack) => createdWith.push(pack.name),
    refreshWindow: () => undefined,
    removeWindow: () => undefined,
  });

  await companion.start();
  try {
    let list = "";
    assert.equal(
      await runCli(["pack", "use"], {
        socketPath: companion.socketPath,
        userPackDirectory: userDirectory,
        input: Readable.from(["2\n"]),
        output: new Writable({
          write(chunk, _encoding, done) {
            list += chunk.toString();
            done();
          },
        }),
      }),
      0,
    );
    assert.match(list, /1\. Default/);
    assert.match(list, /2\. Valid custom pack/);
    assert.doesNotMatch(list, /Invalid custom pack/);
    await runCli(["spawn", "--session-id", "interactive"], {
      socketPath: companion.socketPath,
    });
    assert.deepEqual(createdWith, ["Valid custom pack"]);
  } finally {
    await companion.quit();
    await rm(runtimeDirectory, { recursive: true });
  }
});

test("malformed Pet packs report the failed validation rule", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "openagentpet-pack-invalid-"));
  try {
    const missingState = await createPack(parent, "missing-state", "Missing state");
    const { Idle: _idle, ...incompleteAssets } = packAssets;
    await writeManifest(missingState, "Missing state", incompleteAssets);

    const escapingPath = await createPack(parent, "escaping-path", "Escaping path");
    await writeFile(path.join(parent, "outside.gif"), transparentGif);
    await writeManifest(escapingPath, "Escaping path", {
      ...packAssets,
      Idle: "../outside.gif",
    });

    const wrongFormat = await createPack(parent, "wrong-format", "Wrong format");
    await writeFile(path.join(wrongFormat, "idle.gif"), "not a GIF");

    const missingFile = await createPack(parent, "missing-file", "Missing file");
    await rm(path.join(missingFile, "idle.gif"));

    const opaque = await createPack(parent, "opaque", "Opaque");
    const opaqueGif = Buffer.from(transparentGif);
    for (let offset = 0; offset < opaqueGif.length - 3; offset += 1) {
      if (opaqueGif[offset] === 0x21 && opaqueGif[offset + 1] === 0xf9) {
        opaqueGif[offset + 3] &= 0xfe;
      }
    }
    await writeFile(path.join(opaque, "idle.gif"), opaqueGif);

    const truncated = await createPack(parent, "truncated", "Truncated");
    await writeFile(
      path.join(truncated, "idle.gif"),
      transparentGif.subarray(0, 40_000),
    );

    const extraGif = await createPack(parent, "extra-gif", "Extra GIF");
    await writeFile(path.join(extraGif, "sixth.gif"), transparentGif);

    const errors: string[] = [];
    const companion = createCompanion({
      socketPath: path.join(parent, "control.sock"),
      selectionPath: path.join(parent, "selection.json"),
      createWindow: () => undefined,
      refreshWindow: () => undefined,
      removeWindow: () => undefined,
    });
    await companion.start();
    try {
      for (const [directory, error] of [
        [missingState, /assets must contain exactly/],
        [escapingPath, /must stay inside the Pet pack directory/],
        [wrongFormat, /decodable transparent GIF/],
        [missingFile, /GIF does not exist/],
        [opaque, /decodable transparent GIF/],
        [truncated, /decodable transparent GIF/],
        [extraGif, /exactly the five mapped GIF files/],
      ] as const) {
        const exitCode = await runCli(["pack", "use", directory], {
            socketPath: companion.socketPath,
            writeError: (message) => errors.push(message),
          });
        assert.equal(exitCode, 1, directory);
        assert.match(errors.at(-1) ?? "", error);
      }
    } finally {
      await companion.quit();
    }
  } finally {
    await rm(parent, { recursive: true });
  }
});

async function createPack(parent: string, directoryName: string, name: string) {
  const directory = path.join(parent, directoryName);
  await mkdir(directory);
  await writeManifest(directory, name, packAssets);
  await Promise.all(
    Object.values(packAssets).map((asset) =>
      writeFile(path.join(directory, asset), transparentGif),
    ),
  );
  return directory;
}

function writeManifest(directory: string, name: string, assets: object) {
  return writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify({ name, assets }),
  );
}
