// The height of the ground of a continent, from the game's terrain files: one "root ADT" a block
// (world.ts, terrainFiles), cut in 16 x 16 chunks ("MCNK"). Each chunk has its corner in the world
// and 145 heights over it ("MCVT"): 9 x 9 on a grid of 4.17 yards, and 8 x 8 in the middle of its
// squares. Kept here: the 9 x 9 of every chunk, joined into one grid of 129 x 129 a block, north
// row first, west column first. The middle ones are left out: for shade and shape a grid of 4
// yards is plenty, and it halves what is kept.
//
// A chunk also says which of its 8 x 8 squares are a hole in the ground (the mouth of a cave or a
// mine, under some buildings): a bit a square, or a bit for each 2 x 2 of them (blockHoles).
import { BLOCK_YARDS } from './world'

/** Heights a side of a block. */
export const SIDE = 129
/** Yards between two heights. */
export const STEP = BLOCK_YARDS / (SIDE - 1)

/** The heights of one block, in yards, SIDE x SIDE from its north-west corner; NaN where a chunk is missing. null when the file is not a terrain file. */
export function blockHeights(adt: Buffer, column: number, row: number): Float32Array | null {
  const north = (32 - row) * BLOCK_YARDS, west = (32 - column) * BLOCK_YARDS
  const out = new Float32Array(SIDE * SIDE).fill(NaN)
  let chunks = 0
  for (let at = 0; at + 8 <= adt.length; ) {
    const tag = adt.toString('latin1', at, at + 4), size = adt.readUInt32LE(at + 4), end = at + 8 + size
    if (tag === 'KNCM' && size >= 128) {
      // The chunk's head is 128 bytes; its corner (x north, y west, z up) at 0x68.
      const h = at + 8, x = adt.readFloatLE(h + 0x68), y = adt.readFloatLE(h + 0x6c), z = adt.readFloatLE(h + 0x70)
      const r0 = Math.round((north - x) / STEP), c0 = Math.round((west - y) / STEP)
      for (let sub = h + 128; sub + 8 <= end; sub += 8 + adt.readUInt32LE(sub + 4)) {
        if (adt.toString('latin1', sub, sub + 4) !== 'TVCM' || adt.readUInt32LE(sub + 4) < 145 * 4) continue
        // Rows of 9 and of 8 in turn: the 9s are the grid.
        for (let r = 0; r <= 8; r++) {
          for (let c = 0; c <= 8; c++) {
            const gr = r0 + r, gc = c0 + c
            if (gr >= 0 && gr < SIDE && gc >= 0 && gc < SIDE) out[gr * SIDE + gc] = z + adt.readFloatLE(sub + 8 + (r * 17 + c) * 4)
          }
        }
        chunks++
        break
      }
    }
    at = end
  }
  return chunks ? out : null
}

/**
 * The squares of a block that are a hole in the ground: (SIDE - 1) x (SIDE - 1), north row first,
 * 1 a hole. null when it has none.
 */
export function blockHoles(adt: Buffer, column: number, row: number): Uint8Array | null {
  const north = (32 - row) * BLOCK_YARDS, west = (32 - column) * BLOCK_YARDS, squares = SIDE - 1
  const out = new Uint8Array(squares * squares)
  let any = false
  for (let at = 0; at + 8 <= adt.length; at += 8 + adt.readUInt32LE(at + 4)) {
    if (adt.toString('latin1', at, at + 4) !== 'KNCM' || adt.readUInt32LE(at + 4) < 128) continue
    // In the chunk's head: flags at 0 (0x10000: a bit a square, a byte a row, at 0x14), else 16 bits at 0x3c, one for each 2 x 2 squares.
    const h = at + 8, fine = (adt.readUInt32LE(h) & 0x10000) !== 0, coarse = adt.readUInt16LE(h + 0x3c)
    const r0 = Math.round((north - adt.readFloatLE(h + 0x68)) / STEP), c0 = Math.round((west - adt.readFloatLE(h + 0x6c)) / STEP)
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const hole = fine ? (adt[h + 0x14 + r]! >> c) & 1 : (coarse >> ((r >> 1) * 4 + (c >> 1))) & 1
        const gr = r0 + r, gc = c0 + c
        if (!hole || gr < 0 || gr >= squares || gc < 0 || gc >= squares) continue
        out[gr * squares + gc] = 1
        any = true
      }
    }
  }
  return any ? out : null
}

/** A block's heights as kept on disk: whole quarters of a yard, two bytes each, -32768 where there is none. */
export function packHeights(h: Float32Array): Buffer {
  const out = Buffer.alloc(h.length * 2)
  h.forEach((v, i) => out.writeInt16LE(Number.isNaN(v) ? -32768 : Math.max(-32767, Math.min(32767, Math.round(v * 4))), i * 2))
  return out
}

export function unpackHeights(b: Buffer): Float32Array {
  const out = new Float32Array(b.length / 2)
  for (let i = 0; i < out.length; i++) {
    const v = b.readInt16LE(i * 2)
    out[i] = v === -32768 ? NaN : v / 4
  }
  return out
}

/** Pixels a side of a block's shade: the tile of zoom 6. */
export const SHADE_PIXELS = 256
/** The grey of flat ground in a shade: soft light over it leaves the map as it is. */
export const FLAT = 128

/**
 * The shade of a block as the light from the north-west falls on its ground: one
 * grey a pixel, SHADE_PIXELS x SHADE_PIXELS, FLAT where the ground is level, lighter where it faces
 * the light and darker where it turns from it. strength: how far from FLAT a slope goes. heights:
 * the heights of a block by its column and row, so the edges look across into the next one.
 */
export function shadeOfBlock(heights: (column: number, row: number) => Float32Array | null, column: number, row: number, strength: number): Uint8Array {
  const out = new Uint8Array(SHADE_PIXELS * SHADE_PIXELS).fill(FLAT)
  const own = heights(column, row)
  if (!own) return out
  // A height of the grid by row and column, these counted from this block's corner; past its edge, the next block's.
  const at = (r: number, c: number): number => {
    const dr = r < 0 ? -1 : r >= SIDE ? 1 : 0, dc = c < 0 ? -1 : c >= SIDE ? 1 : 0
    const h = dr || dc ? heights(column + dc, row + dr) : own
    const v = h?.[(r - dr * (SIDE - 1)) * SIDE + (c - dc * (SIDE - 1))]
    return v === undefined || Number.isNaN(v) ? own[Math.min(SIDE - 1, Math.max(0, r)) * SIDE + Math.min(SIDE - 1, Math.max(0, c))]! : v
  }
  // The light on each height of the grid, from the slope across it; the pixels between, blended.
  const light = new Float32Array(SIDE * SIDE)
  for (let r = 0; r < SIDE; r++) {
    for (let c = 0; c < SIDE; c++) {
      const east = (at(r, c + 1) - at(r, c - 1)) / (2 * STEP), south = (at(r + 1, c) - at(r - 1, c)) / (2 * STEP)
      // The light comes from the north-west: from -east and -south. Only how far the slope turns to
      // it or from it counts, not how steep it is: a slope lit from the side stays as level ground
      // does, and the map as a whole keeps its brightness (with the light half up as well, the
      // grey over the ground came to 107 on the whole, not 128).
      light[r * SIDE + c] = (0.5 * east + 0.5 * south) / Math.sqrt(east * east + south * south + 1)
    }
  }
  const scale = (SIDE - 1) / SHADE_PIXELS
  for (let py = 0; py < SHADE_PIXELS; py++) {
    const fr = (py + 0.5) * scale, r = Math.floor(fr), a = fr - r
    for (let px = 0; px < SHADE_PIXELS; px++) {
      const fc = (px + 0.5) * scale, c = Math.floor(fc), b = fc - c, l = (i: number, j: number): number => light[(r + i) * SIDE + c + j]!
      const lit = (l(0, 0) * (1 - b) + l(0, 1) * b) * (1 - a) + (l(1, 0) * (1 - b) + l(1, 1) * b) * a
      if (!Number.isNaN(lit)) out[py * SHADE_PIXELS + px] = Math.max(0, Math.min(255, Math.round(FLAT + lit * 255 * strength)))
    }
  }
  return out
}

/** The height at a point of the world inside a block, between the four heights around it; NaN where there is none. */
export function heightAt(h: Float32Array, column: number, row: number, x: number, y: number): number {
  const fr = ((32 - row) * BLOCK_YARDS - x) / STEP, fc = ((32 - column) * BLOCK_YARDS - y) / STEP
  const r = Math.min(SIDE - 2, Math.max(0, Math.floor(fr))), c = Math.min(SIDE - 2, Math.max(0, Math.floor(fc)))
  const a = fr - r, b = fc - c, at = (i: number, j: number): number => h[(r + i) * SIDE + c + j]!
  return (at(0, 0) * (1 - b) + at(0, 1) * b) * (1 - a) + (at(1, 0) * (1 - b) + at(1, 1) * b) * a
}
