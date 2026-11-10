// Turns the minimap pictures of a continent into the tiles the map shows: squares of 256 pixels at
// eight zoom levels, in a folder of the app. Done once per build of the game.
//
// Zoom 7 is the game's own detail (about a pixel a yard): each picture of a block makes four tiles.
// Each level below halves it; at zoom 0 one tile holds the whole square of 64 x 64 blocks.
// A tile is <folder>/<zoom>/<column>/<row>.png. Where the game has no picture there is no tile.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join as joinPath } from 'node:path'
import { decodeBlp } from '../shared/blp'
import { BLOCK_PIXELS, BLOCKS, minimapTiles } from '../shared/world'
import { crop, double, encodePng, halve, join } from './raster'

export const TILE = 256
export const MAX_ZOOM = 7
const MARKER = 'done.json'

export interface ConvertResult {
  /** False when the folder was already complete and nothing was read. */
  converted: boolean
  /** Tiles in the folder, all levels. */
  tiles: number
  /** Pictures the world lists that could not be read. */
  missing: number
}

/** The folder for the tiles of one build: a new build of the game gets a new folder. */
export function tilesFolder(base: string, buildKey: string): string {
  return joinPath(base, 'tiles', buildKey)
}

/**
 * Converts one continent. wdt: its world file. read: a game file by number. folder: where its tiles go.
 * A folder left half done is finished: tiles already there are kept, so an interrupted run resumes.
 */
export function convertWorld(
  wdt: Buffer,
  read: (id: number) => Buffer | null,
  folder: string,
  onProgress?: (done: number, total: number) => void,
): ConvertResult {
  const marker = joinPath(folder, MARKER)
  if (existsSync(marker)) return { converted: false, ...(JSON.parse(readFileSync(marker, 'utf8')) as { tiles: number; missing: number }) }

  let tiles = 0, missing = 0
  const madeFolders = new Set<string>()
  const write = (zoom: number, column: number, row: number, rgb: Buffer): void => {
    tiles++
    const file = joinPath(folder, String(zoom), String(column), `${row}.png`)
    if (existsSync(file)) return
    if (!madeFolders.has(dirname(file))) {
      mkdirSync(dirname(file), { recursive: true })
      madeFolders.add(dirname(file))
    }
    // Under another name first: a tile is either whole or not there.
    writeFileSync(file + '.part', encodePng(rgb, TILE, TILE))
    renameSync(file + '.part', file)
  }

  // ponytail: a whole level below the top stays in memory, up to 200 MB for Kalimdor. Go through a folder of raw halves if that is too much.
  let level = new Map<number, Buffer>() // block of the level (row * 64 + column) -> its 256 pixel picture
  const source = minimapTiles(wdt)
  let done = 0
  for (const [block, file] of source) {
    const column = block % BLOCKS, row = Math.floor(block / BLOCKS)
    let rgb: Buffer | null = null
    try {
      const raw = read(file)
      if (raw) {
        const picture = decodeBlp(raw)
        // A few blocks have a picture of half the size.
        if (picture.width === BLOCK_PIXELS) rgb = picture.rgb
        else if (picture.width === BLOCK_PIXELS / 2) rgb = double(picture.rgb, picture.width)
      }
    } catch {
      rgb = null
    }
    if (rgb) {
      for (let i = 0; i < 4; i++) write(MAX_ZOOM, column * 2 + (i & 1), row * 2 + (i >> 1), crop(rgb, BLOCK_PIXELS, (i & 1) * TILE, (i >> 1) * TILE, TILE))
      const half = halve(rgb, BLOCK_PIXELS)
      write(MAX_ZOOM - 1, column, row, half)
      level.set(block, half)
    } else missing++
    onProgress?.(++done, source.size)
  }

  // Each level below: a tile from the four under it, halved.
  for (let zoom = MAX_ZOOM - 2; zoom >= 0; zoom--) {
    const below = level
    level = new Map()
    const parents = new Set([...below.keys()].map((b) => (Math.floor(b / BLOCKS) >> 1) * BLOCKS + ((b % BLOCKS) >> 1)))
    for (const parent of parents) {
      const column = parent % BLOCKS, row = Math.floor(parent / BLOCKS)
      const four = [0, 1, 2, 3].map((i) => below.get((row * 2 + (i >> 1)) * BLOCKS + column * 2 + (i & 1)))
      const rgb = halve(join(four, TILE), TILE * 2)
      write(zoom, column, row, rgb)
      level.set(parent, rgb)
    }
  }

  mkdirSync(folder, { recursive: true })
  writeFileSync(marker, JSON.stringify({ tiles, missing }))
  return { converted: true, tiles, missing }
}
