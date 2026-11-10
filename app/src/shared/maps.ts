// The maps of the game, from two of its tables: UiMap (what the maps are and how they nest) and
// UiMapAssignment (where each lies in the world). The ids are the ones the addon reads in the game.
//
// World coordinates are in yards, x growing to the north and y to the west, as the game has them.
// A place given in percent of a zone's map is at
//   y = maxY - x% * (maxY - minY),  x = maxX - y% * (maxX - minX).
import type { Table } from './wdc5'

/** The file numbers of the two tables in the game's archive. */
export const UI_MAP_FILE = 1957206
export const UI_MAP_ASSIGNMENT_FILE = 1957219

// Which column is what. The tables carry no names: found by reading the real ones (build 1.60.1.70862).
const NAME = 0, PARENT = 2, TYPE = 5
const REGION = 2, UI_MAP = 4, ORDER = 5, WORLD = 6, AREA = 7

/** How deep a map is: the whole world, a continent, or a zone (cities included). */
export type MapLevel = 'world' | 'continent' | 'zone' | 'other'
const LEVELS: Record<number, MapLevel> = { 1: 'world', 2: 'continent', 3: 'zone' }

/** The two worlds the tiles come from: 0 is the Eastern Kingdoms ("azeroth"), 1 is Kalimdor. */
export type Continent = 0 | 1

export interface Rect { minX: number; minY: number; maxX: number; maxY: number }

export interface GameMap {
  id: number
  name: string
  /** The map this one is drawn inside, or 0. */
  parent: number
  level: MapLevel
  /** Where it lies: null for a map on no continent Twinmap draws. */
  continent: Continent | null
  rect: Rect | null
  /** The game's area behind the map, or 0. */
  area: number
}

export function gameMaps(uiMap: Table, assignments: Table): GameMap[] {
  // ponytail: a map with several places in the world (only the whole-world map has two) keeps the first. Keep them all if a zone ever spans two.
  const placed = new Map<number, { continent: Continent | null; rect: Rect; area: number; order: number }>()
  for (const row of assignments.rows) {
    const id = row.int(UI_MAP), order = row.int(ORDER), world = row.int(WORLD)
    const before = placed.get(id)
    if (before && before.order <= order) continue
    placed.set(id, {
      continent: world === 0 || world === 1 ? world : null,
      rect: { minX: row.float(REGION, 0), minY: row.float(REGION, 1), maxX: row.float(REGION, 3), maxY: row.float(REGION, 4) },
      area: row.int(AREA),
      order,
    })
  }
  return uiMap.rows
    .map((row) => {
      const place = placed.get(row.id)
      return {
        id: row.id,
        name: row.text(NAME),
        parent: row.int(PARENT),
        level: LEVELS[row.int(TYPE)] ?? 'other',
        continent: place?.continent ?? null,
        rect: place?.rect ?? null,
        area: place?.area ?? 0,
      }
    })
    .sort((a, b) => a.id - b.id)
}
