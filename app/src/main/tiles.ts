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

/** What a finished folder holds, or null when the continent is not converted, or only in part. */
export function finished(folder: string): ConvertResult | null {
  const marker = joinPath(folder, MARKER)
  return existsSync(marker) ? { converted: false, ...(JSON.parse(readFileSync(marker, 'utf8')) as { tiles: number; missing: number }) } : null
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
  const before = finished(folder)
  if (before) return before

  let tiles = 0, missing = 0, done = 0
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

  const source = minimapTiles(wdt)
  // One block: its picture makes four tiles at the top zoom and, halved, the one below.
  const block = (column: number, row: number): Buffer | undefined => {
    const file = source.get(row * BLOCKS + column)
    if (file === undefined) return undefined
    let rgb: Buffer | undefined
    try {
      const raw = read(file)
      if (raw) {
        const picture = decodeBlp(raw)
        // A few blocks have a picture of half the size.
        if (picture.width === BLOCK_PIXELS) rgb = picture.rgb
        else if (picture.width === BLOCK_PIXELS / 2) rgb = double(picture.rgb, picture.width)
      }
    } catch {
      rgb = undefined
    }
    onProgress?.(++done, source.size)
    if (!rgb) {
      missing++
      return undefined
    }
    for (let i = 0; i < 4; i++) write(MAX_ZOOM, column * 2 + (i & 1), row * 2 + (i >> 1), crop(rgb, BLOCK_PIXELS, (i & 1) * TILE, (i >> 1) * TILE, TILE))
    const half = halve(rgb, BLOCK_PIXELS)
    write(MAX_ZOOM - 1, column, row, half)
    return half
  }
  // A tile is the four under it, halved: made from the bottom up, one branch at a time, so only a
  // handful of pictures are in memory at once. Where nothing is under it there is no tile.
  const tile = (zoom: number, column: number, row: number): Buffer | undefined => {
    if (zoom === MAX_ZOOM - 1) return block(column, row)
    const four = [0, 1, 2, 3].map((i) => tile(zoom + 1, column * 2 + (i & 1), row * 2 + (i >> 1)))
    if (four.every((part) => !part)) return undefined
    const rgb = halve(join(four, TILE), TILE * 2)
    write(zoom, column, row, rgb)
    return rgb
  }
  tile(0, 0, 0)

  mkdirSync(folder, { recursive: true })
  writeFileSync(joinPath(folder, MARKER), JSON.stringify({ tiles, missing }))
  return { converted: true, tiles, missing }
}
