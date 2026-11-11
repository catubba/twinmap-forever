import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { cbor, NPC, OBJECT, openQuestie, QUEST } from './questie'

// Writes a value the way QuestieDB does: CBOR, then base64. Only what these tests need.
function enc(v: unknown): Buffer {
  const head = (major: number, n: number): Buffer => (n < 24 ? Buffer.from([(major << 5) | n]) : n < 256 ? Buffer.from([(major << 5) | 24, n]) : Buffer.from([(major << 5) | 25, n >> 8, n & 255]))
  if (v === null) return Buffer.from([0xf6])
  if (typeof v === 'boolean') return Buffer.from([v ? 0xf5 : 0xf4])
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v >= 0 ? head(0, v) : head(1, -1 - v)
    const b = Buffer.alloc(9)
    b[0] = 0xfb
    b.writeDoubleBE(v, 1)
    return b
  }
  if (typeof v === 'string') return Buffer.concat([head(3, Buffer.byteLength(v)), Buffer.from(v)])
  if (Array.isArray(v)) return Buffer.concat([head(4, v.length), ...v.map(enc)])
  const entries = Object.entries(v as object)
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([k, x]) => [enc(+k), enc(x)])])
}
const b64 = (v: unknown): string => enc(v).toString('base64')

// A game folder with a QuestieDB of two quests, three NPCs and an object, all invented.
function game(lines: string[]): string {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-questie-'))
  const db = join(folder, '_forever_', 'Interface', 'AddOns', 'QuestieDB')
  mkdirSync(db, { recursive: true })
  writeFileSync(join(db, 'QuestieDB_Forever.toc'), ['## Interface: 16001', '## Version: 1.2.3', ...lines, 'src\\config.lua'].join('\r\n'))
  return folder
}
const long = b64({ 12: Array.from({ length: 40 }, (_, i) => [10.5 + i, 20.25]) })
const LINES = [
  `## X-Quest-7-S: ${b64({ [QUEST.name]: 'A Parcel for the Miller', [QUEST.level]: 12, [QUEST.reqLevel]: 9 })}`,
  `## X-Quest-7-${QUEST.startedBy}: ${b64([[101]])}`,
  `## X-Quest-7-${QUEST.finishedBy}: ${b64([[102], [900]])}`,
  `## X-Quest-8-S: ${b64({ [QUEST.name]: 'Rats in the Cellar', [QUEST.level]: 3 })}`,
  // An NPC standing in two zones; one place is inside an instance, which QuestieDB writes as -1.
  `## X-Npc-101-S: ${b64({ [NPC.name]: 'Miller Odo', [NPC.friendly]: 'A', [NPC.flags]: 4 })}`,
  `## X-Npc-101-${NPC.spawns}: ${b64({ 12: [[42.5, 65.25], [-1, -1]], 40: [[10, 20]] })}`,
  // A long value, cut in two pieces.
  `## X-Npc-102-S: ${b64({ [NPC.name]: 'Cellar Rat' })}`,
  `## X-Npc-102-${NPC.spawns}: ~2~`,
  `## X-Npc-102-${NPC.spawns}-1: ${long.slice(0, 200)}`,
  `## X-Npc-102-${NPC.spawns}-2: ${long.slice(200)}`,
  // A patrol: no spawn, only the path it walks.
  `## X-Npc-103-S: ${b64({ [NPC.name]: 'Road Warden' })}`,
  `## X-Npc-103-${NPC.waypoints}: ${b64({ 40: [[[33.5, 44.5], [34, 45]]] })}`,
  `## X-Object-900-S: ${b64({ [OBJECT.name]: 'Mill Notice Board' })}`,
  `## X-Object-900-${OBJECT.spawns}: ${b64({ 12: [[50, 50]] })}`,
  `## X-Item-55-2: ${b64([102])}`,
]

test('values come back as QuestieDB wrote them', () => {
  const value = { 1: 'Zoë', 2: [1, 23, 24, 300, -5], 3: [42.5, null, true, false], 4: { 7: [[1.25, 2]] } }
  expect(cbor(enc(value))).toEqual(value)
  expect(cbor(Buffer.from('gYEZAzc=', 'base64'))).toEqual([[823]])
  expect(cbor(Buffer.from([0xf9, 0x3e, 0x00]))).toBe(1.5) // a half-size float
  expect(() => cbor(Buffer.from([0x82, 0x01]))).toThrow()
})

test('with QuestieDB in the game folder, quests, NPCs and objects are read with their places', () => {
  const db = openQuestie(game(LINES))!
  expect(db.version).toBe('1.2.3')
  expect(db.ids).toEqual({ Quest: [7, 8], Npc: [101, 102, 103], Object: [900] })
  // A scalar from the row of scalars, a table from its own line, a field that is not there.
  expect(db.get('Quest', 7, QUEST.name)).toBe('A Parcel for the Miller')
  expect(db.get('Quest', 7, QUEST.finishedBy)).toEqual([[102], [900]])
  expect(db.get('Quest', 8, QUEST.startedBy)).toBeUndefined()
  expect(db.get('Item', 55, 2)).toEqual([102])

  expect(db.places('Npc', 101)).toEqual({ 12: [[42.5, 65.25]], 40: [[10, 20]] })
  expect(db.places('Npc', 102)[12]).toHaveLength(40)
  expect(db.places('Npc', 103)).toEqual({ 40: [[33.5, 44.5]] })
  expect(db.places('Object', 900)).toEqual({ 12: [[50, 50]] })
  expect(db.zoneIndex.Npc.get('12')).toEqual([101, 102])
  expect(db.zoneIndex.Npc.get('40')).toEqual([101, 103])
  expect(db.zoneIndex.Object.get('12')).toEqual([900])
})

test('without QuestieDB there is nothing to read, and that is not a fault', () => {
  expect(openQuestie(mkdtempSync(join(tmpdir(), 'twinmap-no-questie-')))).toBeNull()
  expect(openQuestie(game(['## X-Mode: baked'])), 'a QuestieDB with no quests in it').toBeNull()
})

test('a value that cannot be read is a value that is not there', () => {
  const db = openQuestie(game([...LINES, '## X-Npc-104-S: !!!not base64 cbor', `## X-Npc-104-${NPC.spawns}: /w==`]))!
  expect(db.get('Npc', 104, NPC.name)).toBeUndefined()
  expect(db.places('Npc', 104)).toEqual({})
  expect(db.get('Quest', 7, QUEST.level)).toBe(12)
})

// The player's own QuestieDB, when TWINMAP_QUESTIE names a game folder: how long it takes to open.
test.skipIf(!process.env.TWINMAP_QUESTIE)('the real QuestieDB opens in under two seconds', () => {
  const started = performance.now()
  const db = openQuestie(process.env.TWINMAP_QUESTIE!)!
  const ms = performance.now() - started
  console.log(`QuestieDB ${db.version}: ${db.ids.Quest.length} quests, ${db.ids.Npc.length} NPCs, ${db.ids.Object.length} objects, ${db.zoneIndex.Npc.size} zones, ${Math.round(ms)} ms`)
  expect(db.get('Quest', db.ids.Quest[0]!, QUEST.name)).toBeTypeOf('string')
  expect(ms).toBeLessThan(2000)
})
