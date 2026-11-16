// The liquids over a block of ground, from the "MH2O" chunk of its terrain file (heights.ts reads
// the ground of the same file). For each of the block's 16 x 16 chunks a list of layers; a layer
// covers a rectangle of the chunk's 8 x 8 squares (with a bit a square where it does not cover them
// all), at one level or at a level a vertex. Laid on the grid of heights.ts: the same 129 x 129
// vertices, 4.17 yards apart, and the 128 x 128 squares between them.
//
// ponytail: a square under two layers keeps the first; the game draws both (a river into a lake). Read the others if a seam shows.
import { SIDE } from './heights'

/** What a square of a block holds. */
export const DRY = 0,
  WATER = 1,
  LAVA = 2,
  FEL = 3,
  TAR = 4
/** Squares a side of a block. */
export const SQUARES = SIDE - 1

/** The game's table of liquids (LiquidType.db2): its column 0 is the name. */
export const LIQUID_TYPE_FILE = 1371380

/** What a liquid is, by its name in the game's table: "Slow Magma", "PBRWater - Generic - Ocean", "8SWA Tar Pits", ... */
export function liquidOfName(name: string): number {
  if (/magma|lava|molten/i.test(name)) return LAVA
  if (/fel|slime/i.test(name)) return FEL
  if (/\btar\b/i.test(name)) return TAR
  return WATER
}

export interface BlockWater {
  /** The level of the liquid at each vertex of the grid, in yards; NaN where no square round it holds any. */
  levels: Float32Array
  /** SQUARES x SQUARES, north row first: DRY, WATER, LAVA, ... */
  kinds: Uint8Array
}

/** The liquids of one block, or null when it has none. liquid: what a liquid type of the file is (liquidOfName of its row). */
export function blockWater(adt: Buffer, liquid: (type: number) => number): BlockWater | null {
  const levels = new Float32Array(SIDE * SIDE).fill(NaN),
    kinds = new Uint8Array(SQUARES * SQUARES)
  let any = false
  for (let at = 0; at + 8 <= adt.length; at += 8 + adt.readUInt32LE(at + 4)) {
    if (adt.toString('latin1', at, at + 4) !== 'O2HM') continue
    const base = at + 8,
      end = at + 8 + adt.readUInt32LE(at + 4)
    const inside = (offset: number, bytes: number): boolean => offset > 0 && base + offset + bytes <= end
    for (let chunk = 0; chunk < 256; chunk++) {
      const head = base + chunk * 12
      if (head + 12 > end) break
      const first = adt.readUInt32LE(head),
        layers = adt.readUInt32LE(head + 4)
      if (!layers || !inside(first, layers * 24)) continue
      // The chunk's corner on the block's grid: chunks go west to east, then north to south.
      const r0 = Math.floor(chunk / 16) * 8,
        c0 = (chunk % 16) * 8
      for (let l = 0; l < layers; l++) {
        const i = base + first + l * 24
        const kind = liquid(adt.readUInt16LE(i)),
          max = adt.readFloatLE(i + 8),
          min = adt.readFloatLE(i + 4)
        const x = adt[i + 12]!,
          y = adt[i + 13]!,
          w = adt[i + 14]!,
          h = adt[i + 15]!
        if (!w || !h || x + w > 8 || y + h > 8 || !Number.isFinite(max)) continue
        const bits = adt.readUInt32LE(i + 16),
          vertices = adt.readUInt32LE(i + 20)
        // Heights a vertex come first in every vertex format that has them; a format without (depth
        // only) gives bytes that are no heights of this layer, and then it lies flat at its top.
        // ponytail: the format is told by the game's tables (LiquidObject, LiquidMaterial); guessed from the values instead.
        const n = (w + 1) * (h + 1)
        let heights: number[] | null = null
        if (inside(vertices, n * 4)) {
          heights = []
          for (let v = 0; v < n; v++) heights.push(adt.readFloatLE(base + vertices + v * 4))
          if (!heights.every((v) => Number.isFinite(v) && v >= min - 1 && v <= max + 1)) heights = null
        }
        const covers = (sx: number, sy: number): boolean => {
          if (!inside(bits, Math.ceil((w * h) / 8))) return true
          const bit = sy * w + sx
          return ((adt[base + bits + (bit >> 3)]! >> (bit & 7)) & 1) === 1
        }
        for (let sy = 0; sy < h; sy++) {
          for (let sx = 0; sx < w; sx++) {
            const r = r0 + y + sy,
              c = c0 + x + sx
            if (kinds[r * SQUARES + c] || !covers(sx, sy)) continue
            kinds[r * SQUARES + c] = kind
            any = true
            for (const [dy, dx] of [
              [0, 0],
              [0, 1],
              [1, 0],
              [1, 1],
            ] as const)
              levels[(r + dy) * SIDE + c + dx] = heights ? heights[(sy + dy) * (w + 1) + sx + dx]! : max
          }
        }
      }
    }
  }
  return any ? { levels, kinds } : null
}
