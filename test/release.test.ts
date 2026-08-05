import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Writable } from "node:stream";
import test from "node:test";

import { runCli } from "../src/cli.js";

const root = new URL("../../", import.meta.url);

test("the public npm package has release metadata and a narrow file allowlist", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  ) as Record<string, unknown>;

  assert.equal(packageJson.version, "1.0.0");
  assert.equal(packageJson.license, "MIT");
  assert.deepEqual(packageJson.os, ["darwin"]);
  assert.deepEqual(packageJson.files, ["dist/src", "public", "LICENSE"]);
  assert.deepEqual(packageJson.repository, {
    type: "git",
    url: "git+https://github.com/niebag/openagentpet.git",
  });
  assert.equal(packageJson.homepage, "https://github.com/niebag/openagentpet#readme");
  assert.deepEqual(packageJson.publishConfig, { access: "public" });
  assert.match(await readFile(new URL("LICENSE", root), "utf8"), /MIT License/);
});

test("the npm package and Claude Code marketplace publish the same release", async () => {
  const [packageJson, marketplaceJson, pluginJson] = await Promise.all(
    ["package.json", ".claude-plugin/marketplace.json", "plugin/.claude-plugin/plugin.json"].map(
      async (file) => JSON.parse(await readFile(new URL(file, root), "utf8")) as {
        version?: string;
        plugins?: Array<{ version?: string; license?: string; repository?: string }>;
      },
    ),
  );

  assert.equal(packageJson.version, "1.0.0");
  assert.equal(marketplaceJson.plugins?.[0]?.version, packageJson.version);
  assert.equal(marketplaceJson.plugins?.[0]?.license, "MIT");
  assert.equal(
    marketplaceJson.plugins?.[0]?.repository,
    "https://github.com/niebag/openagentpet",
  );
  assert.equal(pluginJson.version, packageJson.version);
});

test("the default Pet pack contains the public-release artwork", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("public/default-pet-pack/manifest.json", root), "utf8"),
  ) as { assets: Record<string, string> };

  assert.deepEqual(manifest.assets, {
    Idle: "idle.gif",
    Thinking: "thinking.gif",
    Researching: "researching.gif",
    Working: "working.gif",
    "Needs input": "needs-input.gif",
  });
  const provenance = await readFile(
    new URL("public/default-pet-pack/README.md", root),
    "utf8",
  );
  assert.match(provenance, /generated for OpenAgentPet/i);
  assert.match(provenance, /MIT/);
});

test("the public command reports its release version", async () => {
  let text = "";
  const output = new Writable({
    write(chunk, _encoding, done) {
      text += chunk.toString();
      done();
    },
  });

  assert.equal(await runCli(["--version"], { output, packageVersion: "1.0.0" }), 0);
  assert.equal(text, "1.0.0\n");
});
