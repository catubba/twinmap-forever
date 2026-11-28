// What stands on the map whatever the character does: who offers a service, where ore and herbs
// grow (both from the player's QuestieDB), the doors of the dungeons, the flight routes and the ships
// and zeppelins (all from the game's own tables; the doors the tables do not give are in dungeon-doors.ts,
// which of the game's ways are ships and zeppelins in VESSELS).
import { DUNGEON_DOORS, FIRST_ENTRANCE, MORE_DOORS, type Entrance } from './dungeon-doors'
import type { InsidePlace } from './dungeon-trainers'
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
/** The name of a herb's own icon (icons.ts): Khadgar's Whisker is herb-khadgars-whisker. */
export const herbIcon = (kind: string): string => `herb-${kind.toLowerCase().replaceAll("'", '').replaceAll(' ', '-')}`
/** The skill lines of the two professions that gather them. */
export const GATHER_SKILL = { ore: 186, herbs: 182 } as const

/** What an object of QuestieDB is by its English name: ore or a herb, of which kind, and the skill it asks; null for anything else. */
export function resourceOf(name: string): { layer: 'ore' | 'herbs'; kind?: string; need?: number } | null {
  if (HERBS[name]) return { layer: 'herbs', kind: name, need: HERBS[name][0] }
  if (!ORE.test(name)) return null
  const word = name.toLowerCase().replaceAll(' ', '-'), kind = ORES_LONGEST_FIRST.find((o) => word.includes(o)) as keyof typeof ORES | undefined
  return kind ? { layer: 'ore', kind, need: ORES[kind][0] } : { layer: 'ore' }
}

// ponytail: the steps of CMaNGOS classic (Player::UpdateGatherSkill: 25, 50 and 100 over the skill asked, a node of 1 counted
// as 5), the server One for All takes its trainers from; Forever's own server may differ, and nothing of it says so.
/** The colour of a node for a skill, by the chance of a point: red not yet, then orange, yellow, green, and grey for none. */
export function gatherColour(need: number, skill: number): 'red' | 'orange' | 'yellow' | 'green' | 'grey' {
  const from = need === 1 ? 5 : need // "stuff that starts at 1 should stop at 105 not 101"
  return skill < need ? 'red' : skill < from + 25 ? 'orange' : skill < from + 50 ? 'yellow' : skill < from + 100 ? 'green' : 'grey'
}

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
  /** A trainer inside a dungeon (dungeon-trainers.ts): its map and its place there. It has no place on a zone (area 0). */
  inside?: InsidePlace
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
export const TAXI_PATH_NODE_FILE = 1000437

/**
 * The ships and zeppelins of Forever (the list is design/ships/elenco.md): the game's way of each, the table of its
 * points (TaxiPathNode), what it is, whom it carries, and the area each of its stops is named by, in the order it
 * stops there. The game's tables give the way and the stops, not which ways players ride: 295, Menethil Harbor to
 * Auberdine, is the ship of Classic that Forever sends by Southshore (11167), and stays in the tables.
 */
export const VESSELS: { path: number; kind: 'ship' | 'zeppelin'; side: string; stops: number[] }[] = [
  { path: 292, kind: 'ship', side: 'A', stops: [150, 513] }, // Menethil Harbor, Theramore Isle
  { path: 11167, kind: 'ship', side: 'A', stops: [150, 271, 442] }, // Menethil Harbor, Southshore, Auberdine
  { path: 11616, kind: 'ship', side: 'A', stops: [442, 17203] }, // Auberdine, Stormwind Harbor
  { path: 241, kind: 'ship', side: 'AH', stops: [392, 35] }, // Ratchet, Booty Bay
  { path: 11391, kind: 'ship', side: 'AH', stops: [977, 16727] }, // Steamwheedle Port, Powderfuse Port
  { path: 293, kind: 'ship', side: 'A', stops: [702, 442] }, // Rut'theran Village, Auberdine
  { path: 303, kind: 'ship', side: 'A', stops: [1116, 1108] }, // Feathermoon Stronghold, The Forgotten Coast
  { path: 302, kind: 'zeppelin', side: 'H', stops: [1637, 1497] }, // Orgrimmar, Undercity
  { path: 285, kind: 'zeppelin', side: 'H', stops: [117, 1637] }, // Grom'gol Base Camp, Orgrimmar
  { path: 301, kind: 'zeppelin', side: 'H', stops: [117, 1497] }, // Grom'gol Base Camp, Undercity
  // ponytail: Alliance as MapUtils has it; OneForAll says both sides. Make it AH if a Horde player is seen riding it.
  { path: 11398, kind: 'zeppelin', side: 'A', stops: [279, 16593] }, // Dalaran, Zephras Isle (an airship)
  { path: 11457, kind: 'zeppelin', side: 'H', stops: [17045, 16593] }, // Skywatcher Plateau, Zephras Isle
]

/** A place on a continent, in map units (geo.ts). */
interface Spot { continent: Continent; x: number; y: number }
/** Told in the file of what travel() gives: one made by an older travel() is made again. 2: the doors of the dungeons Forever added. 3: which doors are of raids. 4: the maps behind each door. 5: the ships and zeppelins. 6: the other doors of the dungeons that have more than one. */
export const TRAVEL_FORMAT = 6
export interface Travel {
  format?: number
  /**
   * Where one walks into a dungeon or a raid; several share a door. maps: the game's numbers of their maps, as names. raid: all behind it are raids.
   * A dungeon with more than one door has the one of the game's table first: where a ghost walks back in. wing: the wing a door more opens on.
   * entrance: which door it is, where there are several.
   */
  doors: (Spot & { names: string[]; maps?: number[]; raid?: true; wing?: string; entrance?: Entrance })[]
  /** Where a flight starts and ends. */
  nodes: (Spot & { name: string; side: string })[]
  /** Flights, each a pair of places in `nodes`. */
  routes: [number, number][]
  /**
   * Ships and zeppelins. way: where it goes, in runs on one continent each (a ship that crosses the sea leaves one
   * and comes out on the other), as [x, y] in map units. stops: where it stops, in order, named as the game names the
   * place; one off the two continents (Zephras Isle) has no continent.
   */
  vessels?: { kind: 'ship' | 'zeppelin'; side: string; way: { continent: Continent; points: [number, number][] }[]; stops: VesselStop[] }[]
}
export type VesselStop = (Spot | { continent: null }) & { name: string }

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
 * dungeon-doors.ts, each placed on the map of its zone (zones: the game's maps, as gameMaps gives them). So do the
 * other doors of a dungeon that has more than one, after the one of the table.
 */
export function travel(maps: Table, taxiNodes: Table, taxiPaths: Table, zones: GameMap[] = [], pathNodes?: Table, areas?: Table): Travel {
  const doors: (Spot & { names: string[]; maps: number[]; at: [number, number]; raid: boolean; wing?: string; entrance?: Entrance })[] = []
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
  for (const { map, continent, x, y, entrance, wing } of MORE_DOORS) {
    const first = doors.find((d) => d.maps.includes(map))
    if (!first) continue
    if (FIRST_ENTRANCE[map] && first.maps.length === 1) first.entrance = FIRST_ENTRANCE[map]
    const name = first.names[first.maps.indexOf(map)] ?? first.names[0]!
    doors.push({ continent, ...unitsOfWorld(x, y), names: [name], maps: [map], at: [x, y], raid: first.raid, entrance, ...(wing ? { wing } : {}) })
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
  return { format: TRAVEL_FORMAT, doors: doors.map(({ at: _at, raid, ...door }) => (raid ? { ...door, raid } : door)), nodes, routes: [...routes.values()], vessels: pathNodes && areas ? vessels(pathNodes, areas) : [] }
}

// Which column is what in the table of the points of the ways (build 1.60.1.70862): the row's parent is its way.
const POINT_AT = 0, POINT_ORDER = 3, POINT_WORLD = 4, POINT_FLAGS = 5, STOPS_HERE = 2
const AREA_NAME = 1

/** The ships and zeppelins of VESSELS, from the points of their ways and the names of the areas. A way the game no longer has is left out. */
function vessels(pathNodes: Table, areas: Table): NonNullable<Travel['vessels']> {
  const names = new Map(areas.rows.map((r) => [r.id, r.text(AREA_NAME)]))
  return VESSELS.flatMap(({ path, kind, side, stops: named }) => {
    const points = pathNodes.rows.filter((r) => r.parent === path).sort((a, b) => a.int(POINT_ORDER) - b.int(POINT_ORDER))
    const way: { continent: Continent | null; points: [number, number][] }[] = []
    const stops: { continent: Continent | null; x: number; y: number; at: [number, number] }[] = []
    for (const r of points) {
      const x = r.float(POINT_AT, 0), y = r.float(POINT_AT, 1), continent = continentOf(r.int(POINT_WORLD)), u = unitsOfWorld(x, y)
      const run = way.at(-1)
      if (run?.continent === continent) run.points.push([u.x, u.y])
      else way.push({ continent, points: [[u.x, u.y]] })
      // A way back to where it began stops there again: the same stop.
      if (r.int(POINT_FLAGS) & STOPS_HERE && !stops.some((s) => s.continent === continent && Math.hypot(s.at[0] - x, s.at[1] - y) < SAME_DOOR)) stops.push({ continent, ...u, at: [x, y] })
    }
    const name = (i: number): string => names.get(named[i]!) ?? ''
    if (stops.length !== named.length || named.some((_, i) => !name(i))) return []
    return [{
      kind,
      side,
      way: way.filter((run): run is { continent: Continent; points: [number, number][] } => run.continent !== null && run.points.length > 1),
      stops: stops.map(({ continent, x, y }, i): VesselStop => (continent === null ? { continent, name: name(i) } : { continent, x, y, name: name(i) })),
    }]
  })
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
  if (layer === 'herbs') return pin.kind ? herbIcon(pin.kind) : 'herbs'
  return layer ?? 'vendors'
}
