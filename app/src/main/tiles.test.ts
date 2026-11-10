import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { decodeBlp } from '../shared/blp'
import { tileOfBlock } from '../shared/pixels'
import { minimapTiles } from '../shared/world'
import { blockFile, convertWorld, servedFile, tileFile } from './tiles'

type Color = [number, number, number]

function blpHead(size: number, encoding: 1 | 2, dataBytes: number): Buffer {
  const f = Buffer.alloc(148 + 1024 + dataBytes)
  f.write('BLP2', 'latin1')
  f.writeUInt32LE(1, 4)
  f[8] = encoding
  f.writeUInt32LE(size, 12)
  f.writeUInt32LE(size, 16)
  f.writeUInt32LE(148 + 1024, 20)
  f.writeUInt32LE(dataBytes, 84)
  return f
}

// A picture as the game stores its minimap: DXT1 blocks. One color on the left half, one on the right.
function dxtBlp(size: number, left: Color, right: Color = left): Buffer {
  const f = blpHead(size, 2, (size * size) / 2)
  const c565 = (c: Color): number => ((c[0] >> 3) << 11) | ((c[1] >> 2) << 5) | (c[2] >> 3)
  for (let i = 0, n = (size * size) / 16; i < n; i++) {
    const color = c565(i % (size / 4) < size / 8 ? left : right)
    f.writeUInt16LE(color, 148 + 1024 + i * 8) // both colors the same, every pixel the first
    f.writeUInt16LE(color, 148 + 1024 + i * 8 + 2)
  }
  return f
}

// A picture of one color stored with a pallet: not what the minimap uses, but the converter must cope.
function palletBlp(size: number, color: Color): Buffer {
  const f = blpHead(size, 1, size * size) // every pixel is pallet entry 0
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

// The color the map shows at a pixel of a tile: from the block's own file at zoom 7 and 6 when
// there is one, from a PNG otherwise. The way the window will draw it.
function shown(folder: string, zoom: number, column: number, row: number, x: number, y: number): Color {
  const [blockColumn, blockRow] = zoom === 7 ? [column >> 1, row >> 1] : [column, row]
  let rgb: Uint8Array
  if (zoom >= 6 && existsSync(blockFile(folder, blockColumn, blockRow))) {
    const dxt = inflateSync(readFileSync(blockFile(folder, blockColumn, blockRow)))
    rgb = tileOfBlock(dxt, zoom === 7 ? (column & 1) + (row & 1) * 2 : undefined)
  } else {
    const png = readFileSync(tileFile(folder, zoom, column, row))
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([256, 256])
    const raw = inflateSync(png.subarray(41, 41 + png.readUInt32BE(33)))
    rgb = Buffer.concat(Array.from({ length: 256 }, (_, r) => raw.subarray(r * 769 + 1, (r + 1) * 769)))
  }
  return [rgb[(y * 256 + x) * 3]!, rgb[(y * 256 + x) * 3 + 1]!, rgb[(y * 256 + x) * 3 + 2]!]
}
const files = (folder: string): string[] =>
  (readdirSync(folder, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.png') || f.endsWith('.dxt'))
    .map((f) => f.replace(/\\/g, '/'))
    .sort()

const RED: Color = [255, 0, 0], GREEN: Color = [0, 255, 0], BLUE: Color = [0, 0, 255], WHITE: Color = [255, 255, 255], BLACK: Color = [0, 0, 0]
// Four blocks in the top left corner of the world: red and white halves, green, a pallet picture
// (white), and under the first a blue one of half the size. A fifth is listed but the game lacks it.
const FILES: Record<number, Buffer> = { 11: dxtBlp(512, RED, WHITE), 12: dxtBlp(512, GREEN), 13: dxtBlp(256, BLUE), 14: palletBlp(512, WHITE) }
const WORLD = worldFile({ 0: 11, 1: 12, 2: 14, 64: 13, 65: 99 })

test('the world file lists the picture of each block that has one', () => {
  expect([...minimapTiles(WORLD)]).toEqual([[0, 11], [1, 12], [2, 14], [64, 13], [65, 99]])
})

test('a picture stored in DXT blocks decodes to its colors', () => {
  const f = blpHead(4, 2, 8)
  f.writeUInt16LE(0xf800, 148 + 1024) // pure red
  f.writeUInt16LE(0x001f, 148 + 1026) // pure blue
  f.writeUInt32LE(0b01000100, 148 + 1028) // first row: red, blue, red, blue; the rest red
  const { width, height, rgb } = decodeBlp(f)
  expect([width, height]).toEqual([4, 4])
  expect([...rgb.subarray(0, 12)]).toEqual([255, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 255])
  expect([...rgb.subarray(12, 15)]).toEqual([255, 0, 0])
})

test('a block is kept as the game stores it, and the lower levels as tiles, each half the one above', () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-tiles-'))
  const progress: number[] = []
  const result = convertWorld(WORLD, (id) => FILES[id] ?? null, folder, (done, total) => progress.push(done / total))
  // Five tiles a block (four at zoom 7, one at zoom 6), then two at zoom 5 and one at each level below.
  expect(result).toEqual({ converted: true, tiles: 4 * 5 + 2 + 5, missing: 1 })
  expect(progress).toEqual([0.2, 0.4, 0.6, 0.8, 1])

  // The game's own blocks, untouched: three files for the three DXT pictures, none for the others.
  expect(files(folder).filter((f) => f.startsWith('blocks/'))).toEqual(['blocks/0/0.dxt', 'blocks/0/1.dxt', 'blocks/1/0.dxt'])
  expect(inflateSync(readFileSync(blockFile(folder, 0, 0))).equals(FILES[11]!.subarray(148 + 1024))).toBe(true)
  // The pallet picture has no block file: it is PNG tiles at zoom 7 and 6.
  expect(files(folder).filter((f) => /^[67]\//.test(f))).toEqual(['6/2/0.png', '7/4/0.png', '7/4/1.png', '7/5/0.png', '7/5/1.png'])

  // What the map shows. Zoom 7: the quarters of each block.
  expect([shown(folder, 7, 0, 0, 5, 5), shown(folder, 7, 1, 0, 5, 5), shown(folder, 7, 1, 1, 250, 250)]).toEqual([RED, WHITE, WHITE])
  expect([shown(folder, 7, 3, 1, 250, 250), shown(folder, 7, 1, 3, 100, 100), shown(folder, 7, 5, 0, 9, 9)]).toEqual([GREEN, BLUE, WHITE])
  // Zoom 6: the block halved.
  expect([shown(folder, 6, 0, 0, 100, 128), shown(folder, 6, 0, 0, 140, 128), shown(folder, 6, 1, 0, 128, 128), shown(folder, 6, 0, 1, 128, 128)]).toEqual([RED, WHITE, GREEN, BLUE])
  // Zoom 5: four blocks a tile. The first tile has red and white, green, blue, and a block the game lacks.
  expect([[10, 10], [100, 10], [200, 10], [10, 200], [200, 200]].map(([x, y]) => shown(folder, 5, 0, 0, x!, y!))).toEqual([RED, WHITE, GREEN, BLUE, BLACK])
  expect(shown(folder, 5, 1, 0, 10, 10)).toEqual(WHITE)
  // At zoom 0 a block is 4 pixels, in the corner of the one tile.
  expect([[0, 1], [5, 1], [9, 1], [1, 5], [100, 100]].map(([x, y]) => shown(folder, 0, 0, 0, x!, y!))).toEqual([RED, GREEN, WHITE, BLUE, BLACK])
})

test('a second run converts nothing, and an interrupted one makes only the files that are missing', () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-tiles-'))
  let reads = 0
  const read = (id: number): Buffer | null => (reads++, FILES[id] ?? null)
  const first = convertWorld(WORLD, read, folder)
  reads = 0
  expect(convertWorld(WORLD, read, folder)).toEqual({ ...first, converted: false })
  expect(reads).toBe(0)

  // As if the app had been closed halfway: no marker, a block and a tile not yet written.
  const old = new Date(2000, 0, 1)
  for (const f of files(folder)) utimesSync(join(folder, f), old, old)
  rmSync(join(folder, 'done.json'))
  rmSync(blockFile(folder, 1, 0))
  rmSync(tileFile(folder, 5, 0, 0))
  expect(convertWorld(WORLD, read, folder)).toEqual(first)
  const rewritten = files(folder).filter((f) => statSync(join(folder, f)).mtimeMs > old.getTime())
  expect(rewritten).toEqual(['5/0/0.png', 'blocks/1/0.dxt'])
})

test('a folder finished in the older layout is made again', () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-tiles-'))
  writeFileSync(join(folder, 'done.json'), JSON.stringify({ tiles: 21, missing: 1 }))
  writeFileSync(join(folder, 'leftover.png'), 'old')
  expect(convertWorld(WORLD, (id) => FILES[id] ?? null, folder).converted).toBe(true)
  expect(existsSync(join(folder, 'leftover.png'))).toBe(false)
})

test('the window is given only the files the converter writes', () => {
  const base = join('C:', 'data', 'tiles', 'abc')
  expect(servedFile(base, '/azeroth/blocks/31/49.dxt')).toBe(join(base, 'azeroth', 'blocks', '31', '49.dxt'))
  expect(servedFile(base, '/kalimdor/5/12/7.png')).toBe(join(base, 'kalimdor', '5', '12', '7.png'))
  expect(servedFile(base, '/maps.json')).toBe(join(base, 'maps.json'))
  for (const path of ['/azeroth/done.json', '/../secret.png', '/azeroth/../../5/1/1.png', '/azeroth/blocks/1/1.dxt/..', '/azeroth/5/1/1.PNG', '/AZEROTH/5/1/1.png', '']) {
    expect(servedFile(base, path), path).toBeNull()
  }
})
