import { expect, test } from 'vitest'
import { blockGround, groundTextures, MIX, MIX_SIDE, NONE, packGround, pileLevel, TEXTURE_BYTES, unpackGround } from './ground'

// a chunk of a game file: its tag written backwards, its size, its data
const chunk = (tag: string, data: Buffer): Buffer => Buffer.concat([Buffer.from([...tag].reverse().join(''), 'latin1'), Buffer.from(new Uint32Array([data.length]).buffer), data])
const numbers = (...n: number[]): Buffer => Buffer.from(new Uint32Array(n).buffer)

test("a block's layers and mixes are read from its tex0: packed and plain mixes, each piece in its place", () => {
  // first piece: three layers. The second layer's mix is packed: 64 rows of "the next byte 64 times", the row's number.
  // The third layer's is plain: 4096 bytes of 9. Second piece: one layer, no mix.
  const packed = Buffer.concat(Array.from({ length: MIX }, (_, row) => Buffer.from([0x80 | MIX, row])))
  const plain = Buffer.alloc(MIX * MIX, 9)
  const first = chunk('MCNK', Buffer.concat([chunk('MCLY', numbers(1, 0, 0, 0, 0, 0x300, 0, 0, 2, 0x100, packed.length, 0)), chunk('MCAL', Buffer.concat([packed, plain]))]))
  const second = chunk('MCNK', chunk('MCLY', numbers(2, 0, 0, 0)))
  const tex0 = Buffer.concat([chunk('MVER', numbers(18)), chunk('MDID', numbers(100, 200, 300)), first, second])

  expect(groundTextures(tex0)).toEqual([100, 200, 300])
  const g = blockGround(tex0)!
  expect(g.textures).toEqual([100, 200, 300])
  expect([...g.layers.subarray(0, 8)]).toEqual([1, 0, 2, NONE, 2, NONE, NONE, NONE])
  // the first piece is the north-west corner: row 5 of its mixes, any column
  const at = (x: number, y: number): number[] => [...g.mix.subarray((y * MIX_SIDE + x) * 4, (y * MIX_SIDE + x) * 4 + 3)]
  expect(at(0, 5)).toEqual([5, 9, 0])
  expect(at(63, 63)).toEqual([63, 9, 0])
  // the second piece is the next to the east: nothing over its first layer
  expect(at(64, 5)).toEqual([0, 0, 0])

  const again = unpackGround(packGround(g))!
  expect(again.textures).toEqual(g.textures)
  expect([...again.layers]).toEqual([...g.layers])
  expect(again.mix.length).toBe(MIX_SIDE * MIX_SIDE * 4)
  expect([...again.mix.subarray(5 * MIX_SIDE * 4, 5 * MIX_SIDE * 4 + 3)]).toEqual([5, 9, 0])
})

test('a file with no pieces has no ground, and bytes that are not a packed ground unpack to nothing', () => {
  expect(blockGround(chunk('MDID', numbers(1)))).toBeNull()
  expect(unpackGround(new Uint8Array([9, 0]))).toBeNull()
})

test('a mix cut short is left out, not read past its end', () => {
  // packed, but the runs stop after one row
  const tex0 = chunk('MCNK', Buffer.concat([chunk('MCLY', numbers(0, 0, 0, 0, 1, 0x300, 0, 0)), chunk('MCAL', Buffer.from([0x80 | MIX, 7]))]))
  const g = blockGround(Buffer.concat([chunk('MDID', numbers(1, 2)), tex0]))!
  expect([...g.layers.subarray(0, 4)]).toEqual([0, 1, NONE, NONE])
  expect(g.mix.every((v) => v === 0)).toBe(true)
})

test('a pile keeps every level of every texture one after the other', () => {
  expect(pileLevel(3, 0)).toBe(0)
  expect(pileLevel(3, 1)).toBe(3 * 32768)
  expect(pileLevel(1, 9)).toBe(TEXTURE_BYTES)
})
