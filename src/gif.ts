/**
 * Minimal GIF87a/GIF89a structure reader.
 *
 * Pet packs only need two answers about a candidate GIF: does it decode, and
 * does it have a transparent colour. macOS answered both by shelling out to
 * `/usr/bin/sips`; walking the block structure answers both on every platform
 * and rejects the same truncated or mislabelled files.
 */

type GifReport = {
  /** Every block parsed cleanly and the file ends on the trailer. */
  valid: boolean;
  /** At least one Graphic Control Extension sets the transparent colour flag. */
  transparent: boolean;
};

const EXTENSION_INTRODUCER = 0x21;
const GRAPHIC_CONTROL_LABEL = 0xf9;
const IMAGE_DESCRIPTOR = 0x2c;
const TRAILER = 0x3b;

export function readGif(contents: Buffer): GifReport {
  const invalid = { valid: false, transparent: false };
  const signature = contents.subarray(0, 6).toString("ascii");
  if (signature !== "GIF87a" && signature !== "GIF89a") return invalid;

  // Logical screen descriptor: 4 bytes of canvas, packed fields, background, aspect.
  let offset = 10;
  if (offset >= contents.length) return invalid;
  const screenFields = contents[offset]!;
  offset += 3;
  if (screenFields & 0x80) offset += colorTableBytes(screenFields);

  let transparent = false;
  let images = 0;
  while (offset < contents.length) {
    const block = contents[offset]!;
    offset += 1;

    if (block === TRAILER) {
      // Anything after the trailer means the file is not a single clean GIF.
      return { valid: offset === contents.length && images > 0, transparent };
    }

    if (block === EXTENSION_INTRODUCER) {
      const label = contents[offset];
      if (label === undefined) return invalid;
      offset += 1;
      if (label === GRAPHIC_CONTROL_LABEL) {
        // Sub-block: size, packed fields, delay, transparent index.
        const size = contents[offset];
        const fields = contents[offset + 1];
        if (size !== 4 || fields === undefined) return invalid;
        if (fields & 0x01) transparent = true;
      }
      const skipped = skipSubBlocks(contents, offset);
      if (skipped === undefined) return invalid;
      offset = skipped;
      continue;
    }

    if (block === IMAGE_DESCRIPTOR) {
      // Position and size, then packed fields carrying the local colour table.
      const imageFields = contents[offset + 8];
      if (imageFields === undefined) return invalid;
      offset += 9;
      if (imageFields & 0x80) offset += colorTableBytes(imageFields);
      // LZW minimum code size, then the compressed image sub-blocks.
      if (offset >= contents.length) return invalid;
      offset += 1;
      const skipped = skipSubBlocks(contents, offset);
      if (skipped === undefined) return invalid;
      offset = skipped;
      images += 1;
      continue;
    }

    return invalid;
  }
  return invalid;
}

function colorTableBytes(packedFields: number) {
  return 3 * 2 ** ((packedFields & 0x07) + 1);
}

/** Returns the offset just past the terminating zero-length sub-block. */
function skipSubBlocks(contents: Buffer, start: number) {
  let offset = start;
  while (offset < contents.length) {
    const size = contents[offset]!;
    offset += 1;
    if (size === 0) return offset;
    offset += size;
  }
  return undefined;
}
