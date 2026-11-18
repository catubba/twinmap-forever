// The ground of the 3D view, in tiles as the map's own: a tile of zoom 6 is a block, each zoom
// below covers four of the one above. A tile holds a grid of heights (heights.ts), the level of the
// liquids over it (water.ts) and what each square of the grid holds: a block's full grid of 129 x
// 129 at zoom 6, 65 x 65 taken from its blocks at every other vertex, every fourth, ... below.
// Kept as whole quarters of a yard, two bytes each, -32768 where there is none: heights, then
// levels, then a byte a square: its liquid, and HOLE where the ground has a hole (below a block,
// only where every square under it has one).
import { SIDE } from './heights'
import type { BlockWater } from './water'

/** The zoom of a block. */
export const BLOCK_ZOOM = 6
/** Vertices a side of a tile below BLOCK_ZOOM. */
export const SPARSE = 65
/** In a square's byte: the ground has a hole here. The rest of the byte is its liquid. */
export const HOLE = 0x80

export interface Levels {
  side: number
  heights: Float32Array
  water: Float32Array
  kinds: Uint8Array
}

const NONE = -32768
const bytesOf = (side: number): number => side * side * 4 + (side - 1) * (side - 1)

export function packLevels(l: Levels): Uint8Array {
  const out = new Uint8Array(bytesOf(l.side)),
    view = new DataView(out.buffer),
    n = l.side * l.side
  const put = (values: Float32Array, at: number): void => values.forEach((v, i) => view.setInt16(at + i * 2, Number.isNaN(v) ? NONE : Math.max(-32767, Math.min(32767, Math.round(v * 4))), true))
  put(l.heights, 0)
  put(l.water, n * 2)
  out.set(l.kinds, n * 4)
  return out
}

export function unpackLevels(b: Uint8Array): Levels | null {
  const side = [SIDE, SPARSE].find((s) => bytesOf(s) === b.length)
  if (!side) return null
  const view = new DataView(b.buffer, b.byteOffset, b.length),
    n = side * side
  const take = (at: number): Float32Array => {
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const v = view.getInt16(at + i * 2, true)
      out[i] = v === NONE ? NaN : v / 4
    }
    return out
  }
  return { side, heights: take(0), water: take(n * 2), kinds: b.slice(n * 4) }
}

/**
 * The tile of this zoom (BLOCK_ZOOM or below), from its blocks; null when none of them is there.
 * block: a block's heights and liquids by its column and row.
 */
export function levelsOfTile(zoom: number, column: number, row: number, block: (column: number, row: number) => { heights: Float32Array; water: BlockWater | null; holes?: Uint8Array | null } | null): Levels | null {
  const blocks = 2 ** (BLOCK_ZOOM - zoom),
    side = zoom >= BLOCK_ZOOM ? SIDE : SPARSE
  const squares = SIDE - 1,
    step = (blocks * squares) / (side - 1)
  let found = false
  for (let r = 0; r < blocks && !found; r++) for (let c = 0; c < blocks && !found; c++) found = block(column * blocks + c, row * blocks + r) !== null
  if (!found) return null
  const out: Levels = {
    side,
    heights: new Float32Array(side * side).fill(NaN),
    water: new Float32Array(side * side).fill(NaN),
    kinds: new Uint8Array((side - 1) * (side - 1)),
  }
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      // The vertex on the grid of the whole world, read from the block it starts; on the tile's far
      // edges from the block it ends (its last row is the next one's first, and the next may not be there).
      const gr = row * blocks * squares + i * step,
        gc = column * blocks * squares + j * step
      const br = Math.floor((gr - (i === side - 1 ? 1 : 0)) / squares),
        bc = Math.floor((gc - (j === side - 1 ? 1 : 0)) / squares)
      const r = gr - br * squares,
        c = gc - bc * squares,
        b = block(bc, br)
      if (!b) continue
      out.heights[i * side + j] = b.heights[r * SIDE + c]!
      const square = i < side - 1 && j < side - 1 ? i * (side - 1) + j : -1
      if (b.water) {
        out.water[i * side + j] = b.water.levels[r * SIDE + c]!
        if (square >= 0) out.kinds[square] = b.water.kinds[r * squares + c]!
      }
      if (square < 0 || !b.holes) continue
      let hole = true
      for (let dr = 0; dr < step && hole; dr++) for (let dc = 0; dc < step && hole; dc++) hole = b.holes[(r + dr) * squares + c + dc] === 1
      if (hole) out.kinds[square]! |= HOLE
    }
  }
  return out
}
