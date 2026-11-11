import { expect, test } from 'vitest'
import { unitsOfPlace } from './geo'
import type { GameMap } from './maps'
import { nearbyRows, nearest, questsHere, REORDER_EVERY, steady, wayOf, whereIs, type NowRow } from './now'
import type { QuestPin } from './quests'
import type { FixedPin } from './services'

// Two zones side by side on the Eastern Kingdoms and one on Kalimdor, each 1000 yards a side: a percent is 10 yards.
const zone = (id: number, area: number, continent: 0 | 1, minY: number): GameMap => ({ id, name: `Zone ${id}`, parent: 0, level: 'zone', continent, area, rect: { minX: 0, maxX: 1000, minY, maxY: minY + 1000 } })
const MAPS = [zone(1, 12, 0, 0), zone(2, 40, 0, 1000), zone(3, 17, 1, 0)]
const quest = (type: QuestPin['type'], area: number, x: number, y: number, name: string, ...quests: string[]): QuestPin => ({ type, area, x, y, name, quests })
const service = (area: number, x: number, y: number, name: string, layers: FixedPin['layers'], side = 'A'): FixedPin => ({ area, x, y, name, layers, side })
const at = (id: number, x: number, y: number) => whereIs(MAPS, { map: id, x, y })!

test('the character is placed on the map from its zone and a percent of it', () => {
  expect(at(1, 50, 50)).toMatchObject({ continent: 0, at: unitsOfPlace(MAPS[0]!.rect!, 50, 50) })
  expect(whereIs(MAPS, { map: 99, x: 1, y: 1 }), 'a map the app does not have').toBeNull()
  expect(whereIs(MAPS, { map: 1 }), 'the game tells no place').toBeNull()
  expect(whereIs(MAPS, undefined)).toBeNull()
})

test('how far and which way: yards, and degrees clockwise from north', () => {
  const me = at(1, 50, 50).at, place = (x: number, y: number) => unitsOfPlace(MAPS[0]!.rect!, x, y)
  // A percent of this zone is ten yards. North is up on the map: a smaller y.
  expect(wayOf(me, place(50, 40)).yards).toBeCloseTo(100)
  expect(wayOf(me, place(50, 40)).turn).toBeCloseTo(0)
  expect(wayOf(me, place(60, 50)).turn).toBeCloseTo(90)
  expect(wayOf(me, place(50, 60)).turn).toBeCloseTo(180)
  expect(wayOf(me, place(40, 50)).turn).toBeCloseTo(270)
  expect(wayOf(me, place(53, 46)).yards).toBeCloseTo(50)
  expect(wayOf(me, place(50.5, 50)).yards, 'walking up to someone').toBeLessThan(10)
})

test('the quests of the log with a pin in this zone, each on its nearest: to hand in first', () => {
  const pins = [
    quest('objective', 12, 80, 50, 'Cellar Rat', 'Rats in the Cellar'),
    quest('objective', 12, 55, 50, 'Cellar Rat', 'Rats in the Cellar', 'A Second Quest'),
    quest('turnin', 12, 10, 10, 'Miller Odo', 'A Parcel for the Miller'),
    quest('objective', 40, 50, 50, 'Road Warden', 'Elsewhere'), // another zone
    quest('available', 12, 50, 51, 'Smith Hale', '[5] Not Taken Yet'), // not in the log
  ]
  const me = at(1, 50, 50)
  const rows = questsHere(pins, me.zone, me.at)
  expect(rows.map((r) => `${r.name} | ${r.kind} | ${Math.round(wayOf(me.at, r.at).yards)}`)).toEqual(['A Parcel for the Miller | Hand in | 566', 'Rats in the Cellar | Objective | 50', 'A Second Quest | Objective | 50'])
})

test('who is near: givers of quests and services of the character\'s side, each once, the nearest first', () => {
  const quests = [quest('available', 12, 52, 50, 'Smith Hale', '[5] A Job'), quest('turnin', 12, 50, 50.1, 'Miller Odo', 'A Parcel')]
  const fixed: FixedPin[] = [
    service(12, 51, 50, 'Innkeeper Bree', ['vendors', 'inn']),
    service(12, 90, 50, 'Guard Tor', ['repair', 'vendors']),
    service(12, 54, 50, 'Guard Tor', ['repair', 'vendors']), // the same one, nearer
    service(12, 50, 50.2, 'Grunt Zak', ['vendors'], 'H'),
    service(40, 99, 50, 'Wing Master', ['flight']), // the next zone to the west, just across its edge
    service(17, 50, 50, 'Far Away', ['bank']), // the other continent
    { area: 12, x: 50, y: 50, name: 'Copper Vein', layers: ['ore'] } satisfies FixedPin,
  ]
  const me = at(1, 50, 50)
  const told = (side: string | undefined, most = 8): string[] => nearest(nearbyRows(MAPS, quests, fixed, side), me.continent, me.at, most).map((r) => `${r.name} ${r.kind} ${Math.round(wayOf(me.at, r.at).yards)}`)
  expect(told('A')).toEqual(['Innkeeper Bree Inn 10', 'Smith Hale Quest 20', 'Guard Tor Repair 40', 'Wing Master Flight 510'])
  expect(told('A', 2)).toEqual(['Innkeeper Bree Inn 10', 'Smith Hale Quest 20'])
  // Until the addon tells the side, nobody is left out.
  expect(told(undefined)[0]).toBe('Grunt Zak Vendor 2')
})

test('the rows keep their order for five seconds, then take the fresh one', () => {
  const row = (key: string, x: number): NowRow => ({ key, name: key, kind: 'Quest', tone: 'quest', continent: 0, at: { x, y: 0 } })
  const first = steady(null, [row('a', 1), row('b', 2)], 1000)
  expect(first.rows.map((r) => r.key)).toEqual(['a', 'b'])
  // b is now the nearer, c is new, a moved: the order holds, a row carries its new place.
  const soon = steady(first, [row('b', 2), row('a', 3), row('c', 4)], 1000 + REORDER_EVERY - 1)
  expect(soon.rows.map((r) => `${r.key}${r.at.x}`)).toEqual(['a3', 'b2'])
  // A row that is gone leaves at once.
  expect(steady(first, [row('b', 2)], 2000).rows.map((r) => r.key)).toEqual(['b'])
  const later = steady(soon, [row('b', 2), row('a', 3), row('c', 4)], 1000 + REORDER_EVERY)
  expect(later.rows.map((r) => r.key)).toEqual(['b', 'a', 'c'])
  expect(later.at).toBe(1000 + REORDER_EVERY)
})
