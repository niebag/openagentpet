import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readGif } from "../src/gif.js";
import { defaultPetPackDirectory } from "../src/pet-pack.js";

const bundledGifs = [
  "clawd-vibing.gif",
  "clawd-thinking.gif",
  "clawd-researching.gif",
  "clawd-building.gif",
  "clawd-idea.gif",
];

test("every bundled Clawd GIF reads as a decodable transparent GIF", async () => {
  for (const file of bundledGifs) {
    const contents = await readFile(path.join(defaultPetPackDirectory, file));
    assert.deepEqual(readGif(contents), { valid: true, transparent: true }, file);
  }
});

test("a GIF without a transparent colour is decodable but not transparent", () => {
  assert.deepEqual(readGif(buildGif({ transparent: false })), {
    valid: true,
    transparent: false,
  });
});

test("structurally broken files are rejected", () => {
  const complete = buildGif({ transparent: true });

  for (const [name, contents] of [
    ["empty", Buffer.alloc(0)],
    ["not a GIF", Buffer.from("PNG\r\n\n0123456789")],
    ["wrong version", Buffer.concat([Buffer.from("GIF88a"), complete.subarray(6)])],
    ["truncated mid-block", complete.subarray(0, complete.length - 8)],
    ["missing trailer", complete.subarray(0, complete.length - 1)],
    ["trailing bytes after the trailer", Buffer.concat([complete, Buffer.from([0x00])])],
    ["header only", complete.subarray(0, 13)],
  ] as const) {
    assert.equal(readGif(contents).valid, false, name);
  }
});

test("a Graphic Control Extension with the wrong block size is rejected", () => {
  const contents = buildGif({ transparent: true });
  // The byte after the 0xF9 label is the fixed block size of 4.
  contents[contents.indexOf(0xf9) + 1] = 5;

  assert.equal(readGif(contents).valid, false);
});

/** The smallest single-frame GIF89a the reader should accept. */
function buildGif({ transparent }: { transparent: boolean }) {
  return Buffer.from([
    ...Buffer.from("GIF89a"),
    // Logical screen descriptor: 1x1, global colour table of two entries.
    0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
    // Global colour table.
    0x00, 0x00, 0x00, 0xff, 0xff, 0xff,
    // Graphic control extension: size, packed fields, delay, transparent index.
    0x21, 0xf9, 0x04, transparent ? 0x01 : 0x00, 0x00, 0x00, 0x00, 0x00,
    // Image descriptor: position, size, no local colour table.
    0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    // LZW minimum code size, one data sub-block, block terminator.
    0x02, 0x02, 0x4c, 0x01, 0x00,
    // Trailer.
    0x3b,
  ]);
}
