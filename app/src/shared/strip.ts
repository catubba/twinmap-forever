// Reads a row of pixels back into the block the addon drew on it. The format is in the addon's
// Strip.lua: [0xC7 0x1B] [protocol] [id hi, lo] [len hi, lo] [payload] [fletcher s1, s2], packed
// MSB-first into 3-bit cells, one cell per pixel (red, green, blue each on or off). On and off
// are the two levels found on the row itself: the addon may draw them close together.
// Payload: section US version US part US total US chunk of JSON.

/** The strip protocol this app speaks. The same number as PROTOCOL in the addon. */
export const PROTOCOL = 1

export interface Block {
  kind: 'block'
  /** Running number of the block: a hole means a block nobody saw. */
  id: number
  /** Drawn in negative: the second showing of the same block. */
  negative: boolean
  section: string
  /** Changes every time the section is sent again. */
  version: number
  part: number
  total: number
  text: string
}

export type Reading =
  | Block
  /** No strip on this row. */
  | { kind: 'none' }
  /** A strip that did not survive: caught halfway through a redraw, or covered. */
  | { kind: 'corrupt' }
  /** A strip of a protocol this app does not speak. Its contents are not read. */
  | { kind: 'protocol'; protocol: number }

const HEADER = 7 // bytes before the payload
const US = '\x1f'
const utf8 = new TextDecoder('utf-8', { fatal: true })

/**
 * Decodes one row of pixels, 4 bytes per pixel in the order blue, green, red, unused, as
 * readRow gives it. What lies past the end of the block is never read.
 */
export function decodeRow(row: Uint8Array): Reading {
  const cells = row.length >> 2
  const capacity = Math.floor((cells * 3) / 8)
  if (capacity < HEADER + 2) return { kind: 'none' }

  // A strip fills its row with two levels only, so a channel is on above the middle of the darkest
  // and the brightest value there. On a row with no strip this is noise, and the magic bytes say so.
  let lo = 255, hi = 0
  for (let p = 0; p < row.length; p += 4) {
    for (let c = 0; c < 3; c++) {
      const value = row[p + c]!
      if (value < lo) lo = value
      if (value > hi) hi = value
    }
  }
  const middle = (lo + hi) / 2

  // The bytes of the row, from the first up to (not including) end, read as drawn or in negative.
  const read = (end: number, negative: boolean): number[] => {
    const bytes: number[] = []
    let acc = 0, nbits = 0
    for (let i = 0; bytes.length < end; i++) {
      const p = i * 4
      let v = (row[p + 2]! > middle ? 4 : 0) | (row[p + 1]! > middle ? 2 : 0) | (row[p]! > middle ? 1 : 0)
      if (negative) v = 7 - v
      acc = (acc << 3) | v
      nbits += 3
      if (nbits >= 8) {
        nbits -= 8
        bytes.push((acc >> nbits) & 0xff)
        acc &= (1 << nbits) - 1
      }
    }
    return bytes
  }

  let negative = false
  let head = read(HEADER, false)
  if (head[0] === 0x38 && head[1] === 0xe4) {
    negative = true
    head = read(HEADER, true)
  } else if (head[0] !== 0xc7 || head[1] !== 0x1b) {
    return { kind: 'none' }
  }
  const protocol = head[2]!
  if (protocol !== PROTOCOL) return { kind: 'protocol', protocol }

  const end = HEADER + ((head[5]! << 8) | head[6]!)
  if (end + 2 > capacity) return { kind: 'corrupt' }
  const bytes = read(end + 2, negative)
  let s1 = 0, s2 = 0
  for (let i = 2; i < end; i++) {
    s1 = (s1 + bytes[i]!) % 255
    s2 = (s2 + s1) % 255
  }
  if (bytes[end] !== s1 || bytes[end + 1] !== s2) return { kind: 'corrupt' }

  let payload: string
  try {
    payload = utf8.decode(Uint8Array.from(bytes.slice(HEADER, end)))
  } catch {
    return { kind: 'corrupt' }
  }
  const [section, version, part, total, ...text] = payload.split(US)
  const numbers = [version, part, total].map(Number)
  if (!section || !/^[a-z_]+$/.test(section) || text.length === 0 || !numbers.every((n) => Number.isInteger(n) && n > 0)) {
    return { kind: 'corrupt' }
  }
  return {
    kind: 'block',
    id: (head[3]! << 8) | head[4]!,
    negative,
    section,
    version: numbers[0]!,
    part: numbers[1]!,
    total: numbers[2]!,
    text: text.join(US),
  }
}

// A game that runs full screen at a size smaller than its monitor is stretched to fill it: the
// strip it drew, one cell a pixel, comes out wider, each cell blended with its neighbours. The
// window keeps the size of the monitor, so nothing but the row itself tells how wide the game
// drew. These are the widths a game is set to, tried in turn when the row as it is holds no strip.
const WIDTHS = [3840, 3440, 3200, 2880, 2560, 2048, 1920, 1768, 1680, 1600, 1440, 1400, 1366, 1360, 1280, 1152, 1024, 800]

/** The row as the game drew it, cells pixels wide: for each cell, the pixel of the stretched row that holds most of it. */
function unstretched(row: Uint8Array, cells: number): Uint8Array {
  const wide = row.length >> 2, out = new Uint8Array(cells * 4)
  for (let i = 0; i < cells; i++) {
    const x = Math.min(wide - 1, Math.round(((i + 0.5) * wide) / cells - 0.5))
    out.set(row.subarray(x * 4, x * 4 + 4), i * 4)
  }
  return out
}

/**
 * Decodes a row that may be a stretched strip. drew: how wide the game drew the last strip read,
 * tried first. Gives the reading, and how wide the game drew when a block was read. Only a whole
 * block, with its checksum, tells the width: at a width close to the true one the first bytes
 * still read. What is no block at any width is what the row reads as it is.
 */
export function readStrip(row: Uint8Array, drew?: number): { reading: Reading; drew?: number } {
  const wide = row.length >> 2
  for (const cells of [drew ?? wide, wide, ...WIDTHS]) {
    if (cells > wide || cells < 1) continue
    const reading = decodeRow(cells === wide ? row : unstretched(row, cells))
    if (reading.kind === 'block') return { reading, drew: cells }
  }
  return { reading: decodeRow(row) }
}
