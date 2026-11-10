import { expect, test } from 'vitest'
import { readTable } from './wdc5'

// A small table built to the layout wdc5.ts reads: two sections, the second "encrypted".
// Columns: 0 text, 1 id, 2 two decimals, 3 a pallet value (4 bits), 4 a packed signed number
// (6 bits), 5 a value kept apart for the rows that differ from the usual one.
const RECORD = 18
const ROWS = [
  { id: 1429, name: 'Elwynn Forest', xy: [-10254.2, 1535.4], pallet: 1, signed: -3, parent: 1415 },
  { id: 1411, name: 'Città di prova', xy: [1808.25, -1962.5], pallet: 0, signed: 31, parent: 1414 },
]
const PALLET = [70000, 123456789]
const COMMON: [number, number][] = [[1411, 77]] // id, value; everyone else has 5
const HIDDEN_ROWS = 1

function fakeTable(): Buffer {
  const allRows = ROWS.length + HIDDEN_ROWS
  const texts = Buffer.concat(ROWS.map((r) => Buffer.from(r.name + '\0')))
  const records = Buffer.alloc(ROWS.length * RECORD)
  let textAt = 0
  ROWS.forEach((r, i) => {
    const at = i * RECORD
    // The distance from this column to the text, as if all rows came first and all texts after.
    records.writeUInt32LE(allRows * RECORD + textAt - (i * RECORD + 0), at)
    textAt += Buffer.byteLength(r.name) + 1
    records.writeUInt32LE(r.id, at + 4)
    records.writeFloatLE(r.xy[0]!, at + 8)
    records.writeFloatLE(r.xy[1]!, at + 12)
    records.writeUInt16LE(r.pallet | ((r.signed & 63) << 4), at + 16)
  })
  const copies = Buffer.alloc(8)
  copies.writeUInt32LE(9999, 0) // a new id
  copies.writeUInt32LE(1429, 4) // with the values of this one
  const parents = Buffer.alloc(12 + ROWS.length * 8)
  parents.writeUInt32LE(ROWS.length, 0)
  ROWS.forEach((r, i) => {
    parents.writeUInt32LE(r.parent, 12 + i * 8)
    parents.writeUInt32LE(i, 12 + i * 8 + 4)
  })

  const fields = [
    { offset: 0, bits: 32, extra: 0, kind: 0, a: 0, c: 0 },
    { offset: 32, bits: 32, extra: 0, kind: 0, a: 0, c: 0 },
    { offset: 64, bits: 64, extra: 0, kind: 0, a: 0, c: 0 },
    { offset: 128, bits: 4, extra: PALLET.length * 4, kind: 3, a: 0, c: 0 },
    { offset: 132, bits: 6, extra: 0, kind: 5, a: 0, c: 0 },
    { offset: 138, bits: 0, extra: COMMON.length * 8, kind: 2, a: 5, c: 0 },
  ]
  const head = Buffer.alloc(204)
  head.write('WDC5', 'latin1')
  head.writeUInt32LE(allRows, 136)
  head.writeUInt32LE(fields.length, 140)
  head.writeUInt32LE(RECORD, 144)
  head.writeUInt16LE(1, 174) // the id is column 1
  head.writeUInt32LE(fields.length, 176)
  head.writeUInt32LE(fields.length * 24, 188)
  head.writeUInt32LE(COMMON.length * 8, 192)
  head.writeUInt32LE(PALLET.length * 4, 196)
  head.writeUInt32LE(2, 200)

  const sizes = Buffer.alloc(fields.length * 4) // all zero: 32 bits an element
  const storage = Buffer.alloc(fields.length * 24)
  fields.forEach((f, i) => {
    storage.writeUInt16LE(f.offset, i * 24)
    storage.writeUInt16LE(f.bits, i * 24 + 2)
    storage.writeUInt32LE(f.extra, i * 24 + 4)
    storage.writeUInt32LE(f.kind, i * 24 + 8)
    storage.writeUInt32LE(f.a, i * 24 + 12)
    storage.writeUInt32LE(f.c, i * 24 + 20)
  })
  const pallet = Buffer.alloc(PALLET.length * 4)
  PALLET.forEach((v, i) => pallet.writeUInt32LE(v, i * 4))
  const common = Buffer.alloc(COMMON.length * 8)
  COMMON.forEach(([id, v], i) => {
    common.writeUInt32LE(id, i * 8)
    common.writeUInt32LE(v, i * 8 + 4)
  })

  const sections = Buffer.alloc(80)
  const first = 204 + 80 + sizes.length + storage.length + pallet.length + common.length
  const body = Buffer.concat([records, texts, copies, parents])
  sections.writeUInt32LE(first, 8)
  sections.writeUInt32LE(ROWS.length, 12)
  sections.writeUInt32LE(texts.length, 16)
  sections.writeUInt32LE(parents.length, 28)
  sections.writeUInt32LE(1, 36) // one copy
  sections.writeBigUInt64LE(0x0da4670db36fb2a9n, 40) // the second section is locked with this key
  sections.writeUInt32LE(first + body.length, 48)
  sections.writeUInt32LE(HIDDEN_ROWS, 52)
  return Buffer.concat([head, sections, sizes, storage, pallet, common, body, Buffer.alloc(HIDDEN_ROWS * RECORD, 0xee)])
}

test('every kind of column reads back: text, whole and decimal numbers, pallet, packed, common', () => {
  const table = readTable(fakeTable())
  expect([table.fields, table.rows.length, table.encryptedRows]).toEqual([6, 3, 1])
  const [elwynn, city] = table.rows
  expect([elwynn!.id, elwynn!.parent, elwynn!.text(0)]).toEqual([1429, 1415, 'Elwynn Forest'])
  expect([city!.id, city!.parent, city!.text(0)]).toEqual([1411, 1414, 'Città di prova'])
  expect([elwynn!.float(2, 0), elwynn!.float(2, 1)].map((v) => +v.toFixed(1))).toEqual([-10254.2, 1535.4])
  expect([city!.float(2, 0), city!.float(2, 1)]).toEqual([1808.25, -1962.5])
  expect([elwynn!.int(3), city!.int(3)]).toEqual([123456789, 70000])
  expect([elwynn!.int(4), city!.int(4)]).toEqual([-3, 31])
  expect([elwynn!.int(5), city!.int(5)]).toEqual([5, 77])
})

test('a copied row has its own id and the values of the row it copies', () => {
  const copy = readTable(fakeTable()).rows[2]!
  expect([copy.id, copy.text(0), copy.int(4)]).toEqual([9999, 'Elwynn Forest', -3])
})

test('what is not a table is refused', () => {
  expect(() => readTable(Buffer.from('BLP2 and so on'))).toThrow(/not a WDC5 table/)
})
