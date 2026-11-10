// Reads a row of pixels back into the block the addon drew on it. The format is in the addon's
// Strip.lua: [0xC7 0x1B] [protocol] [id hi, lo] [len hi, lo] [payload] [fletcher s1, s2], packed
// MSB-first into 3-bit cells, one cell per pixel (red, green, blue each on or off).
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

  // The bytes of the row, from the first up to (not including) end, read as drawn or in negative.
  const read = (end: number, negative: boolean): number[] => {
    const bytes: number[] = []
    let acc = 0, nbits = 0
    for (let i = 0; bytes.length < end; i++) {
      const p = i * 4
      let v = (row[p + 2]! >= 128 ? 4 : 0) | (row[p + 1]! >= 128 ? 2 : 0) | (row[p]! >= 128 ? 1 : 0)
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
