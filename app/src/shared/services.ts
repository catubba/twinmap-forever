// What stands on the map whatever the character does: who offers a service, where ore and herbs
// grow (both from the player's QuestieDB), the doors of the dungeons and the flight routes (both
// from the game's own tables).
import { unitsOfWorld } from './geo'
import type { Continent } from './maps'
import type { Table } from './wdc5'

/** The bit of an NPC's flags behind each layer of services: QuestieDB's npcFlags of this game. */
export const SERVICE_FLAGS = { vendors: 4, flight: 8, trainers: 16, inn: 128, bank: 256, auction: 4096, stable: 8192, repair: 16384 } as const
export type ServiceLayer = keyof typeof SERVICE_FLAGS
export type FixedLayer = ServiceLayer | 'ore' | 'herbs'

export const servicesOf = (flags: number): ServiceLayer[] => (Object.keys(SERVICE_FLAGS) as ServiceLayer[]).filter((layer) => Math.floor(flags / SERVICE_FLAGS[layer]) % 2 === 1)

// ponytail: QuestieDB does not say what kind of thing an object is, so ore and herbs are told by
// their English names. A herb the game adds is missing until it is listed here; read the kind from
// the game (the lock of the object) if a table of it ever turns up in the client.
const ORE = /\b(Vein|Deposit)$/
const HERBS = new Set(
  "Peacebloom,Silverleaf,Earthroot,Mageroyal,Briarthorn,Stranglekelp,Bruiseweed,Wild Steelbloom,Grave Moss,Kingsblood,Liferoot,Fadeleaf,Goldthorn,Khadgar's Whisker,Wintersbite,Firebloom,Purple Lotus,Arthas' Tears,Sungrass,Blindweed,Ghost Mushroom,Gromsblood,Golden Sansam,Dreamfoil,Mountain Silversage,Plaguebloom,Icecap,Black Lotus".split(','),
)
export const resourceOf = (name: string): 'ore' | 'herbs' | null => (ORE.test(name) ? 'ore' : HERBS.has(name) ? 'herbs' : null)

/** One pin: a place in percent of the map of a zone, the zone by the game's area number. */
export interface FixedPin {
  area: number
  x: number
  y: number
  name: string
  /** What an NPC is, as the game writes it under the name: "Gryphon Master". */
  sub?: string
  /** The layers it belongs to: one of them on is enough to show it. */
  layers: FixedLayer[]
  /** Whom an NPC serves: "A", "H" or "AH". Missing for ore and herbs. */
  side?: string
}

/** Whether a pin is for a character of this side. With the side not known yet, every pin is. */
export const serves = (pin: { side?: string }, side: string | undefined): boolean => !pin.side || !side || pin.side.includes(side)

export const TAXI_NODES_FILE = 1068100
export const TAXI_PATH_FILE = 1067802

/** A place on a continent, in map units (geo.ts). */
interface Spot { continent: Continent; x: number; y: number }
export interface Travel {
  /** Where one walks into a dungeon or a raid; several share a door. */
  doors: (Spot & { names: string[] })[]
  /** Where a flight starts and ends. */
  nodes: (Spot & { name: string; side: string })[]
  /** Flights, each a pair of places in `nodes`. */
  routes: [number, number][]
}

// Which column is what, found by reading the real tables (build 1.60.1.70862).
const MAP_NAME = 1, MAP_DOOR = 6, MAP_KIND = 8, MAP_DOOR_WORLD = 17
const NODE_NAME = 0, NODE_PLACE = 1, NODE_FLAGS = 8
const PATH_FROM = 1, PATH_TO = 2
const SAME_DOOR = 30 // yards: two maps whose doors are closer than this are behind one door

const continentOf = (world: number | undefined): Continent | null => (world === 0 || world === 1 ? world : null)

/**
 * The doors and the flights, from the tables of the maps, of the flight nodes and of the flight
 * paths. A map says where a ghost walks back in: that is its door. A dungeon reached through
 * another has none.
 */
export function travel(maps: Table, taxiNodes: Table, taxiPaths: Table): Travel {
  const doors: (Spot & { names: string[]; at: [number, number] })[] = []
  for (const row of maps.rows) {
    const continent = continentOf(row.int(MAP_DOOR_WORLD)), kind = row.int(MAP_KIND), name = row.text(MAP_NAME)
    const x = row.float(MAP_DOOR, 0), y = row.float(MAP_DOOR, 1)
    if (continent === null || (kind !== 1 && kind !== 2) || !name || name.startsWith('<') || (!x && !y)) continue
    const same = doors.find((d) => d.continent === continent && Math.hypot(d.at[0] - x, d.at[1] - y) < SAME_DOOR)
    if (same) same.names.push(name)
    else doors.push({ continent, ...unitsOfWorld(x, y), names: [name], at: [x, y] })
  }

  // A node is one a player flies from when a side may use it and a path leaves it: the table also
  // holds the ends of ships, of quest flights and of nodes no longer there.
  const flown = new Set<number>()
  for (const row of taxiPaths.rows) flown.add(row.int(PATH_FROM)).add(row.int(PATH_TO))
  const index = new Map<number, number>()
  const nodes: Travel['nodes'] = []
  for (const row of taxiNodes.rows) {
    const continent = continentOf(row.parent), flags = row.int(NODE_FLAGS), name = row.text(NODE_NAME)
    if (continent === null || !(flags & 3) || !flown.has(row.id) || /^(zzOLD|Quest Path|Transport|Generic)/.test(name)) continue
    index.set(row.id, nodes.length)
    nodes.push({ continent, ...unitsOfWorld(row.float(NODE_PLACE, 0), row.float(NODE_PLACE, 1)), name, side: (flags & 1 ? 'A' : '') + (flags & 2 ? 'H' : '') })
  }
  const routes = new Map<string, [number, number]>()
  for (const row of taxiPaths.rows) {
    const a = index.get(row.int(PATH_FROM)), b = index.get(row.int(PATH_TO))
    if (a === undefined || b === undefined || a === b || nodes[a]!.continent !== nodes[b]!.continent) continue
    routes.set(`${Math.min(a, b)}-${Math.max(a, b)}`, [Math.min(a, b), Math.max(a, b)])
  }
  return { doors: doors.map(({ at: _at, ...door }) => door), nodes, routes: [...routes.values()] }
}
