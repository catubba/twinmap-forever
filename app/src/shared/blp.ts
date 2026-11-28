// Decodes a picture of the game (a .blp file, version 2) to plain red, green, blue bytes.
// Two ways of storing are read, the two the minimap tiles use: a 256 color pallet, and DXT blocks
// (4 x 4 pixels from two 16 bit colors and a 2 bit choice per pixel). Only the full size picture.

export interface Image {
  width: number
  height: number
  /** Three bytes a pixel, rows from the top. */
  rgb: Buffer
}

const PALLET = 148 // where the 256 pallet colors start: blue, green, red, alpha

/**
 * The pixels of DXT blocks, three bytes each. alpha: 0 for DXT1, whose blocks are 8 bytes of color;
 * 8 for DXT3 and DXT5, which put 8 bytes of transparency before them. Works on any bytes, also
 * outside Node: the window decodes the stored blocks of the map with this.
 */
export function decodeDxt(data: Uint8Array, width: number, height: number, alpha = 0): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const rgb = new Uint8Array(width * height * 3)
  const color = (c: number): number[] => [(((c >> 11) & 31) * 255) / 31, (((c >> 5) & 63) * 255) / 63, ((c & 31) * 255) / 31]
  for (let by = 0, p = 0; by < height; by += 4) {
    for (let bx = 0; bx < width; bx += 4, p += 8 + alpha) {
      const q = p + alpha, c0 = view.getUint16(q, true), c1 = view.getUint16(q + 2, true), a = color(c0), b = color(c1)
      const choice = view.getUint32(q + 4, true)
      // Four colors: the two given and two between them. DXT1 with c0 <= c1 has one between, and black.
      const four = c0 > c1 || alpha
        ? [a, b, a.map((x, i) => (2 * x + b[i]!) / 3), a.map((x, i) => (x + 2 * b[i]!) / 3)]
        : [a, b, a.map((x, i) => (x + b[i]!) / 2), [0, 0, 0]]
      for (let i = 0; i < 16; i++) {
        const x = bx + (i & 3), y = by + (i >> 2)
        if (x >= width || y >= height) continue
        const c = four[(choice >>> (i * 2)) & 3]!
        rgb[(y * width + x) * 3] = c[0]!
        rgb[(y * width + x) * 3 + 1] = c[1]!
        rgb[(y * width + x) * 3 + 2] = c[2]!
      }
    }
  }
  return rgb
}

/** The DXT1 blocks of a picture stored that way, as the game has them; null for any other picture. */
export function dxt1Picture(f: Buffer): { width: number; height: number; data: Buffer } | null {
  if (f.toString('latin1', 0, 4) !== 'BLP2' || f[8] !== 2 || f[10] !== 0) return null
  const width = f.readUInt32LE(12), height = f.readUInt32LE(16), at = f.readUInt32LE(20)
  if (width % 4 || height % 4 || at + (width * height) / 2 > f.length) return null
  return { width, height, data: f.subarray(at, at + (width * height) / 2) }
}

/** The same for a square picture, as the minimap of the ground is; null for any other. */
export function dxt1Of(f: Buffer): { size: number; data: Buffer } | null {
  const picture = dxt1Picture(f)
  return picture && picture.width === picture.height ? { size: picture.width, data: picture.data } : null
}

export function decodeBlp(f: Buffer): Image {
  if (f.toString('latin1', 0, 4) !== 'BLP2') throw new Error('not a BLP2 picture')
  const encoding = f[8]!, alphaEncoding = f[10]!
  const width = f.readUInt32LE(12), height = f.readUInt32LE(16), data = f.readUInt32LE(20)
  if (encoding === 1) {
    const rgb = Buffer.alloc(width * height * 3)
    for (let i = 0; i < width * height; i++) {
      const p = PALLET + f[data + i]! * 4
      rgb[i * 3] = f[p + 2]!
      rgb[i * 3 + 1] = f[p + 1]!
      rgb[i * 3 + 2] = f[p]!
    }
    return { width, height, rgb }
  }
  if (encoding !== 2) throw new Error(`BLP stored in a way not read here (${encoding})`)
  const rgb = decodeDxt(f.subarray(data), width, height, alphaEncoding === 0 ? 0 : 8)
  return { width, height, rgb: Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength) }
}

/** A picture with its transparency: four bytes a pixel (red, green, blue, alpha), rows from the top. */
export interface Cutout {
  width: number
  height: number
  rgba: Uint8Array
}

/**
 * A picture of the game with its transparency, as icons and cursors need: the pallet, DXT1, DXT3
 * and DXT5 blocks, and plain blue, green, red, alpha bytes.
 */
export function decodeBlpCutout(f: Buffer): Cutout {
  if (f.toString('latin1', 0, 4) !== 'BLP2') throw new Error('not a BLP2 picture')
  const encoding = f[8]!, alphaBits = f[9]!, alphaKind = f[10]!
  const width = f.readUInt32LE(12), height = f.readUInt32LE(16), at = f.readUInt32LE(20), pixels = width * height
  const rgba = new Uint8Array(pixels * 4).fill(255)
  if (encoding === 3) {
    for (let i = 0; i < pixels; i++) rgba.set([f[at + i * 4 + 2]!, f[at + i * 4 + 1]!, f[at + i * 4]!, f[at + i * 4 + 3]!], i * 4)
    return { width, height, rgba }
  }
  const { rgb } = decodeBlp(f)
  for (let i = 0; i < pixels; i++) (rgba[i * 4] = rgb[i * 3]!), (rgba[i * 4 + 1] = rgb[i * 3 + 1]!), (rgba[i * 4 + 2] = rgb[i * 3 + 2]!)
  if (encoding === 1) {
    // After the pallet choices: a byte, a bit, or nothing a pixel.
    for (let i = 0; i < pixels && alphaBits; i++) rgba[i * 4 + 3] = alphaBits === 8 ? f[at + pixels + i]! : alphaBits === 1 ? ((f[at + pixels + (i >> 3)]! >> (i & 7)) & 1) * 255 : 255
    return { width, height, rgba }
  }
  dxtAlpha(f.subarray(at), width, height, alphaKind, alphaBits > 0, rgba)
  return { width, height, rgba }
}

/**
 * The pixels of DXT blocks with their transparency, four bytes each, as the window needs them where the graphics card
 * does not read DXT (a phone): kind as BLP says it (0 DXT1, 1 DXT3, 7 DXT5); holes: a DXT1 that has see-through pixels.
 */
export function decodeDxtCutout(data: Uint8Array, width: number, height: number, kind: number, holes: boolean): Uint8Array {
  const rgb = decodeDxt(data, width, height, kind === 0 ? 0 : 8), rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) rgba.set([rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!, 255], i * 4)
  dxtAlpha(data, width, height, kind, holes, rgba)
  return rgba
}

// The transparency of DXT blocks, laid into the fourth byte of each pixel of rgba.
function dxtAlpha(d: Uint8Array, width: number, height: number, alphaKind: number, holes: boolean, rgba: Uint8Array): void {
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength)
  const step = alphaKind === 0 ? 8 : 16
  const alpha = new Array<number>(16), levels = new Array<number>(8)
  for (let by = 0, p = 0; by < height; by += 4) {
    for (let bx = 0; bx < width; bx += 4, p += step) {
      if (p + step > d.length) return
      alpha.fill(255)
      if (alphaKind === 0) {
        // DXT1: with the first color not above the second, the fourth choice is a hole.
        const cut = holes && view.getUint16(p, true) <= view.getUint16(p + 2, true), choice = view.getUint32(p + 4, true)
        for (let i = 0; i < 16 && cut; i++) if (((choice >>> (i * 2)) & 3) === 3) alpha[i] = 0
      } else if (alphaKind === 1) {
        // DXT3: four bits a pixel.
        for (let i = 0; i < 16; i++) alpha[i] = ((d[p + (i >> 1)]! >> ((i & 1) * 4)) & 15) * 17
      } else {
        // DXT5: two levels, and three bits a pixel choosing among them and the steps between.
        const a0 = d[p]!, a1 = d[p + 1]!
        levels[0] = a0
        levels[1] = a1
        for (let i = 1; i <= 6; i++) levels[i + 1] = a0 > a1 ? Math.round(((7 - i) * a0 + i * a1) / 7) : i <= 4 ? Math.round(((5 - i) * a0 + i * a1) / 5) : i === 5 ? 0 : 255
        // 48 bits, read as two halves of 24 (eight pixels each).
        const low = d[p + 2]! | (d[p + 3]! << 8) | (d[p + 4]! << 16), high = d[p + 5]! | (d[p + 6]! << 8) | (d[p + 7]! << 16)
        for (let i = 0; i < 8; i++) (alpha[i] = levels[(low >> (i * 3)) & 7]!), (alpha[i + 8] = levels[(high >> (i * 3)) & 7]!)
      }
      for (let i = 0; i < 16; i++) {
        const x = bx + (i & 3), y = by + (i >> 2)
        if (x < width && y < height) rgba[(y * width + x) * 4 + 3] = alpha[i]!
      }
    }
  }
}
