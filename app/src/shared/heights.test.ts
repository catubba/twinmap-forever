import { expect, test } from 'vitest'
import { blockHeights, blockHoles, FLAT, heightAt, packHeights, shadeOfBlock, SHADE_PIXELS, SIDE, STEP, unpackHeights } from './heights'
import { HOLE, levelsOfTile } from './levels'
import { BLOCK_YARDS, terrainFiles } from './world'

const chunk = (tag: string, data: Buffer): Buffer => {
  const head = Buffer.alloc(8)
  head.write(tag, 'latin1')
  head.writeUInt32LE(data.length, 4)
  return Buffer.concat([head, data])
}

// A terrain file with one chunk, the third down and the fourth across of block 32, 48 (Elwynn), 100 yards up; its grid
// heights are 10 a row down and 1 a column across, the ones in the middle of its squares 999 (left out).
function oneChunk(holes?: (head: Buffer) => void): Buffer {
  const head = Buffer.alloc(128)
  holes?.(head)
  head.writeFloatLE((32 - 48) * BLOCK_YARDS - 2 * 8 * STEP, 0x68)
  head.writeFloatLE(-3 * 8 * STEP, 0x6c)
  head.writeFloatLE(100, 0x70)
  const mcvt = Buffer.alloc(145 * 4)
  for (let i = 0; i < 145; i++) {
    const r = Math.floor(i / 17), c = i % 17
    mcvt.writeFloatLE(c < 9 ? r * 10 + c : 999, i * 4)
  }
  return Buffer.concat([chunk('REVM', Buffer.alloc(4)), chunk('KNCM', Buffer.concat([head, chunk('VCCM', Buffer.alloc(16)), chunk('TVCM', mcvt)]))])
}

test('a chunk lands on its place in the block, the middle heights left out', () => {
  const h = blockHeights(oneChunk(), 32, 48)!
  expect(h.length).toBe(SIDE * SIDE)
  expect(h[16 * SIDE + 24]).toBe(100)
  expect(h[(16 + 8) * SIDE + 24 + 8]).toBe(188)
  expect(h[(16 + 3) * SIDE + 24 + 5]).toBe(135)
  expect(h[0]).toBeNaN()
  expect(h.filter((v) => !Number.isNaN(v)).length).toBe(81)
})

test('a file with no ground in it is none', () => {
  expect(blockHeights(chunk('REVM', Buffer.alloc(4)), 32, 48)).toBeNull()
})

test('kept in quarters of a yard, and read between the heights', () => {
  const h = blockHeights(oneChunk(), 32, 48)!
  const back = unpackHeights(packHeights(h))
  expect(back[(16 + 1) * SIDE + 24 + 1]).toBe(111)
  expect(back[5]).toBeNaN()
  expect(unpackHeights(packHeights(Float32Array.of(12.3, -4.2)))).toEqual(Float32Array.of(12.25, -4.25))
  // Halfway between the first two rows and columns of the chunk: 100, 101, 110, 111.
  const x = (32 - 48) * BLOCK_YARDS - (16.5 * STEP), y = -(24.5 * STEP)
  expect(heightAt(h, 32, 48, x, y)).toBeCloseTo(105.5)
})

test('the terrain file of a block is the first of its eight in the world file', () => {
  const maid = Buffer.alloc(64 * 64 * 32)
  maid.writeUInt32LE(778027, (48 * 64 + 32) * 32)
  maid.writeUInt32LE(204493, (48 * 64 + 32) * 32 + 28)
  expect([...terrainFiles(chunk('DIAM', maid))]).toEqual([[48 * 64 + 32, 778027]])
})

test('the light comes from the north-west: ground rising to the east or the south faces it', () => {
  const plane = (east: number, south: number): Float32Array => Float32Array.from({ length: SIDE * SIDE }, (_, i) => 100 + (i % SIDE) * east + Math.floor(i / SIDE) * south)
  const middle = (h: Float32Array): number => shadeOfBlock((c, r) => (c === 32 && r === 48 ? h : null), 32, 48, 1)[128 * SHADE_PIXELS + 128]!
  expect(middle(plane(0, 0))).toBe(FLAT)
  expect(middle(plane(1, 0))).toBeGreaterThan(FLAT)
  expect(middle(plane(-1, 0))).toBeLessThan(FLAT)
  expect(middle(plane(0, 1))).toBeGreaterThan(FLAT)
  expect(middle(plane(0, -1))).toBeLessThan(FLAT)
  // Lit from the side (rising to the north-east): as level ground, however steep, so the map keeps its brightness.
  expect(middle(plane(1, -1))).toBe(FLAT)
  expect(middle(plane(3, -3))).toBe(FLAT)
})

test('the holes of a chunk land on its squares: a bit for each 2 x 2, or a bit a square', () => {
  const S = SIDE - 1
  expect(blockHoles(oneChunk(), 32, 48)).toBeNull()
  // The second pair of rows, the third pair of columns.
  const coarse = blockHoles(oneChunk((head) => head.writeUInt16LE(1 << (1 * 4 + 2), 0x3c)), 32, 48)!
  expect(coarse.reduce((n, v) => n + v, 0)).toBe(4)
  for (const [r, c] of [[2, 4], [2, 5], [3, 4], [3, 5]]) expect(coarse[(16 + r!) * S + 24 + c!]).toBe(1)
  // The fourth row, the sixth column.
  const fine = blockHoles(oneChunk((head) => (head.writeUInt32LE(0x10000, 0), head.writeUInt8(1 << 5, 0x14 + 3))), 32, 48)!
  expect(fine.reduce((n, v) => n + v, 0)).toBe(1)
  expect(fine[(16 + 3) * S + 24 + 5]).toBe(1)
  // In the 3D tiles: on the block's own, and below it only where every square under one is a hole.
  const heights = new Float32Array(SIDE * SIDE), block = (holes: Uint8Array) => (c: number, r: number) => (c === 32 && r === 48 ? { heights, water: null, holes } : null)
  expect(levelsOfTile(6, 32, 48, block(fine))!.kinds[(16 + 3) * S + 24 + 5]).toBe(HOLE)
  expect(levelsOfTile(5, 16, 24, block(coarse))!.kinds.some((k) => k & HOLE)).toBe(false)
  expect(levelsOfTile(5, 16, 24, block(new Uint8Array(S * S).fill(1)))!.kinds[0]).toBe(HOLE)
})
