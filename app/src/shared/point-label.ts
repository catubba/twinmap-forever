// The label on a point of the map: what it says of the point, and where it opens.
import { unitsOfRect, UNITS_PER_BLOCK, type Point } from './geo'
import { distance, t } from './i18n'
import type { Position } from './game'
import type { Continent, GameMap, Rect } from './maps'
import { BLOCK_YARDS, BLOCKS } from './world'

const YARDS_PER_UNIT = BLOCK_YARDS / UNITS_PER_BLOCK

/** A point of the map as a percent of a zone's map: the coordinates the game shows. The reverse of unitsOfPlace. */
export function placeOfUnits(rect: Rect, p: Point): Point {
  const [a, b] = unitsOfRect(rect)
  return { x: ((p.x - a.x) / (b.x - a.x)) * 100, y: ((p.y - a.y) / (b.y - a.y)) * 100 }
}

// The zone of each chunk of a continent's land (main/zone-grid.ts), from the terrain itself, and the zones it holds.
const lands = new Map<Continent, { grid: Uint16Array; zones: Set<number> }>()
const CHUNKS = BLOCKS * 16 // to a side of a continent; a block is UNITS_PER_BLOCK units
/** Once a continent's zones.bin is read: zoneAt then trusts it over the maps of the zones. */
export const knowLand = (continent: Continent, grid: Uint16Array): void => void lands.set(continent, { grid, zones: new Set(grid) })

/**
 * The zone a point is in. The maps of the zones overlap, and a city lies within its zone: the smallest wins. On land
 * whose zone is known (knowLand), that zone: Mulgore's map reaches far into Feralas. Still a zone with no land of its
 * own, a city under the ground or a mountain (Undercity, Ironforge), wins where its map is.
 */
export function zoneAt(maps: GameMap[], continent: Continent, p: Point): { zone: GameMap; place: Point } | undefined {
  const holds = (zone: GameMap): zone is GameMap & { rect: Rect } => {
    if (zone.level !== 'zone' || zone.continent !== continent || !zone.rect) return false
    const place = placeOfUnits(zone.rect, p)
    return place.x >= 0 && place.x <= 100 && place.y >= 0 && place.y <= 100
  }
  const column = Math.floor((p.x / UNITS_PER_BLOCK) * 16), row = Math.floor((p.y / UNITS_PER_BLOCK) * 16)
  const known = lands.get(continent), land = known && column >= 0 && column < CHUNKS && row >= 0 && row < CHUNKS ? known.grid[row * CHUNKS + column] : 0
  const own = land ? maps.find((m) => m.id === land && holds(m)) : undefined
  let best: { zone: GameMap; place: Point; size: number } | undefined
  for (const zone of maps) {
    if (!holds(zone) || (own && zone !== own && known!.zones.has(zone.id))) continue
    const size = (zone.rect.maxX - zone.rect.minX) * (zone.rect.maxY - zone.rect.minY)
    if (!best || size < best.size) best = { zone, place: placeOfUnits(zone.rect, p), size }
  }
  return best
}

const WAYS = ['north', 'northEast', 'east', 'southEast', 'south', 'southWest', 'west', 'northWest'] as const
const RUN = 7 // yards a second on foot, for an addon that does not tell the speed

/** How fast the character goes, as the position tells: its speed, on foot or on a mount. */
export type Pace = Pick<Position, 'speed' | 'mount'>

/** The seconds a way of so many yards takes at a pace. */
export const secondsFor = (yards: number, pace?: Pace): number => yards / (pace?.speed || RUN)

/**
 * From one point of the map to another, as the label says it: "260 yd north-east", "0:37 on foot".
 * walked: the yards of the way on foot, where one is known; without it, the yards as the crow
 * flies. The direction is always the crow's: where the point lies, not where the way starts.
 * pace: the character's, from the position; the time is at its speed, on foot or mounted.
 */
export function wayTo(from: Point, to: Point, walked?: number, pace?: Pace): { far: string; time: string } {
  const dx = to.x - from.x, dy = to.y - from.y // y grows to the south
  const yards = Math.round(walked ?? Math.hypot(dx, dy) * YARDS_PER_UNIT)
  const way = WAYS[((Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) % 8) + 8) % 8]!
  const seconds = Math.round(secondsFor(yards, pace))
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  return { far: t(`map.way.${way}`, { far: distance(yards) }), time: t(pace?.mount ? 'map.way.mounted' : 'map.way.onFoot', { time }) }
}

/** A place on a zone's map as the game gives it, "42.3, 65.1"; after the name of the zone when one is given. */
export function placeText(place: Point, zone?: string): string {
  const x = place.x.toFixed(1), y = place.y.toFixed(1)
  return zone === undefined ? t('map.place.coords', { x, y }) : t('map.place.inZone', { zone, x, y })
}

export interface Size { width: number; height: number }

/**
 * Where the label goes: on the side of the point with the most room among those it fits on, a gap
 * away from it, and slid so it stays whole inside the map's frame. All in pixels of the map's box.
 */
export function labelPlace(point: Point, map: Size, label: Size, gap = 14, margin = 18): { left: number; top: number; side: 'right' | 'left' | 'below' | 'above' } {
  const room = { right: map.width - point.x, left: point.x, below: map.height - point.y, above: point.y }
  const sides = Object.keys(room) as (keyof typeof room)[]
  // On a narrow map the widest side may still be too narrow for the label: then it goes above or below.
  const fits = sides.filter((s) => room[s] >= (s === 'right' || s === 'left' ? label.width : label.height) + gap + margin)
  const side = (fits.length ? fits : sides).reduce((best, s) => (room[s] > room[best] ? s : best))
  const within = (v: number, most: number): number => Math.max(margin, Math.min(v, most - margin))
  const left = side === 'right' ? point.x + gap : side === 'left' ? point.x - gap - label.width : point.x - label.width / 2
  const top = side === 'below' ? point.y + gap : side === 'above' ? point.y - gap - label.height : point.y - label.height / 2
  return { side, left: within(left, map.width - label.width), top: within(top, map.height - label.height) }
}
