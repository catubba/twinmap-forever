// Turns the minimap pictures of a continent into what the map shows, in a folder of the app. Done
// once per build of the game.
//
// The map has eight zoom levels of tiles of 256 pixels. Zoom 7 is the game's own detail (about a
// pixel a yard): the picture of a block is four tiles. Each level below halves it; at zoom 0 one
// tile holds the whole square of 64 x 64 blocks.
//
// What is kept, where the game has a picture:
//   <folder>/blocks/<column>/<row>.dxt   a block's picture as the game stores it (DXT1 blocks, 512
//                                         pixels wide, a few 256), deflated. Zoom 7 is its four
//                                         quarters and zoom 6 is the whole of it halved: both are
//                                         drawn from this file, with the very pixels of the game,
//                                         at a third of the size of a PNG.
//   <folder>/<zoom>/<column>/<row>.png   the tiles of zoom 5 and below, each the four under it halved.
// A picture the game stores some other way is kept as PNG tiles at zoom 7 and 6 instead.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join as joinPath } from 'node:path'
import { deflateSync } from 'node:zlib'
import { decodeBlp, decodeDxt, dxt1Of } from '../shared/blp'
import { BLOCK_PIXELS, BLOCKS, minimapTiles } from '../shared/world'
import { crop, double, halve, join } from '../shared/pixels'
import { encodePng } from './png'

export const TILE = 256
export const MAX_ZOOM = 7
const MARKER = 'done.json'
const FORMAT = 2 // of the folder: 1 kept every tile as a PNG

export interface ConvertResult {
  /** False when the folder was already complete and nothing was read. */
  converted: boolean
  /** Tiles the map can show from the folder, all levels. */
  tiles: number
  /** Pictures the world lists that could not be read. */
  missing: number
}

/** The folder for the tiles of one build: a new build of the game gets a new folder. */
export function tilesFolder(base: string, buildKey: string): string {
  return joinPath(base, 'tiles', buildKey)
}

/** The file of a block's picture. */
export function blockFile(folder: string, column: number, row: number): string {
  return joinPath(folder, 'blocks', String(column), `${row}.dxt`)
}

/** The file of a tile of zoom 5 or below (and of zoom 6 and 7 where a block has no .dxt). */
export function tileFile(folder: string, zoom: number, column: number, row: number): string {
  return joinPath(folder, String(zoom), String(column), `${row}.png`)
}

/** What a finished folder holds, or null when the continent is not converted, or only in part, or in an older layout. */
export function finished(folder: string): ConvertResult | null {
  const marker = joinPath(folder, MARKER)
  if (!existsSync(marker)) return null
  const { tiles, missing, format } = JSON.parse(readFileSync(marker, 'utf8')) as { tiles: number; missing: number; format?: number }
  return format === FORMAT ? { converted: false, tiles, missing } : null
}

/**
 * Converts one continent. wdt: its world file. read: a game file by number. folder: where it goes.
 * A folder left half done is finished: files already there are kept, so an interrupted run resumes.
 */
export function convertWorld(
  wdt: Buffer,
  read: (id: number) => Buffer | null,
  folder: string,
  onProgress?: (done: number, total: number) => void,
): ConvertResult {
  const before = finished(folder)
  if (before) return before
  // A folder finished in an older layout is of no use: start again.
  if (existsSync(joinPath(folder, MARKER))) rmSync(folder, { recursive: true, force: true })

  let tiles = 0, missing = 0, done = 0
  const madeFolders = new Set<string>()
  const keep = (file: string, bytes: () => Buffer): void => {
    if (existsSync(file)) return
    if (!madeFolders.has(dirname(file))) {
      mkdirSync(dirname(file), { recursive: true })
      madeFolders.add(dirname(file))
    }
    // Under another name first: a file is either whole or not there.
    writeFileSync(file + '.part', bytes())
    renameSync(file + '.part', file)
  }
  const png = (zoom: number, column: number, row: number, rgb: Uint8Array): void => {
    tiles++
    keep(tileFile(folder, zoom, column, row), () => encodePng(rgb, TILE, TILE))
  }

  const source = minimapTiles(wdt)
  // One block. Gives its picture at 256 pixels, for the levels below.
  const block = (column: number, row: number): Uint8Array | undefined => {
    const file = source.get(row * BLOCKS + column)
    if (file === undefined) return undefined
    let half: Uint8Array | undefined
    try {
      const raw = read(file)
      const dxt = raw && dxt1Of(raw)
      if (dxt && (dxt.size === BLOCK_PIXELS || dxt.size === BLOCK_PIXELS / 2)) {
        // The usual case: the game's own blocks, kept as they are.
        keep(blockFile(folder, column, row), () => deflateSync(dxt.data, { level: 9 }))
        tiles += 5
        const rgb = decodeDxt(dxt.data, dxt.size, dxt.size)
        half = dxt.size === BLOCK_PIXELS ? halve(rgb, BLOCK_PIXELS) : rgb
      } else if (raw) {
        const picture = decodeBlp(raw)
        const rgb = picture.width === BLOCK_PIXELS ? picture.rgb : picture.width === BLOCK_PIXELS / 2 ? double(picture.rgb, picture.width) : undefined
        if (rgb) {
          for (let i = 0; i < 4; i++) png(MAX_ZOOM, column * 2 + (i & 1), row * 2 + (i >> 1), crop(rgb, BLOCK_PIXELS, (i & 1) * TILE, (i >> 1) * TILE, TILE))
          half = halve(rgb, BLOCK_PIXELS)
          png(MAX_ZOOM - 1, column, row, half)
        }
      }
    } catch {
      half = undefined
    }
    onProgress?.(++done, source.size)
    if (!half) missing++
    return half
  }
  // A tile is the four under it, halved: made from the bottom up, one branch at a time, so only a
  // handful of pictures are in memory at once. Where nothing is under it there is no tile.
  const tile = (zoom: number, column: number, row: number): Uint8Array | undefined => {
    if (zoom === MAX_ZOOM - 1) return block(column, row)
    const four = [0, 1, 2, 3].map((i) => tile(zoom + 1, column * 2 + (i & 1), row * 2 + (i >> 1)))
    if (four.every((part) => !part)) return undefined
    const rgb = halve(join(four, TILE), TILE * 2)
    png(zoom, column, row, rgb)
    return rgb
  }
  tile(0, 0, 0)

  mkdirSync(folder, { recursive: true })
  writeFileSync(joinPath(folder, MARKER), JSON.stringify({ tiles, missing, format: FORMAT }))
  return { converted: true, tiles, missing }
}
