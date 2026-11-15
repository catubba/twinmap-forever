import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { keysIn, sentKeys } from './keys'

const u32 = (...v: number[]): Buffer => Buffer.concat(v.map((x) => { const b = Buffer.alloc(4); b.writeUInt32LE(x >>> 0); return b }))
const KEY_TABLE = 0xdf2f53cf
/** A row of the game's cache: state 1 is a row with its data, 4 one the server keeps back. */
const row = (table: number, id: number, state: number, data: Buffer): Buffer => Buffer.concat([Buffer.from('XFTH'), u32(93, 0xffffffff, 0xffffffff, table, id, data.length), Buffer.from([state, 0, 0, 0]), data])
const head = Buffer.concat([Buffer.from('XFTH'), u32(9, 70938)])
const key = (fill: number): Buffer => Buffer.alloc(16, fill)

test('the valid keys of a cache are found by their number; the ones kept back are not keys', () => {
  const cache = Buffer.concat([head, row(0x11223344, 8283, 1, key(1)), row(KEY_TABLE, 8283, 1, key(2)), row(KEY_TABLE, 8334, 4, Buffer.alloc(0)), row(KEY_TABLE, 8341, 1, key(3))])
  expect([...keysIn(cache)]).toEqual([[8283, key(2)], [8341, key(3)]])
})

test('a later row replaces an earlier one, and one taken back is gone', () => {
  const cache = Buffer.concat([head, row(KEY_TABLE, 8283, 1, key(2)), row(KEY_TABLE, 8283, 1, key(5)), row(KEY_TABLE, 8341, 1, key(3)), row(KEY_TABLE, 8341, 2, Buffer.alloc(0))])
  expect([...keysIn(cache)]).toEqual([[8283, key(5)]])
})

test('the number of the table found inside other data is not a row', () => {
  const cache = Buffer.concat([head, row(0x11223344, 7, 1, Buffer.concat([u32(KEY_TABLE, 8283, 16, 1), key(9)]))])
  expect(keysIn(cache).size).toBe(0)
})

test('the keys come from the cache of every language; a game with no cache has none', () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-keys-'))
  expect(sentKeys(folder).size).toBe(0)
  for (const [language, id] of [['enUS', 8283], ['frFR', 8341]] as const) {
    mkdirSync(join(folder, '_forever_', 'Cache', 'ADB', language), { recursive: true })
    writeFileSync(join(folder, '_forever_', 'Cache', 'ADB', language, 'DBCache.bin'), Buffer.concat([head, row(KEY_TABLE, id, 1, key(id & 255))]))
  }
  mkdirSync(join(folder, '_forever_', 'Cache', 'ADB', 'deDE')) // a language with no cache yet
  expect([...sentKeys(folder).keys()].sort()).toEqual([8283, 8341])
})
