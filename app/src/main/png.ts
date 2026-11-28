// Writes a picture as a PNG file: what the tiles of the lower zoom levels are kept as.
import { crc32, deflateSync } from 'node:zlib'

/**
 * A PNG file of red, green, blue bytes; with channels 4 each pixel has its transparency after them, with channels 1 it is
 * one grey byte. filter: each row kept as it is (0), as its difference from the row above (2, "up"), or from the guess of
 * the pixels left, above and above left (4, "Paeth"). level: how hard deflate works, 1 to 9.
 */
export function encodePng(rgb: Uint8Array, width: number, height: number, channels: 1 | 3 | 4 = 3, filter: 0 | 2 | 4 = channels === 1 ? 2 : 0, level = 6): Buffer {
  const raw = Buffer.alloc(height * (width * channels + 1)) // each row starts with a byte: its filter
  const row = width * channels
  for (let y = 0; y < height; y++) {
    const at = y * (row + 1), here = y * row, above = here - row
    if (!filter || !y) raw.set(rgb.subarray(here, here + row), at + 1)
    else if (filter === 2) {
      // A grey picture (the relief) changes little from one row to the next: kept as the difference
      // from the row above ("up" filter), it takes half the room; a minimap, a fifth less.
      raw[at] = 2
      for (let x = 0; x < row; x++) raw[at + 1 + x] = (rgb[here + x]! - rgb[above + x]!) & 255
    } else {
      // The parchment, a painting: a twentieth smaller than with "up", and deflate does it faster.
      raw[at] = 4
      for (let x = 0; x < row; x++) {
        const b = rgb[above + x]!
        let guess = b
        if (x >= channels) {
          const a = rgb[here + x - channels]!, c = rgb[above + x - channels]!, pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
          guess = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        }
        raw[at + 1 + x] = (rgb[here + x]! - guess) & 255
      }
    }
  }
  const chunk = (tag: string, data: Buffer): Buffer => {
    const b = Buffer.alloc(12 + data.length)
    b.writeUInt32BE(data.length)
    b.write(tag, 4, 'latin1')
    data.copy(b, 8)
    b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length)
    return b
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(width)
  head.writeUInt32BE(height, 4)
  head[8] = 8 // bits a channel
  head[9] = channels === 4 ? 6 : channels === 3 ? 2 : 0 // red, green, blue, and transparency or not; or grey
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level })), chunk('IEND', Buffer.alloc(0))])
}
