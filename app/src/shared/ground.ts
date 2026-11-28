// The ground's own textures, as the game keeps them (M23-F8): up close they take the place of the minimap picture,
// which is about a yard a pixel. A block's "tex0" file (the fourth of its eight in the continent's "MAID") lists the
// textures of the block ("MDID") and, for each of its 16 x 16 pieces ("MCNK", row after row from the north-west),
// up to four layers ("MCLY": which texture, flags, where its mix starts) and how much of each layer but the first
// shows at each of 64 x 64 points ("MCAL", a byte a point, packed in runs where the layer says so). The game draws a
// piece as the first layer times what the others leave, plus each other layer times its own mix, every texture laid
// 8 times across a piece.
//
// Works on any bytes, also outside Node: the window unpacks what the app made with this.

/** Pieces a side of a block. */
export const PIECES = 16
/** Points a side of a piece's mix. */
export const MIX = 64
/** Points a side of a block's mixes laid together. */
export const MIX_SIDE = PIECES * MIX
/** Times a texture is laid across a piece. */
export const REPEATS = 8
/** A layer a piece does not have. */
export const NONE = 255
/** Pixels a side of every ground texture as the app keeps it, and its smaller copies down to one pixel. */
export const TEXTURE = 256
export const LEVELS = 9
/** The bytes of one texture's copy at a level: DXT1, 8 bytes a block of 4 x 4 pixels. */
export const levelBytes = (level: number): number => Math.max(1, TEXTURE >> level >> 2) ** 2 * 8
/** The bytes of one texture with all its copies. */
export const TEXTURE_BYTES = Array.from({ length: LEVELS }, (_, l) => levelBytes(l)).reduce((a, b) => a + b, 0)
/** The layout of the files below: change it when they are made otherwise. */
export const GROUND_FORMAT = 1

export interface BlockGround {
  /** The files of the block's textures: a layer names one by its place here. */
  textures: number[]
  /** Four layers a piece, the place of each one's texture in textures, NONE where the piece has fewer. */
  layers: Uint8Array
  /** MIX_SIDE x MIX_SIDE points of four bytes: how much of the second, third and fourth layer shows; the fourth byte unused. */
  mix: Uint8Array
}

// A file of chunks: a four letter tag written backwards, a size, the data.
function* chunks(b: Uint8Array, view: DataView, from: number, to: number): Generator<{ tag: string; at: number; size: number }> {
  for (let at = from; at + 8 <= to; ) {
    const size = view.getUint32(at + 4, true)
    yield { tag: String.fromCharCode(b[at + 3]!, b[at + 2]!, b[at + 1]!, b[at]!), at: at + 8, size }
    at += 8 + size
  }
}

/** The files of the textures a block's tex0 lists. */
export function groundTextures(tex0: Uint8Array): number[] {
  const view = new DataView(tex0.buffer, tex0.byteOffset, tex0.byteLength)
  for (const c of chunks(tex0, view, 0, tex0.length)) if (c.tag === 'MDID') return Array.from({ length: c.size >> 2 }, (_, i) => view.getUint32(c.at + i * 4, true))
  return []
}

// One layer's mix, MIX x MIX bytes: as it is, or packed in runs (a byte: the top bit says "the next byte, this many times", else "this many bytes as they are").
function mixOf(b: Uint8Array, from: number, to: number, packed: boolean): Uint8Array | null {
  const size = MIX * MIX
  if (!packed) return from + size <= to ? b.subarray(from, from + size) : null
  const out = new Uint8Array(size)
  for (let o = 0, p = from; o < size; ) {
    if (p >= to) return null
    const head = b[p++]!, count = Math.min(head & 127, size - o)
    if (head & 128) out.fill(b[p++] ?? 0, o, o + count)
    else {
      out.set(b.subarray(p, Math.min(to, p + count)), o)
      p += head & 127
    }
    o += count
  }
  return out
}

/** The layers and mixes of a block from its tex0 file; null when it has no pieces. A piece's layers past the fourth are left out. */
export function blockGround(tex0: Uint8Array): BlockGround | null {
  const view = new DataView(tex0.buffer, tex0.byteOffset, tex0.byteLength)
  const layers = new Uint8Array(PIECES * PIECES * 4).fill(NONE), mix = new Uint8Array(MIX_SIDE * MIX_SIDE * 4)
  let textures: number[] = [], piece = 0
  for (const c of chunks(tex0, view, 0, tex0.length)) {
    if (c.tag === 'MDID') textures = Array.from({ length: c.size >> 2 }, (_, i) => view.getUint32(c.at + i * 4, true))
    if (c.tag !== 'MCNK' || piece >= PIECES * PIECES) continue
    let ly: { at: number; size: number } | undefined, al: { at: number; size: number } | undefined
    for (const i of chunks(tex0, view, c.at, c.at + c.size)) {
      if (i.tag === 'MCLY') ly = i
      if (i.tag === 'MCAL') al = i
    }
    const count = ly ? Math.min(4, ly.size >> 4) : 0, px = (piece % PIECES) * MIX, py = Math.floor(piece / PIECES) * MIX
    for (let k = 0; k < count; k++) {
      const at = ly!.at + k * 16, texture = view.getUint32(at, true), flags = view.getUint32(at + 4, true)
      layers[piece * 4 + k] = texture < NONE ? texture : NONE
      if (!k || !(flags & 0x100) || !al) continue
      const m = mixOf(tex0, al.at + view.getUint32(at + 8, true), al.at + al.size, !!(flags & 0x200))
      if (!m) continue
      for (let y = 0; y < MIX; y++) for (let x = 0; x < MIX; x++) mix[((py + y) * MIX_SIDE + px + x) * 4 + k - 1] = m[y * MIX + x]!
    }
    piece++
  }
  return piece ? { textures, layers, mix } : null
}

/** A block's ground as one run of bytes: the format, how many textures, their files, the layers, the mixes. */
export function packGround(g: BlockGround): Uint8Array {
  const out = new Uint8Array(2 + g.textures.length * 4 + g.layers.length + g.mix.length), view = new DataView(out.buffer)
  out[0] = GROUND_FORMAT
  out[1] = g.textures.length
  g.textures.forEach((t, i) => view.setUint32(2 + i * 4, t, true))
  out.set(g.layers, 2 + g.textures.length * 4)
  out.set(g.mix, 2 + g.textures.length * 4 + g.layers.length)
  return out
}

export function unpackGround(b: Uint8Array): BlockGround | null {
  const count = b[1] ?? 0, at = 2 + count * 4, layers = PIECES * PIECES * 4
  if (b[0] !== GROUND_FORMAT || b.length !== at + layers + MIX_SIDE * MIX_SIDE * 4) return null
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  return { textures: Array.from({ length: count }, (_, i) => view.getUint32(2 + i * 4, true)), layers: b.subarray(at, at + layers), mix: b.subarray(at + layers) }
}

/** Where a level starts in a pile of count textures kept level by level, each level's textures one after the other. */
export const pileLevel = (count: number, level: number): number => Array.from({ length: level }, (_, l) => levelBytes(l)).reduce((a, b) => a + b, 0) * count
