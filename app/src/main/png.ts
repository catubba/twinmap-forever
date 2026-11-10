// Writes a picture as a PNG file: what the tiles of the lower zoom levels are kept as.
import { crc32, deflateSync } from 'node:zlib'

/** A PNG file of red, green, blue bytes, no transparency. */
export function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  const raw = Buffer.alloc(height * (width * 3 + 1)) // each row starts with a byte: no filter
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1)
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
  head[9] = 2 // red, green, blue
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
