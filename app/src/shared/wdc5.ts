// Reads a table of the game (a .db2 file in the WDC5 format). The file says by itself how each
// column is stored, so no outside definition is needed: only which column means what, which the
// caller knows. Sections the game keeps encrypted are skipped and counted, never decrypted.
//
// Layout: header, section headers, field sizes, field storage, pallet data, common data, then
// for each section its records, texts, id list, copy table and parent ids.

const HEADER = 204
const SECTION = 40
const STORAGE = 24

export interface Row {
  id: number
  /** The id of the row this one belongs to, in tables that have one (a "relationship"). */
  parent: number | undefined
  /** A whole number: element `at` of column `field`. */
  int(field: number, at?: number): number
  /** A decimal number: element `at` of column `field`. */
  float(field: number, at?: number): number
  /** A text. */
  text(field: number): string
}

export interface Table {
  /** Columns in a row. */
  fields: number
  rows: Row[]
  /** Rows the game keeps encrypted: not read. */
  encryptedRows: number
}

interface Field {
  offset: number // bits from the start of the record
  bits: number // bits in the record, all elements together
  elementBits: number // bits of one element, for a column stored plainly
  kind: number // 0 plain, 1 packed, 2 common, 3 pallet, 4 pallet array, 5 packed and signed
  a: number
  c: number
  block: number // where its pallet or common data starts
  common: Map<number, number> | undefined
}

const float32 = new Float32Array(1), bits32 = new Uint32Array(float32.buffer)

export function readTable(b: Buffer): Table {
  if (b.toString('latin1', 0, 4) !== 'WDC5') throw new Error('not a WDC5 table')
  const u32 = (at: number): number => b.readUInt32LE(at)
  const recordSize = u32(144), flags = b.readUInt16LE(172), idIndex = b.readUInt16LE(174)
  const totalFields = u32(176), storageSize = u32(188), palletSize = u32(196), sectionCount = u32(200)
  if (flags & 1) throw new Error('this table stores its rows at variable sizes: not supported')

  let at = HEADER
  const sections = Array.from({ length: sectionCount }, (_, i) => {
    const p = at + i * SECTION
    return { encrypted: b.readBigUInt64LE(p) !== 0n, offset: u32(p + 8), rows: u32(p + 12), texts: u32(p + 16), ids: u32(p + 24), parents: u32(p + 28), offsetMap: u32(p + 32), copies: u32(p + 36) }
  })
  at += sectionCount * SECTION
  const sizes = Array.from({ length: totalFields }, (_, i) => 32 - b.readInt16LE(at + i * 4))
  at += totalFields * 4
  const fields: Field[] = Array.from({ length: storageSize / STORAGE }, (_, i) => {
    const p = at + i * STORAGE
    return { offset: b.readUInt16LE(p), bits: b.readUInt16LE(p + 2), elementBits: sizes[i] ?? 32, kind: u32(p + 8), a: u32(p + 12), c: u32(p + 20), block: u32(p + 4), common: undefined }
  })
  at += storageSize
  let pallet = at, common = at + palletSize
  for (const f of fields) {
    const size = f.block
    if (f.kind === 3 || f.kind === 4) {
      f.block = pallet
      pallet += size
    } else if (f.kind === 2) {
      f.common = new Map()
      for (let i = 0; i < size; i += 8) f.common.set(u32(common + i), u32(common + i + 4))
      common += size
    }
  }

  // Up to 32 bits from any bit of the file.
  const bitsAt = (byte: number, bit: number, count: number): number => {
    let value = 0n
    for (let i = 7; i >= 0; i--) {
      const p = byte + (bit >> 3) + i
      value = (value << 8n) | BigInt(p < b.length ? b[p]! : 0)
    }
    return Number((value >> BigInt(bit & 7)) & ((1n << BigInt(Math.min(count, 32))) - 1n))
  }

  const allRows = sections.reduce((n, s) => n + s.rows, 0)
  const rows: Row[] = []
  let encryptedRows = 0, rowsBefore = 0, textsBefore = 0
  for (const s of sections) {
    const firstRow = rowsBefore, firstText = textsBefore
    rowsBefore += s.rows
    textsBefore += s.texts
    if (s.encrypted) {
      encryptedRows += s.rows
      continue
    }
    const texts = s.offset + s.rows * recordSize, idList = texts + s.texts
    const copyTable = idList + s.ids, parentsAt = copyTable + s.copies * 8 + s.offsetMap * 6
    const parents = new Map<number, number>()
    if (s.parents) for (let i = 0, n = u32(parentsAt); i < n; i++) parents.set(u32(parentsAt + 12 + i * 8 + 4), u32(parentsAt + 12 + i * 8))

    const made = new Map<number, Row>()
    for (let i = 0; i < s.rows; i++) {
      const record = s.offset + i * recordSize
      const raw = (field: number, k: number, id: number): number => {
        const f = fields[field]
        if (!f) throw new Error(`no column ${field}`)
        if (f.kind === 2) return f.common!.get(id) ?? f.a
        if (f.kind === 3) return u32(f.block + bitsAt(record, f.offset, f.bits) * 4)
        if (f.kind === 4) return u32(f.block + (bitsAt(record, f.offset, f.bits) * f.c + k) * 4)
        if (f.kind === 0) return bitsAt(record, f.offset + k * f.elementBits, f.elementBits)
        const value = bitsAt(record, f.offset, f.bits)
        // Sign of a packed number: its top bit.
        return (f.kind === 5 || f.c & 1) && f.bits < 32 && value >= 2 ** (f.bits - 1) ? value - 2 ** f.bits : value
      }
      const id = s.ids ? u32(idList + i * 4) : raw(idIndex, 0, 0)
      const row: Row = {
        id,
        parent: parents.get(i),
        int: (field, k = 0) => raw(field, k, id) | 0,
        float: (field, k = 0) => {
          bits32[0] = raw(field, k, id)
          return float32[0]!
        },
        // A text is stored as the distance from its own column to its place among the texts, counted
        // as if the rows of every section came first and the texts of every section after them.
        text: (field) => {
          const f = fields[field]
          if (!f) throw new Error(`no column ${field}`)
          const distance = raw(field, 0, id)
          if (!distance) return ''
          const start = texts + ((firstRow + i) * recordSize + (f.offset >> 3) + distance - allRows * recordSize - firstText)
          const end = b.indexOf(0, start)
          return b.toString('utf8', start, end < 0 ? b.length : end)
        },
      }
      rows.push(row)
      made.set(id, row)
    }
    // A copy is a row with another id and the same values.
    for (let i = 0; i < s.copies; i++) {
      const source = made.get(u32(copyTable + i * 8 + 4))
      if (source) rows.push({ ...source, id: u32(copyTable + i * 8) })
    }
  }
  return { fields: fields.length, rows, encryptedRows }
}
