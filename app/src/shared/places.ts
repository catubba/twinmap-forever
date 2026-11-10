// The names written over the map: towns, points of interest and the areas of each zone, from the
// game's own tables, and which of them show at a zoom without one covering another.
//
// Where the game keeps them (read on build 1.60.1.70862):
// - AreaPOI: a town or a point of interest, with its place in the world in yards. The row it
//   belongs to is its continent. Importance 3 is a town.
// - WorldMapOverlay: a part of a zone's map that lights up when explored, as a box in the pixels of
//   the map's picture, with the areas it stands for. UiMapXMapArt ties the picture to the map, and
//   AreaTable gives an area its name.
import { unitsOfPlace, unitsOfWorld } from './geo'
import type { Continent, GameMap } from './maps'
import { zoneAt } from './point-label'
import type { Table } from './wdc5'

export const AREA_TABLE_FILE = 1353545
export const AREA_POI_FILE = 1000630
export const WORLD_MAP_OVERLAY_FILE = 1134579
export const UI_MAP_X_MAP_ART_FILE = 1957217

const ART_WIDTH = 1002, ART_HEIGHT = 668 // the picture of a zone's map, in the pixels overlays are measured in
const TOWN = 3 // the importance of a town among the points of interest

/** A named place on a continent, in map units (geo.ts). */
export interface Place {
  name: string
  kind: 'town' | 'poi' | 'area'
  continent: Continent
  x: number
  y: number
}

export function places(poi: Table, overlays: Table, arts: Table, areas: Table, maps: GameMap[]): Place[] {
  const out: Place[] = []
  const taken = new Set<string>() // names already placed on a continent: one place each

  // A name the table gives to many points is a marker of the game's, not a place.
  const times = new Map<string, number>()
  for (const r of poi.rows) times.set(r.text(0), (times.get(r.text(0)) ?? 0) + 1)
  for (const r of poi.rows) {
    const name = r.text(0), continent = r.parent
    if (!name || (times.get(name) ?? 0) > 2 || (continent !== 0 && continent !== 1)) continue
    const at = unitsOfWorld(r.float(3, 0), r.float(3, 1))
    if (!zoneAt(maps, continent, at) || taken.has(`${continent}:${name}`)) continue // off every map we draw
    taken.add(`${continent}:${name}`)
    out.push({ name, kind: r.int(20) === TOWN ? 'town' : 'poi', continent, x: at.x, y: at.y })
  }

  const names = new Map<number, string>()
  for (const r of areas.rows) names.set(r.id, r.text(1))
  const mapOfArt = new Map<number, number>()
  for (const r of arts.rows) if (r.parent !== undefined) mapOfArt.set(r.int(1), r.parent)
  const zoneNames = new Set(maps.map((m) => m.name))
  for (const r of overlays.rows) {
    const zone = maps.find((m) => m.id === mapOfArt.get(r.parent ?? -1))
    if (!zone?.rect || zone.continent === null || zone.level !== 'zone') continue
    // An overlay can stand for several areas at one spot: the first is the one the game shows.
    const name = names.get(r.int(12, 0))
    // A point of the same name is the better place for it; a zone's own name is written by the zone.
    if (!name || zoneNames.has(name) || taken.has(`${zone.continent}:${name}`)) continue
    taken.add(`${zone.continent}:${name}`)
    const at = unitsOfPlace(zone.rect, ((r.int(4) + r.int(2) / 2) / ART_WIDTH) * 100, ((r.int(5) + r.int(3) / 2) / ART_HEIGHT) * 100)
    out.push({ name, kind: 'area', continent: zone.continent, x: at.x, y: at.y })
  }
  return out
}

/**
 * The kinds of name on the map, the most important first, and the zooms each shows at (from, up
 * to but not). The continent has no name on it: the whole of it is on show, and its button says which.
 */
export const NAME_TIERS = {
  region: [0, 5],
  town: [4, 8],
  poi: [5, 99],
  area: [5.5, 99],
} as const
export type NameTier = keyof typeof NAME_TIERS
const ORDER = Object.keys(NAME_TIERS) as NameTier[]
export const tierShows = (tier: NameTier, zoom: number): boolean => zoom >= NAME_TIERS[tier][0] && zoom < NAME_TIERS[tier][1]
export const tierRank = (tier: NameTier): number => ORDER.indexOf(tier)

/** A name as it would lie on the screen: its middle and its size, in pixels. */
export interface NameBox { id: number; x: number; y: number; width: number; height: number }
export interface Avoid { left: number; top: number; right: number; bottom: number }

/**
 * Which names fit: taken in the order given (the most important first), a name is shown unless it
 * would touch one already shown or something to keep clear, such as the character's arrow.
 */
export function fitNames(boxes: NameBox[], avoid: Avoid[] = [], gap = 6): Set<number> {
  const kept: Avoid[] = [...avoid], shown = new Set<number>()
  for (const b of boxes) {
    const box = { left: b.x - b.width / 2 - gap, right: b.x + b.width / 2 + gap, top: b.y - b.height / 2 - gap / 2, bottom: b.y + b.height / 2 + gap / 2 }
    if (kept.some((k) => box.left < k.right && box.right > k.left && box.top < k.bottom && box.bottom > k.top)) continue
    kept.push(box)
    shown.add(b.id)
  }
  return shown
}
