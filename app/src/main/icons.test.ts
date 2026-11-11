import { join } from 'node:path'
import { expect, test } from 'vitest'
import { decodeBlpCutout } from '../shared/blp'
import { withoutGround, withoutPointer } from './icons'
import { servedFile } from './tiles'

const alphaAt = (c: { width: number; rgba: Uint8Array }, x: number, y: number): number => c.rgba[(y * c.width + x) * 4 + 3]!

test('a cursor loses its pointer and keeps its picture', () => {
  const cursor = withoutPointer({ width: 32, height: 32, rgba: new Uint8Array(32 * 32 * 4).fill(255) })
  expect(alphaAt(cursor, 0, 0)).toBe(0)
  expect(alphaAt(cursor, 11, 0)).toBe(0)
  expect(alphaAt(cursor, 6, 6)).toBe(255)
  expect(alphaAt(cursor, 20, 20)).toBe(255)
})

test('the thing in the picture of an item is cut from its frame and its ground', () => {
  // A grey frame, a black ground, an orange stone in the middle with a dark spot inside it.
  const rgba = new Uint8Array(64 * 64 * 4)
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const frame = x < 5 || y < 5 || x > 58 || y > 58, stone = x >= 20 && x < 44 && y >= 20 && y < 44, spot = x >= 30 && x < 34 && y >= 30 && y < 34
    rgba.set(frame ? [120, 120, 120, 255] : spot ? [10, 10, 10, 255] : stone ? [230, 140, 30, 255] : [0, 0, 0, 255], (y * 64 + x) * 4)
  }
  const cut = withoutGround({ width: 64, height: 64, rgba })
  expect([cut.width, cut.height]).toEqual([32, 32])
  expect(alphaAt(cut, 1, 1)).toBe(0) // the frame
  expect(alphaAt(cut, 7, 7)).toBe(0) // the ground
  expect([...cut.rgba.subarray((12 * 32 + 12) * 4, (12 * 32 + 12) * 4 + 4)]).toEqual([230, 140, 30, 255]) // the stone
  expect([...cut.rgba.subarray((16 * 32 + 16) * 4, (16 * 32 + 16) * 4 + 4)]).toEqual([10, 10, 10, 255]) // its dark spot stays
  expect([...cut.rgba.subarray((12 * 32 + 9) * 4, (12 * 32 + 9) * 4 + 4)]).toEqual([0, 0, 0, 255]) // the black line around it
})

test('a picture stored in DXT5 blocks is read with its transparency', () => {
  const f = Buffer.alloc(148 + 1024 + 16)
  f.write('BLP2', 'latin1')
  f[8] = 2
  f[9] = 8
  f[10] = 7
  f.writeUInt32LE(4, 12)
  f.writeUInt32LE(4, 16)
  f.writeUInt32LE(148 + 1024, 20)
  // One block: transparency 255 and 0 with the first pixel on the second level; all pixels pure red.
  const block = 148 + 1024
  f[block] = 255
  f[block + 1] = 0
  f[block + 2] = 1
  f.writeUInt16LE(0xf800, block + 8)
  f.writeUInt16LE(0x0000, block + 10)
  const { rgba } = decodeBlpCutout(f)
  expect([...rgba.subarray(0, 8)]).toEqual([255, 0, 0, 0, 255, 0, 0, 255])
})

test('the window is given the icons, and nothing beside them', () => {
  const base = join('C:', 'data', 'tiles', 'abc')
  expect(servedFile(base, '/icons/ore-dark-iron.png')).toBe(join(base, 'icons', 'ore-dark-iron.png'))
  for (const path of ['/icons/../maps.png', '/icons/a/b.png', '/icons/Flight.png', '/icons/flight.json']) expect(servedFile(base, path), path).toBeNull()
})
