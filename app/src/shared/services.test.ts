import { expect, test } from 'vitest'
import { unitsOfPlace, unitsOfWorld } from './geo'
import { deathPlaces } from './death'
import type { GameMap } from './maps'
import { dungeonsOf } from './search'
import { gatherColour, iconOf, panelFor, resourceOf, serves, servicesOf, travel, TRAVEL_FORMAT, VESSELS, type FixedLayer, type FixedPin } from './services'
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

test('ore and herbs are told by their English names, with their kind and the skill they ask, and nothing else is', () => {
  expect(resourceOf('Copper Vein')).toEqual({ layer: 'ore', kind: 'copper', need: 1 })
  expect(resourceOf('Ooze Covered Mithril Deposit')).toEqual({ layer: 'ore', kind: 'mithril', need: 175 })
  expect(resourceOf('Small Thorium Vein')).toEqual({ layer: 'ore', kind: 'thorium', need: 245 })
  expect(resourceOf('Ooze Covered Rich Thorium Vein')).toEqual({ layer: 'ore', kind: 'rich-thorium', need: 275 })
  expect(resourceOf('Strange Vein'), 'a vein of no kind listed').toEqual({ layer: 'ore' })
  expect(resourceOf('Peacebloom')).toEqual({ layer: 'herbs', kind: 'Peacebloom', need: 1 })
  expect(resourceOf("Khadgar's Whisker")).toEqual({ layer: 'herbs', kind: "Khadgar's Whisker", need: 185 })
  expect(resourceOf('Jangolode Mine')).toBeNull()
  expect(resourceOf('Deepmoss Eggs')).toBeNull()
  expect(resourceOf('Veinous Thing')).toBeNull()
})

test('a node is red under the skill it asks, then orange, yellow, green, and grey a hundred points over it', () => {
  // One that asks 1 is counted as 5, as the server does: grey at 105, not 101.
  expect([0, 1, 29, 30, 55, 104, 105].map((skill) => gatherColour(1, skill))).toEqual(['red', 'orange', 'orange', 'yellow', 'green', 'green', 'grey'])
  expect([124, 149, 174, 224, 225].map((skill) => gatherColour(125, skill))).toEqual(['red', 'orange', 'yellow', 'green', 'grey'])
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

test('a dungeon with more than one door has them all, the one of the table first', () => {
  const maps = table([
    { id: 70, cols: { 1: 'Uldaman', 6: [-6060.2, -2955.0, 0], 8: 1, 17: 0 } },
    { id: 429, cols: { 1: 'La Masacre', 6: [-3908.0, 1130.0, 0], 8: 1, 17: 1 } }, // in the game's language
  ])
  const doors = travel(maps, table([]), table([])).doors
  expect(doors.filter((d) => d.maps?.includes(70))).toEqual([
    { continent: 0, ...unitsOfWorld(-6060.2, -2955.0), names: ['Uldaman'], maps: [70] },
    { continent: 0, ...unitsOfWorld(-6619.97, -3765.74), names: ['Uldaman'], maps: [70] }, // the back door, in Dustwind Gulch
  ])
  // Dire Maul: the table's, then a door for each wing, by the name of its pins; East has a back door too.
  expect(doors.filter((d) => d.maps?.includes(429)).map((d) => `${d.names[0]} ${d.wing ?? ''}`)).toEqual(['La Masacre ', 'La Masacre Dire Maul: North', 'La Masacre Dire Maul: West', 'La Masacre Dire Maul: East', 'La Masacre Dire Maul: East'])
  // A ghost walks back in at the door of the table, not at the back door.
  expect(deathPlaces({ ghost: true, inst: 70 }, [], doors).back).toEqual({ continent: 0, at: unitsOfWorld(-6060.2, -2955.0), name: 'Uldaman', door: true })
  // Searched, a dungeon is found once, at the door of the table; a wing at its own door.
  const found = dungeonsOf(doors)
  expect(found.filter((d) => d.id === 70)).toEqual([{ name: 'Uldaman', id: 70, raid: false, continent: 0, at: unitsOfWorld(-6060.2, -2955.0) }])
  expect(found.filter((d) => d.id === 429).map((d) => d.name)).toEqual(['La Masacre', 'Dire Maul: East', 'Dire Maul: North', 'Dire Maul: West'])
  expect(found.find((d) => d.name === 'Dire Maul: North')!.at).toEqual(unitsOfWorld(-3520.24, 1078.4))
  expect(found.find((d) => d.name === 'Dire Maul: East')!.at).toEqual(unitsOfWorld(-3738.62, 934.522))
  // A dungeon the table gives no door for gets none of these.
  expect(travel(table([]), table([]), table([])).doors).toEqual([])
})

test('ships and zeppelins come from the points of their ways, each stop named as the game names its area', () => {
  const areas = table([
    { id: 392, cols: { 1: 'Ratchet' } },
    { id: 35, cols: { 1: 'Bahía del Botín' } }, // in the game's language
    { id: 1116, cols: { 1: 'Feathermoon Stronghold' } },
    { id: 1108, cols: { 1: 'The Forgotten Coast' } },
    { id: 279, cols: { 1: 'Dalaran' } },
    { id: 16593, cols: { 1: 'Zephras Isle' } },
  ])
  let id = 0
  const point = (path: number, world: number, x: number, y: number, flags = 0) => ({ id: ++id, parent: path, cols: { 0: [x, y, 0], 3: id, 4: world, 5: flags } })
  const points = table([
    // Ratchet to Booty Bay across the sea: out of Kalimdor, into the Eastern Kingdoms, and back.
    point(241, 1, -1000, -3900), point(241, 1, -1006, -3842, 2), point(241, 1, -1100, -3700),
    point(241, 0, -14200, 500), point(241, 0, -14278, 583, 2), point(241, 0, -14200, 450),
    point(241, 1, -1050, -3950),
    // The ferry of Feathermoon stops where it began, again: one stop.
    point(303, 1, -4197, 3287, 2), point(303, 1, -4348, 2444, 2), point(303, 1, -4197, 3287, 2),
    // Dalaran to Zephras Isle, a world the map does not draw: its stop has a name and no place.
    point(11398, 0, 466, 64), point(11398, 0, 545, 424, 2), point(11398, 0, 488, 559), point(11398, 2991, 1848, 569, 2), point(11398, 2991, 1800, 600),
    // A way whose stops are not as many as the list names: the game changed it, left out.
    point(285, 0, -12464, 232, 2),
  ])
  const told = travel(table([]), table([]), table([]), [], points, areas).vessels!
  const at = (x: number, y: number): [number, number] => { const u = unitsOfWorld(x, y); return [u.x, u.y] }
  expect(told.map((v) => `${v.kind} ${v.side}: ${v.stops.map((s) => `${s.name} (${s.continent})`).join(', ')}`)).toEqual([
    'ship AH: Ratchet (1), Bahía del Botín (0)',
    'ship A: Feathermoon Stronghold (1), The Forgotten Coast (1)',
    'zeppelin A: Dalaran (0), Zephras Isle (null)',
  ])
  expect(told[0]!.way).toEqual([
    { continent: 1, points: [at(-1000, -3900), at(-1006, -3842), at(-1100, -3700)] },
    { continent: 0, points: [at(-14200, 500), at(-14278, 583), at(-14200, 450)] },
  ])
  expect(told[0]!.stops[1]).toEqual({ continent: 0, ...unitsOfWorld(-14278, 583), name: 'Bahía del Botín' })
  expect(told[2]!.way).toEqual([{ continent: 0, points: [at(466, 64), at(545, 424), at(488, 559)] }])
  // Without the two tables there are no ships, and the rest is there all the same.
  expect(travel(table([]), table([]), table([])).vessels).toEqual([])
})

test('the list of ships and zeppelins: ten crossings between the continents, as design/ships/elenco.md counts them', () => {
  // Zephras Isle (16593) is a world of its own. Each leg between two stops on two of them is one crossing.
  const WORLD: Record<number, number> = { 150: 0, 513: 1, 271: 0, 442: 1, 17203: 0, 392: 1, 35: 0, 977: 1, 16727: 0, 702: 1, 1116: 1, 1108: 1, 1637: 1, 1497: 0, 117: 0, 279: 0, 16593: 2, 17045: 1 }
  const legs = VESSELS.flatMap((v) => v.stops.map((a, i) => [a, v.stops[(i + 1) % v.stops.length]!] as const).slice(0, v.stops.length === 2 ? 1 : undefined))
  expect(legs.filter(([a, b]) => WORLD[a] !== WORLD[b])).toHaveLength(10)
  expect(new Set(VESSELS.map((v) => v.path)).size).toBe(VESSELS.length)
  for (const v of VESSELS) expect(v.stops.every((s) => s in WORLD) && ['A', 'H', 'AH'].includes(v.side)).toBe(true)
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
  // A vein by its kind, not by its name, which is in the game's language.
  expect(iconOf({ layers: ['ore'], kind: 'copper' })).toBe('ore-copper')
  expect(iconOf({ layers: ['ore'], kind: 'dark-iron' })).toBe('ore-dark-iron')
  expect(iconOf(pin('Strange Vein', ['ore']))).toBe('ore')
  // A herb by its own icon; one of no kind listed by the cursor.
  expect(iconOf({ layers: ['herbs'], kind: "Khadgar's Whisker" })).toBe('herb-khadgars-whisker')
  expect(iconOf(pin('Strange Weed', ['herbs']))).toBe('herbs')
})
