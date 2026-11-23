// What stands on the map whatever the character does: who offers a service, where ore and herbs
// grow (both from the player's QuestieDB), the doors of the dungeons and the flight routes (both
// from the game's own tables; the doors the tables do not give are in dungeon-doors.ts).
import { DUNGEON_DOORS } from './dungeon-doors'
import { unitsOfPlace, unitsOfWorld } from './geo'
import type { Continent, GameMap } from './maps'
import type { Table } from './wdc5'

/** The bit of an NPC's flags behind each layer of services: QuestieDB's npcFlags of this game. */
export const SERVICE_FLAGS = { vendors: 4, flight: 8, trainers: 16, inn: 128, bank: 256, auction: 4096, stable: 8192, repair: 16384 } as const
export type ServiceLayer = keyof typeof SERVICE_FLAGS
export type FixedLayer = ServiceLayer | 'ore' | 'herbs'

export const servicesOf = (flags: number): ServiceLayer[] => (Object.keys(SERVICE_FLAGS) as ServiceLayer[]).filter((layer) => Math.floor(flags / SERVICE_FLAGS[layer]) % 2 === 1)

// ponytail: QuestieDB does not say what kind of thing an object is, so ore and herbs are told by
// their English names. A herb the game adds is missing until it is listed here; read the kind from
// the game (the lock of the object) if a table of it ever turns up in the client.
// Each herb by its English name, and each ore by the word of its vein (a dash for a space): the skill it asks and the
// item it gives, whose picture is the ore's on the map (icons.ts) and the kind's in the list of kinds.
export const HERBS: Record<string, readonly [need: number, item: number]> = {
  Peacebloom: [1, 2447], Silverleaf: [1, 765], Earthroot: [15, 2449], Mageroyal: [50, 785], Briarthorn: [70, 2450], Stranglekelp: [85, 3820],
  Bruiseweed: [100, 2453], 'Wild Steelbloom': [115, 3355], 'Grave Moss': [120, 3369], Kingsblood: [125, 3356], Liferoot: [150, 3357],
  Fadeleaf: [160, 3818], Goldthorn: [170, 3821], "Khadgar's Whisker": [185, 3358], Wintersbite: [195, 3819], Firebloom: [205, 4625],
  'Purple Lotus': [210, 8831], "Arthas' Tears": [220, 8836], Sungrass: [230, 8838], Blindweed: [235, 8839], 'Ghost Mushroom': [245, 8845],
  Gromsblood: [250, 8846], 'Golden Sansam': [260, 13464], Dreamfoil: [270, 13463], 'Mountain Silversage': [280, 13465], Plaguebloom: [285, 13466],
  Icecap: [290, 13467], 'Black Lotus': [300, 13468],
}
export const ORES = {
  copper: [1, 2770], tin: [65, 2771], incendicite: [65, 3340], silver: [75, 2775], bloodstone: [75, 4278], iron: [125, 2772], indurium: [150, 5833],
  gold: [155, 2776], mithril: [175, 3858], truesilver: [230, 7911], 'dark-iron': [230, 11370], thorium: [245, 10620], 'rich-thorium': [275, 10620],
} as const satisfies Record<string, readonly [need: number, item: number]>
const ORE = /\b(Vein|Deposit)$/
const ORES_LONGEST_FIRST = Object.keys(ORES).sort((a, b) => b.length - a.length) // "Truesilver" is not silver, "Rich Thorium" not thorium
/** The skill lines of the two professions that gather them. */
export const GATHER_SKILL = { ore: 186, herbs: 182 } as const

/** What an object of QuestieDB is by its English name: ore or a herb, of which kind, and the skill it asks; null for anything else. */
export function resourceOf(name: string): { layer: 'ore' | 'herbs'; kind?: string; need?: number } | null {
  if (HERBS[name]) return { layer: 'herbs', kind: name, need: HERBS[name][0] }
  if (!ORE.test(name)) return null
  const word = name.toLowerCase().replaceAll(' ', '-'), kind = ORES_LONGEST_FIRST.find((o) => word.includes(o)) as keyof typeof ORES | undefined
  return kind ? { layer: 'ore', kind, need: ORES[kind][0] } : { layer: 'ore' }
}

// ponytail: the steps of classic (25, 50, 100 over the skill asked), not read from Forever.
/** The colour the game gives a node for a skill: red not yet, then orange, yellow, green, and grey when it gives no more points. */
export const gatherColour = (need: number, skill: number): 'red' | 'orange' | 'yellow' | 'green' | 'grey' =>
  skill < need ? 'red' : skill < need + 25 ? 'orange' : skill < need + 50 ? 'yellow' : skill < need + 100 ? 'green' : 'grey'

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
  /** The NPC's number in QuestieDB, for a vendor or a trainer: what its panel shows. */
  npc?: number
  /** What a vendor sells: items by number. */
  sells?: number[]
  /** Of ore and herbs: the kind (a key of HERBS or ORES) and the skill it asks. Missing for a vein of no kind listed. */
  kind?: string
  need?: number
}

/**
 * Whether a pin is the vendor or the trainer a place found stands for: found by its own name, or as the one
 * who sells the item that was found. Its panel opens with the label.
 */
export const panelFor = (pin: FixedPin, found: { title: string; item?: number }): boolean =>
  pin.npc !== undefined && (pin.name === found.title || (found.item !== undefined && (pin.sells ?? []).includes(found.item)))

/** Whether a pin is for a character of this side. With the side not known yet, every pin is. */
export const serves = (pin: { side?: string }, side: string | undefined): boolean => !pin.side || !side || pin.side.includes(side)

export const TAXI_NODES_FILE = 1068100
export const TAXI_PATH_FILE = 1067802

/** A place on a continent, in map units (geo.ts). */
interface Spot { continent: Continent; x: number; y: number }
/** Told in the file of what travel() gives: one made by an older travel() is made again. 2: the doors of the dungeons Forever added. 3: which doors are of raids. 4: the maps behind each door. */
export const TRAVEL_FORMAT = 4
export interface Travel {
  format?: number
  /** Where one walks into a dungeon or a raid; several share a door. maps: the game's numbers of their maps, as names. raid: all behind it are raids. */
  doors: (Spot & { names: string[]; maps?: number[]; raid?: true })[]
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
 * another has none. The dungeons Forever added have none in the table either: theirs come from
 * dungeon-doors.ts, each placed on the map of its zone (zones: the game's maps, as gameMaps gives them).
 */
export function travel(maps: Table, taxiNodes: Table, taxiPaths: Table, zones: GameMap[] = []): Travel {
  const doors: (Spot & { names: string[]; maps: number[]; at: [number, number]; raid: boolean })[] = []
  const given = new Set<number>()
  for (const row of maps.rows) {
    const continent = continentOf(row.int(MAP_DOOR_WORLD)), kind = row.int(MAP_KIND), name = row.text(MAP_NAME)
    const x = row.float(MAP_DOOR, 0), y = row.float(MAP_DOOR, 1)
    if (continent === null || (kind !== 1 && kind !== 2) || !name || name.startsWith('<') || (!x && !y)) continue
    const same = doors.find((d) => d.continent === continent && Math.hypot(d.at[0] - x, d.at[1] - y) < SAME_DOOR)
    if (same) {
      same.names.push(name)
      same.maps.push(row.id)
      same.raid &&= kind === 2
    } else doors.push({ continent, ...unitsOfWorld(x, y), names: [name], maps: [row.id], at: [x, y], raid: kind === 2 })
    given.add(row.id)
  }
  for (const door of DUNGEON_DOORS) {
    const zone = zones.find((z) => z.id === door.zone)
    if (given.has(door.map) || !zone?.rect || zone.continent === null) continue
    // The name as the game writes it, when the row of the map is one this PC can read.
    const name = maps.rows.find((row) => row.id === door.map)?.text(MAP_NAME) || door.name
    doors.push({ continent: zone.continent, ...unitsOfPlace(zone.rect, door.x * 100, door.y * 100), names: [name], maps: [door.map], at: [0, 0], raid: false })
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
  return { format: TRAVEL_FORMAT, doors: doors.map(({ at: _at, raid, ...door }) => (raid ? { ...door, raid } : door)), nodes, routes: [...routes.values()] }
}

const ICON_ORDER = ['flight', 'inn', 'bank', 'auction', 'stable', 'repair', 'trainers', 'vendors', 'ore', 'herbs'] as const satisfies readonly FixedLayer[]
const CLASS_TRAINER = /\b(Warrior|Paladin|Hunter|Rogue|Priest|Shaman|Mage|Warlock|Druid) Trainer\b/
// What is sold, told by what the game writes under the name of who sells it.
const SOLD: [RegExp, string][] = [
  [/reagent/i, 'reagents'],
  [/poison/i, 'poisons'],
  [/ammo|bowyer|fletcher|gunsmith|arrow|bullet/i, 'ammunition'],
  [/food|drink|baker|butcher|cook|fruit|fish|meat|cheese|bread|mushroom|bartender|barmaid|wine|innkeeper/i, 'food'],
]

/**
 * The picture a pin is drawn with (icons.ts writes them): of the first of its layers that is
 * shown, in the order above, so that an innkeeper who also sells is drawn as an inn.
 */
export function iconOf(pin: Pick<FixedPin, 'sub' | 'layers' | 'kind'>, shown: (layer: FixedLayer) => boolean = () => true): string {
  const layer = ICON_ORDER.find((l) => pin.layers.includes(l) && shown(l)) ?? pin.layers[0]
  if (layer === 'trainers') return CLASS_TRAINER.test(pin.sub ?? '') ? 'class' : 'profession'
  if (layer === 'vendors') return SOLD.find(([told]) => told.test(pin.sub ?? ''))?.[1] ?? 'vendors'
  if (layer === 'ore') return pin.kind ? `ore-${pin.kind}` : 'ore'
  return layer ?? 'vendors'
}
