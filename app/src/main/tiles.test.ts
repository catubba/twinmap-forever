import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { decodeBlp } from '../shared/blp'
import { minimapTiles } from '../shared/world'
import { convertWorld } from './tiles'

type Color = [number, number, number]

// A picture of one color, stored with a pallet.
function palletBlp(size: number, color: Color): Buffer {
  const f = Buffer.alloc(148 + 1024 + size * size) // every pixel is pallet entry 0
  f.write('BLP2', 'latin1')
  f.writeUInt32LE(1, 4)
  f[8] = 1
  f.writeUInt32LE(size, 12)
  f.writeUInt32LE(size, 16)
  f.writeUInt32LE(148 + 1024, 20)
  f.set([color[2], color[1], color[0], 255], 148)
  return f
}

// A world file: a chunk the reader skips, then the list of the pictures of the blocks.
function worldFile(blocks: Record<number, number>): Buffer {
  const version = Buffer.alloc(12)
  version.write('REVM', 'latin1')
  version.writeUInt32LE(4, 4)
  version.writeUInt32LE(18, 8)
  const maid = Buffer.alloc(8 + 4096 * 32)
  maid.write('DIAM', 'latin1')
  maid.writeUInt32LE(4096 * 32, 4)
  for (const [block, file] of Object.entries(blocks)) maid.writeUInt32LE(file, 8 + Number(block) * 32 + 28)
  return Buffer.concat([version, maid])
}

// The color of a pixel of a tile on disk.
function pixel(folder: string, zoom: number, column: number, row: number, x: number, y: number): Color {
  const png = readFileSync(join(folder, String(zoom), String(column), `${row}.png`))
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([256, 256])
  const raw = inflateSync(png.subarray(41, 41 + png.readUInt32BE(33)))
  const at = y * (256 * 3 + 1) + 1 + x * 3
  return [raw[at]!, raw[at + 1]!, raw[at + 2]!]
}
const tileFiles = (folder: string): string[] =>
  (readdirSync(folder, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.replace(/\\/g, '/'))
    .sort()

const RED: Color = [200, 0, 0], GREEN: Color = [0, 200, 0], BLUE: Color = [0, 0, 200], BLACK: Color = [0, 0, 0]
// Three blocks in the top left corner of the world; the third has a picture of half the size.
const FILES: Record<number, Buffer> = { 11: palletBlp(512, RED), 12: palletBlp(512, GREEN), 13: palletBlp(256, BLUE) }
const WORLD = worldFile({ 0: 11, 1: 12, 64: 13, 65: 99 }) // block 65 lists a picture the game does not have

test('the world file lists the picture of each block that has one', () => {
  expect([...minimapTiles(WORLD)]).toEqual([[0, 11], [1, 12], [64, 13], [65, 99]])
})

test('a picture stored in DXT blocks decodes to its colors', () => {
  const f = Buffer.alloc(148 + 1024 + 8)
  f.write('BLP2', 'latin1')
  f[8] = 2
  f.writeUInt32LE(4, 12)
  f.writeUInt32LE(4, 16)
  f.writeUInt32LE(148 + 1024, 20)
  f.writeUInt16LE(0xf800, 148 + 1024) // pure red
  f.writeUInt16LE(0x001f, 148 + 1026) // pure blue
  f.writeUInt32LE(0b01000100, 148 + 1028) // first row: red, blue, red, blue; the rest red
  const { width, height, rgb } = decodeBlp(f)
  expect([width, height]).toEqual([4, 4])
  expect([...rgb.subarray(0, 12)]).toEqual([255, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 255])
  expect([...rgb.subarray(12, 15)]).toEqual([255, 0, 0])
})

test('a continent becomes tiles at every zoom, each level half the one above', () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-tiles-'))
  const progress: number[] = []
  const result = convertWorld(WORLD, (id) => FILES[id] ?? null, folder, (done, total) => progress.push(done / total))
  expect(result).toEqual({ converted: true, tiles: 3 * 4 + 3 + 6, missing: 1 })
  expect(progress).toEqual([0.25, 0.5, 0.75, 1])

  // Zoom 7: four tiles a block. Zoom 6: one. Below: the three blocks share one tile.
  expect(tileFiles(folder).filter((f) => f.startsWith('7/'))).toHaveLength(12)
  expect(pixel(folder, 7, 0, 0, 5, 5)).toEqual(RED)
  expect(pixel(folder, 7, 3, 1, 250, 250)).toEqual(GREEN)
  expect(pixel(folder, 7, 1, 3, 100, 100)).toEqual(BLUE)
  expect(pixel(folder, 6, 1, 0, 128, 128)).toEqual(GREEN)
  expect(existsSync(join(folder, '6', '1', '1.png'))).toBe(false)
  expect([[10, 10], [200, 10], [10, 200], [200, 200]].map(([x, y]) => pixel(folder, 5, 0, 0, x!, y!))).toEqual([RED, GREEN, BLUE, BLACK])
  // At zoom 0 the blocks are 4 pixels each, in the corner of the one tile.
  expect([[1, 1], [5, 1], [1, 5], [100, 100]].map(([x, y]) => pixel(folder, 0, 0, 0, x!, y!))).toEqual([RED, GREEN, BLUE, BLACK])
})

test('a second run converts nothing, and an interrupted one makes only the tiles that are missing', () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-tiles-'))
  let reads = 0
  const read = (id: number): Buffer | null => (reads++, FILES[id] ?? null)
  const first = convertWorld(WORLD, read, folder)
  reads = 0
  expect(convertWorld(WORLD, read, folder)).toEqual({ ...first, converted: false })
  expect(reads).toBe(0)

  // As if the app had been closed halfway: no marker, one tile not yet written.
  const old = new Date(2000, 0, 1)
  for (const f of tileFiles(folder)) utimesSync(join(folder, f), old, old)
  rmSync(join(folder, 'done.json'))
  rmSync(join(folder, '7', '2', '0.png'))
  expect(convertWorld(WORLD, read, folder)).toEqual(first)
  const rewritten = tileFiles(folder).filter((f) => statSync(join(folder, f)).mtimeMs > old.getTime())
  expect(rewritten).toEqual(['7/2/0.png'])
})
