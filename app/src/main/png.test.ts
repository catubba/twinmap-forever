import { inflateSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { encodePng } from './png'

/** The pixels of a PNG of one IDAT, read back through each row's filter as the PNG standard tells. */
function decoded(png: Buffer, channels: number): Uint8Array {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), size = png.readUInt32BE(33)
  const raw = inflateSync(png.subarray(41, 41 + size)), row = width * channels, out = new Uint8Array(row * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < row; x++) {
      const a = x >= channels ? out[y * row + x - channels]! : 0, b = y ? out[(y - 1) * row + x]! : 0, c = x >= channels && y ? out[(y - 1) * row + x - channels]! : 0
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const guess = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][raw[y * (row + 1)]!]!
      out[y * row + x] = (raw[y * (row + 1) + 1 + x]! + guess) & 255
    }
  return out
}

test('a picture comes back the same through each filter', () => {
  const rgb = new Uint8Array(37 * 23 * 3).map((_, i) => (i * 7919) % 251 ^ (i >> 5))
  for (const filter of [0, 2, 4] as const) expect(decoded(encodePng(rgb, 37, 23, 3, filter, 4), 3), `filter ${filter}`).toEqual(rgb)
})
