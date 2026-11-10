// The little picture work the tile converter needs, on plain red, green, blue bytes of a square.
import { crc32, deflateSync } from 'node:zlib'

/** A square cut out of a bigger square picture. */
export function crop(rgb: Buffer, from: number, x: number, y: number, size: number): Buffer {
  const out = Buffer.alloc(size * size * 3)
  for (let row = 0; row < size; row++) rgb.copy(out, row * size * 3, ((y + row) * from + x) * 3, ((y + row) * from + x + size) * 3)
  return out
}

/** Half the width and height: each pixel the average of four. */
export function halve(rgb: Buffer, from: number): Buffer {
  const size = from / 2, out = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = (y * 2 * from + x * 2) * 3, b = a + from * 3
      for (let c = 0; c < 3; c++) out[(y * size + x) * 3 + c] = (rgb[a + c]! + rgb[a + 3 + c]! + rgb[b + c]! + rgb[b + 3 + c]! + 2) >> 2
    }
  }
  return out
}

/** Twice the width and height: each pixel four times. */
export function double(rgb: Buffer, from: number): Buffer {
  const size = from * 2, out = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) rgb.copy(out, (y * size + x) * 3, ((y >> 1) * from + (x >> 1)) * 3, ((y >> 1) * from + (x >> 1)) * 3 + 3)
  }
  return out
}

/** Four squares side by side as one of twice the size; a missing one stays black. Order: top left, top right, bottom left, bottom right. */
export function join(parts: (Buffer | undefined)[], size: number): Buffer {
  const out = Buffer.alloc(size * size * 12)
  parts.forEach((part, i) => {
    if (!part) return
    const left = (i & 1) * size, top = (i >> 1) * size
    for (let row = 0; row < size; row++) part.copy(out, ((top + row) * size * 2 + left) * 3, row * size * 3, (row + 1) * size * 3)
  })
  return out
}

/** A PNG file of the picture, no transparency. */
export function encodePng(rgb: Buffer, width: number, height: number): Buffer {
  const raw = Buffer.alloc(height * (width * 3 + 1)) // each row starts with a byte: no filter
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
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
