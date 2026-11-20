import { expect, test } from 'vitest'
import { unitsOfPlace, unitsOfWorld } from './geo'
import type { GameMap } from './maps'
import { iconOf, panelFor, resourceOf, serves, servicesOf, travel, TRAVEL_FORMAT, type FixedLayer, type FixedPin } from './services'
import type { Row, Table } from './wdc5'

// A table of the game, as far as these readers look at one: rows of columns, a column a value or a list.
type Cell = number | string | number[]
const table = (rows: { id: number; parent?: number; cols: Record<number, Cell> }[]): Table => ({
  fields: 26,
  encryptedRows: 0,
  rows: rows.map(({ id, parent, cols }): Row => {
    const number = (field: number, at = 0): number => {
      const cell = cols[field] ?? 0
      return Array.isArray(cell) ? (cell[at] ?? 0) : typeof cell === 'number' ? cell : 0
    }
    return { id, parent, int: number, float: number, text: (field) => String(cols[field] ?? '') }
  }),
})

test('the flags of an NPC say which services it offers', () => {
  expect(servicesOf(4 + 16384)).toEqual(['vendors', 'repair'])
  expect(servicesOf(128 + 4)).toEqual(['vendors', 'inn'])
  expect(servicesOf(8)).toEqual(['flight'])
  expect(servicesOf(1 + 2 + 32), 'gossip, quests, a spirit healer: no service').toEqual([])
})

test('ore and herbs are told by their names, and nothing else is', () => {
  expect(resourceOf('Copper Vein')).toBe('ore')
  expect(resourceOf('Ooze Covered Mithril Deposit')).toBe('ore')
  expect(resourceOf('Peacebloom')).toBe('herbs')
  expect(resourceOf("Khadgar's Whisker")).toBe('herbs')
  expect(resourceOf('Jangolode Mine')).toBeNull()
  expect(resourceOf('Deepmoss Eggs')).toBeNull()
  expect(resourceOf('Veinous Thing')).toBeNull()
})

test('a pin is for a side when it serves it, and for everyone while the side is not known', () => {
  expect(serves({ side: 'A' }, 'A')).toBe(true)
  expect(serves({ side: 'AH' }, 'H')).toBe(true)
  expect(serves({ side: 'A' }, 'H')).toBe(false)
  expect(serves({ side: 'A' }, undefined)).toBe(true)
  expect(serves({}, 'H'), 'ore has no side').toBe(true)
})

test('the panel of a vendor opens for its name, and for an item it sells', () => {
  const brianna: FixedPin = { area: 44, x: 22, y: 44.8, name: 'Innkeeper Brianna', layers: ['inn', 'vendors'], npc: 6727, sells: [159, 1179] }
  expect(panelFor(brianna, { title: 'Innkeeper Brianna' })).toBe(true)
  expect(panelFor(brianna, { title: 'Refreshing Spring Water', item: 159 }), 'found as who sells the item').toBe(true)
  expect(panelFor(brianna, { title: 'Rough Arrow', item: 2512 }), 'an item she does not sell').toBe(false)
  expect(panelFor(brianna, { title: 'Refreshing Spring Water' }), 'a name alone that is not hers').toBe(false)
  // A flight master has no panel, and a trainer sells nothing.
  expect(panelFor({ area: 44, x: 30, y: 59, name: 'Ariena Stormfeather', layers: ['flight'] }, { title: 'Ariena Stormfeather' })).toBe(false)
  expect(panelFor({ area: 44, x: 30, y: 59, name: 'Dockmaster Baren', layers: ['trainers'], npc: 381 }, { title: 'Spotted Sunfish', item: 1467 })).toBe(false)
})

test('doors and flights come from the tables of the maps and of the flight paths', () => {
  const maps = table([
    { id: 0, cols: { 1: 'Eastern Kingdoms', 17: -1 } },
    { id: 36, cols: { 1: 'Deadmines', 6: [-11207.8, 1681.2, 0], 8: 1, 17: 0 } },
    // Two raids behind one door.
    { id: 509, cols: { 1: "Ruins of Ahn'Qiraj", 6: [-8114.5, 1526.4, 0], 8: 2, 17: 1 } },
    { id: 531, cols: { 1: "Ahn'Qiraj Temple", 6: [-8111.7, 1526.8, 0], 8: 2, 17: 1 } },
    // Left out: a map no longer used, one that is not a dungeon, one reached through another.
    { id: 44, cols: { 1: '<unused> Monastery', 6: [2892.4, -811.2, 0], 8: 1, 17: 0 } },
    { id: 369, cols: { 1: 'Deeprun Tram', 6: [-8349.2, 517.3, 0], 8: 0, 17: 0 } },
    { id: 2784, cols: { 1: 'Demon Fall Canyon', 8: 1, 17: -1 } },
  ])
  const nodes = table([
    { id: 2, parent: 0, cols: { 0: 'Stormwind, Elwynn', 1: [-8833, 479, 110], 8: 1025 } },
    { id: 4, parent: 0, cols: { 0: 'Sentinel Hill, Westfall', 1: [-10629, 1037, 34], 8: 1025 } },
    { id: 11, parent: 0, cols: { 0: 'Undercity, Tirisfal', 1: [1569, 268, 0], 8: 1026 } },
    { id: 23, parent: 1, cols: { 0: 'Orgrimmar, Durotar', 1: [1678, -4316, 0], 8: 1026 } },
    // Left out: no side flies from it, a ship, a node nothing leaves, one on no continent.
    { id: 1, parent: 0, cols: { 0: 'Northshire Abbey', 1: [-8889, -1, 94], 8: 1024 } },
    { id: 34, parent: 1, cols: { 0: 'Transport, Booty Bay - Ratchet', 1: [-1965, -5824, 0], 8: 1027 } },
    { id: 9, parent: 0, cols: { 0: 'Booty Bay, Stranglethorn', 1: [-14272, 300, 0], 8: 1025 } },
    { id: 59, parent: 30, cols: { 0: 'Dun Baldar, Alterac Valley', 1: [574, -47, 0], 8: 1025 } },
  ])
  const paths = table([
    { id: 6, cols: { 1: 2, 2: 4 } },
    { id: 7, cols: { 1: 4, 2: 2 } }, // the way back: the same route
    { id: 8, cols: { 1: 11, 2: 23 } }, // across the sea: not a line on one continent
    { id: 9, cols: { 1: 2, 2: 34 } },
    { id: 10, cols: { 1: 59, 2: 2 } },
  ])
  const told = travel(maps, nodes, paths)
  // With the game's maps given, the dungeons Forever added get the door the table has none for: on the map of
  // their zone, by the game's name when the row can be read. One whose zone is not there gets none.
  const zone = (id: number, continent: 0 | 1 | null): GameMap => ({ id, name: '', parent: 0, level: 'zone', continent, rect: { minX: -1000, minY: -2000, maxX: 1000, maxY: 2000 }, area: 0 })
  const added = travel(table([{ id: 3065, cols: { 1: 'The Hall of Thanes (as the game names it)', 8: 1, 17: -1 } }]), nodes, paths, [zone(1455, 0), zone(1434, 0), zone(1445, null)])
  expect(added.doors).toEqual([
    { continent: 0, ...unitsOfPlace(zone(1434, 0).rect!, 21.317, 27.817), names: ['The Drowned City'], maps: [2970] },
    { continent: 0, ...unitsOfPlace(zone(1455, 0).rect!, 27.864, 47.695), names: ['The Hall of Thanes (as the game names it)'], maps: [3065] },
  ])
  expect(added.format).toBe(TRAVEL_FORMAT)
  expect(told.doors).toEqual([
    { continent: 0, ...unitsOfWorld(-11207.8, 1681.2), names: ['Deadmines'], maps: [36] },
    { continent: 1, ...unitsOfWorld(-8114.5, 1526.4), names: ["Ruins of Ahn'Qiraj", "Ahn'Qiraj Temple"], maps: [509, 531], raid: true },
  ])
  expect(told.nodes.map((n) => `${n.continent} ${n.name} ${n.side}`)).toEqual(['0 Stormwind, Elwynn A', '0 Sentinel Hill, Westfall A', '0 Undercity, Tirisfal H', '1 Orgrimmar, Durotar H'])
  expect(told.nodes[0]).toMatchObject(unitsOfWorld(-8833, 479))
  expect(told.routes).toEqual([[0, 1]])
})

test('a pin takes the picture of what it is', () => {
  const pin = (name: string, layers: FixedLayer[], sub?: string) => ({ name, layers, sub })
  expect(iconOf(pin('Dungar Longdrink', ['flight'], 'Gryphon Master'))).toBe('flight')
  // An innkeeper sells too: drawn as an inn, and as who sells food with the inns turned off.
  expect(iconOf(pin('Innkeeper Farley', ['vendors', 'inn'], 'Innkeeper'))).toBe('inn')
  expect(iconOf(pin('Innkeeper Farley', ['vendors', 'inn'], 'Innkeeper'), (layer) => layer !== 'inn')).toBe('food')
  expect(iconOf(pin('Wu Shen', ['trainers'], 'Warrior Trainer'))).toBe('class')
  expect(iconOf(pin('Tannysa', ['trainers'], 'Herbalism Trainer'))).toBe('profession')
  expect(iconOf(pin('Jasper Fel', ['vendors'], 'Shady Dealer'))).toBe('vendors')
  expect(iconOf(pin('Lina Stover', ['vendors'], 'Bow & Arrow Merchant'))).toBe('ammunition')
  expect(iconOf(pin('Copper Vein', ['ore']))).toBe('ore-copper')
  expect(iconOf(pin('Ooze Covered Truesilver Deposit', ['ore']))).toBe('ore-truesilver')
  expect(iconOf(pin('Dark Iron Deposit', ['ore']))).toBe('ore-dark-iron')
  expect(iconOf(pin('Strange Vein', ['ore']))).toBe('ore')
  expect(iconOf(pin('Peacebloom', ['herbs']))).toBe('herbs')
})
