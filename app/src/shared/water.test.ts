import { expect, test } from 'vitest'
import { SIDE } from './heights'
import { levelsOfTile, packLevels, SPARSE, unpackLevels } from './levels'
import { blockWater, DRY, FEL, LAVA, liquidOfName, SQUARES, TAR, WATER } from './water'

// An MH2O chunk with layers in the chunks given: [chunk, type, x, y, w, h, top, heights a vertex or none, bits or none].
function mh2o(layers: [number, number, number, number, number, number, number, number[]?, number[]?][]): Buffer {
  const data = Buffer.alloc(256 * 12 + layers.length * 24 + 4096)
  let free = 256 * 12 + layers.length * 24
  layers.forEach(([chunk, type, x, y, w, h, top, heights, bits], n) => {
    const at = 256 * 12 + n * 24
    data.writeUInt32LE(at, chunk * 12)
    data.writeUInt32LE(1, chunk * 12 + 4)
    data.writeUInt16LE(type, at)
    data.writeUInt16LE(42, at + 2)
    data.writeFloatLE(Math.min(top, ...(heights ?? [])), at + 4)
    data.writeFloatLE(top, at + 8)
    data.set([x, y, w, h], at + 12)
    if (bits) {
      data.writeUInt32LE(free, at + 16)
      data.set(bits, free)
      free += bits.length
    }
    if (heights) {
      data.writeUInt32LE(free, at + 20)
      heights.forEach((v, i) => data.writeFloatLE(v, free + i * 4))
      free += heights.length * 4
    } else {
      // A depth-only format: bytes that are no heights.
      data.writeUInt32LE(free, at + 20)
      data.fill(200, free, free + 64)
      free += 64
    }
  })
  const head = Buffer.alloc(8)
  head.write('O2HM', 'latin1')
  head.writeUInt32LE(data.length, 4)
  return Buffer.concat([head, data])
}

test('a liquid is told by its name in the game table', () => {
  expect(['PBRWater - Generic - Ocean', 'Slow Water'].map(liquidOfName)).toEqual([WATER, WATER])
  expect(['Slow Magma', '10FX - Generic - Lava - Molten - Exterior - (0.3 Depth)'].map(liquidOfName)).toEqual([LAVA, LAVA])
  expect(['1.60.0 FX - Fel - Generic - Bright - Lake', '8SWA Tar Pits - (C60)'].map(liquidOfName)).toEqual([FEL, TAR])
})

test('the liquids of a block lie on the squares of its grid, flat or sloping', () => {
  const kind = (type: number): number => (type === 7 ? LAVA : WATER)
  const adt = mh2o([
    [0, 1, 0, 0, 8, 8, 10], // the whole of the first chunk, flat at 10
    [17, 7, 2, 1, 2, 1, 50, [50, 49, 48, 47, 46, 45]], // in the second row of chunks, two squares of lava going down
    [255, 1, 0, 0, 2, 2, 5, undefined, [0b1001]], // the last chunk: two of its four squares, by their bits
  ])
  const w = blockWater(adt, kind)!
  expect(w.kinds[0]).toBe(WATER)
  expect(w.kinds[7 * SQUARES + 7]).toBe(WATER)
  expect(w.kinds[8 * SQUARES + 8]).toBe(DRY)
  expect(w.levels[8 * SIDE + 8]).toBe(10) // the far corner of the first chunk
  expect(w.levels[9 * SIDE + 9]).toBeNaN()
  // Chunk 17: row of chunks 1, column 1; squares x 2-3, y 1.
  expect(w.kinds[9 * SQUARES + 10]).toBe(LAVA)
  expect(w.kinds[9 * SQUARES + 11]).toBe(LAVA)
  expect(w.kinds[9 * SQUARES + 12]).toBe(DRY)
  expect([w.levels[9 * SIDE + 10], w.levels[9 * SIDE + 12], w.levels[10 * SIDE + 10]]).toEqual([50, 48, 47])
  // Chunk 255: squares 0 and 3 of a 2 x 2.
  const r = 120,
    c = 120
  expect([w.kinds[r * SQUARES + c], w.kinds[r * SQUARES + c + 1], w.kinds[(r + 1) * SQUARES + c], w.kinds[(r + 1) * SQUARES + c + 1]]).toEqual([WATER, DRY, DRY, WATER])
  // Depth-only bytes are no heights: flat at the top.
  expect(w.levels[r * SIDE + c]).toBe(5)
  expect(blockWater(mh2o([]), kind)).toBeNull()
})

test('a tile of the 3D ground is its blocks, every vertex at zoom 6 and fewer below', () => {
  const heights = (base: number): Float32Array => Float32Array.from({ length: SIDE * SIDE }, (_, i) => base + Math.floor(i / SIDE) + (i % SIDE) / 1000)
  const water = blockWater(mh2o([[0, 1, 0, 0, 8, 8, 10]]), () => WATER)
  const blocks = new Map([
    ['32 48', { heights: heights(0), water }],
    ['33 48', { heights: heights(1000), water: null }],
  ])
  const block = (c: number, r: number) => blocks.get(`${c} ${r}`) ?? null
  const six = levelsOfTile(6, 32, 48, block)!
  expect(six.side).toBe(SIDE)
  expect(six.heights[5 * SIDE + 7]).toBeCloseTo(5.007)
  expect(six.kinds[0]).toBe(WATER)
  expect(levelsOfTile(6, 31, 48, block)).toBeNull()
  // Zoom 5: blocks 32-33, 48-49 at every fourth vertex; the far edges from the block they end, the gaps NaN.
  const five = levelsOfTile(5, 16, 24, block)!
  expect(five.side).toBe(SPARSE)
  expect(five.heights[1 * SPARSE + 1]).toBeCloseTo(4.004)
  expect(five.heights[0 * SPARSE + 32]).toBeCloseTo(1000) // the first vertex of block 33
  expect(five.heights[0 * SPARSE + 64]).toBeCloseTo(1000.128) // the last of block 33, its own
  expect(five.heights[40 * SPARSE + 1]).toBeNaN() // block 32 49 is not there
  expect(five.kinds[0]).toBe(WATER)
  expect(five.water[0]).toBe(10)
  // Kept and read back to the quarter of a yard.
  const back = unpackLevels(packLevels(five))!
  expect(back.side).toBe(SPARSE)
  expect(back.heights[1 * SPARSE + 1]).toBe(4)
  expect(back.heights[40 * SPARSE + 1]).toBeNaN()
  expect(back.kinds).toEqual(five.kinds)
  expect(unpackLevels(new Uint8Array(10))).toBeNull()
})
