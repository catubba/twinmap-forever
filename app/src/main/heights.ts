// Keeps the heights of a continent's ground (shared/heights.ts) beside its tiles, once per build of
// the game, and the shaded relief the map lays over them:
//   <folder>/heights/<column>/<row>.bin    SIDE x SIDE heights, packHeights, deflated.
//   <folder>/shade/<zoom>/<column>/<row>.png   the relief's tiles, zoom 6 (a block each) and below,
//                                          grey, FLAT where the ground is level or unknown.
//   <folder>/levels/<zoom>/<column>/<row>.bin  the ground of the 3D view (shared/levels.ts), with
//                                          its liquids (shared/water.ts), zoom 6 and below, deflated.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join as joinPath } from 'node:path'
import { deflateSync } from 'node:zlib'
import { blockHeights, blockHoles, FLAT, packHeights, shadeOfBlock, SHADE_PIXELS } from '../shared/heights'
import { BLOCK_ZOOM, levelsOfTile, packLevels } from '../shared/levels'
import { blockWater, type BlockWater } from '../shared/water'
import { halve, join } from '../shared/pixels'
import { BLOCKS, terrainFiles } from '../shared/world'
import { encodePng } from './png'
import { keep } from './tiles'

const MARKER = 'done.json'
/** How far from FLAT a slope goes: the middle of the three the user was shown, chosen on 16 November 2026, balanced the same day. */
export const RELIEF_STRENGTH = 1
/**
 * The look of the relief. Change it whenever the shade is drawn otherwise (light, strength): a folder
 * made with another is made again at the next start, its relief and not its heights. 1 was never
 * released; 2 is the balanced light.
 */
export const RELIEF_VERSION = 2
const SHADE_ZOOM = 6
/** The layout of the 3D tiles: change it when they are made otherwise, and they are made again at the next start, alone. 2: with the holes in the ground. */
export const LEVELS_VERSION = 2

interface Marker {
  blocks?: number
  missing?: number
  relief?: number
  levels?: number
}

export const heightsFile = (folder: string, column: number, row: number): string => joinPath(folder, 'heights', String(column), `${row}.bin`)
export const shadeFile = (folder: string, zoom: number, column: number, row: number): string => joinPath(folder, 'shade', String(zoom), String(column), `${row}.png`)
export const levelsFile = (folder: string, zoom: number, column: number, row: number): string => joinPath(folder, 'levels', String(zoom), String(column), `${row}.bin`)

function markerOf(folder: string): Marker | null {
  try {
    return JSON.parse(readFileSync(joinPath(folder, 'heights', MARKER), 'utf8')) as Marker
  } catch {
    return null
  }
}

/** True when the heights, the relief and the 3D tiles of this continent's folder are all there, made as they are made now. */
export function heightsDone(folder: string): boolean {
  const marker = markerOf(folder)
  return marker?.relief === RELIEF_VERSION && marker.levels === LEVELS_VERSION
}

/**
 * Blocks kept and blocks the world lists that could not be read. A folder already done is left as
 * it is; one left half done is finished, files already there kept. Of the relief and the 3D tiles,
 * only what is missing or made another way is made. liquid: what a liquid type is (water.ts).
 */
export function convertHeights(
  wdt: Buffer,
  read: (id: number) => Buffer | null,
  folder: string,
  onProgress?: (done: number, total: number) => void,
  liquid: (type: number) => number = () => 1,
): { blocks: number; missing: number } {
  if (heightsDone(folder)) return { blocks: -1, missing: -1 }
  const marker = markerOf(folder), shade = marker?.relief !== RELIEF_VERSION, levels = marker?.levels !== LEVELS_VERSION
  // A relief or 3D tiles made another way: they go, or the ones already there would be kept. The heights stay.
  if (marker && shade) rmSync(joinPath(folder, 'shade'), { recursive: true, force: true })
  if (marker && levels) rmSync(joinPath(folder, 'levels'), { recursive: true, force: true })
  const files = terrainFiles(wdt), all = new Map<number, Float32Array>(), waters = new Map<number, BlockWater>(), holes = new Map<number, Uint8Array>()
  let missing = 0, done = 0
  const total = files.size * (1 + (shade ? 1 : 0) + (levels ? 1 : 0)) // read, then shaded, then the 3D tiles
  for (const [block, file] of files) {
    const column = block % BLOCKS, row = Math.floor(block / BLOCKS)
    let h: Float32Array | null = null
    try {
      const adt = read(file)
      h = adt && blockHeights(adt, column, row)
      const water = adt && h && levels ? blockWater(adt, liquid) : null
      if (water) waters.set(block, water)
      const open = adt && h && levels ? blockHoles(adt, column, row) : null
      if (open) holes.set(block, open)
    } catch {
      h = null
    }
    onProgress?.(++done, total)
    if (!h) {
      missing++
      continue
    }
    all.set(block, h)
    keep(heightsFile(folder, column, row), () => deflateSync(packHeights(h), { level: 9 }))
  }

  // The relief: a block's shade is the tile of zoom 6, each level below the four under it halved.
  // ponytail: all the heights of a continent stay in memory for this (some 70 MB); keep a few rows of blocks at a time if the worker runs short.
  const get = (column: number, row: number): Float32Array | null => (column >= 0 && column < BLOCKS && row >= 0 && row < BLOCKS ? (all.get(row * BLOCKS + column) ?? null) : null)
  const flat = new Uint8Array(SHADE_PIXELS * SHADE_PIXELS * 3).fill(FLAT)
  // Kept as one grey byte a pixel: the three of the tiles below are the same.
  const png = (zoom: number, column: number, row: number, rgb: Uint8Array): void => keep(shadeFile(folder, zoom, column, row), () => encodePng(rgb.filter((_, i) => i % 3 === 0), SHADE_PIXELS, SHADE_PIXELS, 1))
  const tile = (zoom: number, column: number, row: number): Uint8Array | undefined => {
    if (zoom === SHADE_ZOOM) {
      if (!all.has(row * BLOCKS + column)) return undefined
      const grey = shadeOfBlock(get, column, row, RELIEF_STRENGTH), rgb = new Uint8Array(grey.length * 3)
      grey.forEach((v, i) => rgb.fill(v, i * 3, i * 3 + 3))
      png(zoom, column, row, rgb)
      onProgress?.(++done, total)
      return rgb
    }
    const four = [0, 1, 2, 3].map((i) => tile(zoom + 1, column * 2 + (i & 1), row * 2 + (i >> 1)))
    if (four.every((part) => !part)) return undefined
    const rgb = halve(join(four.map((part) => part ?? flat), SHADE_PIXELS), SHADE_PIXELS * 2)
    png(zoom, column, row, rgb)
    return rgb
  }
  if (shade) tile(0, 0, 0)

  // The 3D tiles: every block, then each zoom below from them.
  if (levels) {
    const block = (column: number, row: number): { heights: Float32Array; water: BlockWater | null; holes: Uint8Array | null } | null => {
      const heights = get(column, row)
      return heights && { heights, water: waters.get(row * BLOCKS + column) ?? null, holes: holes.get(row * BLOCKS + column) ?? null }
    }
    for (let zoom = BLOCK_ZOOM; zoom >= 0; zoom--) {
      const tiles = 2 ** zoom
      for (let row = 0; row < tiles; row++) {
        for (let column = 0; column < tiles; column++) {
          const made = levelsOfTile(zoom, column, row, block)
          if (made) keep(levelsFile(folder, zoom, column, row), () => deflateSync(packLevels(made)))
          if (zoom === BLOCK_ZOOM && all.has(row * BLOCKS + column)) onProgress?.(++done, total)
        }
      }
    }
  }

  mkdirSync(joinPath(folder, 'heights'), { recursive: true })
  writeFileSync(joinPath(folder, 'heights', MARKER), JSON.stringify({ blocks: all.size, missing, relief: RELIEF_VERSION, levels: LEVELS_VERSION } satisfies Marker))
  return { blocks: all.size, missing }
}
