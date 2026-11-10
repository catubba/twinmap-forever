// The little picture work the map needs, on plain red, green, blue bytes of a square. No Node here:
// the converter uses it, and so does the window when it draws a tile from a block of the game.
import { decodeDxt } from './blp'

/** A square cut out of a bigger square picture. */
export function crop(rgb: Uint8Array, from: number, x: number, y: number, size: number): Uint8Array {
  const out = new Uint8Array(size * size * 3)
  for (let row = 0; row < size; row++) out.set(rgb.subarray(((y + row) * from + x) * 3, ((y + row) * from + x + size) * 3), row * size * 3)
  return out
}

/** Half the width and height: each pixel the average of four. */
export function halve(rgb: Uint8Array, from: number): Uint8Array {
  const size = from / 2, out = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = (y * 2 * from + x * 2) * 3, b = a + from * 3
      for (let c = 0; c < 3; c++) out[(y * size + x) * 3 + c] = (rgb[a + c]! + rgb[a + 3 + c]! + rgb[b + c]! + rgb[b + 3 + c]! + 2) >> 2
    }
  }
  return out
}

/** Twice the width and height: each pixel four times. */
export function double(rgb: Uint8Array, from: number): Uint8Array {
  const size = from * 2, out = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = ((y >> 1) * from + (x >> 1)) * 3
      out.set(rgb.subarray(p, p + 3), (y * size + x) * 3)
    }
  }
  return out
}

/** Four squares side by side as one of twice the size; a missing one stays black. Order: top left, top right, bottom left, bottom right. */
export function join(parts: (Uint8Array | undefined)[], size: number): Uint8Array {
  const out = new Uint8Array(size * size * 12)
  parts.forEach((part, i) => {
    if (!part) return
    const left = (i & 1) * size, top = (i >> 1) * size
    for (let row = 0; row < size; row++) out.set(part.subarray(row * size * 3, (row + 1) * size * 3), ((top + row) * size * 2 + left) * 3)
  })
  return out
}

const BLOCK = 512, TILE = 256

/**
 * A tile of 256 pixels from the picture of a block, given as the game's DXT1 blocks (512 pixels
 * wide, a few 256). quarter 0 to 3 (top left, top right, bottom left, bottom right): the tile of
 * zoom 7. No quarter: the tile of zoom 6, the whole block.
 */
export function tileOfBlock(dxt: Uint8Array, quarter?: number): Uint8Array {
  const size = Math.sqrt(dxt.length * 2)
  // ponytail: the whole block is decoded for one quarter, 4 ms instead of 1. Keep the decoded block of the last few if panning feels slow.
  const rgb = decodeDxt(dxt, size, size)
  if (quarter === undefined) return size === BLOCK ? halve(rgb, BLOCK) : rgb
  return crop(size === BLOCK ? rgb : double(rgb, size), BLOCK, (quarter & 1) * TILE, (quarter >> 1) * TILE, TILE)
}
