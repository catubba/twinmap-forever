// The label on a point of the map: what it says of the point, and where it opens.
import { unitsOfRect, UNITS_PER_BLOCK, type Point } from './geo'
import type { Continent, GameMap, Rect } from './maps'
import { BLOCK_YARDS } from './world'

const YARDS_PER_UNIT = BLOCK_YARDS / UNITS_PER_BLOCK

/** A point of the map as a percent of a zone's map: the coordinates the game shows. The reverse of unitsOfPlace. */
export function placeOfUnits(rect: Rect, p: Point): Point {
  const [a, b] = unitsOfRect(rect)
  return { x: ((p.x - a.x) / (b.x - a.x)) * 100, y: ((p.y - a.y) / (b.y - a.y)) * 100 }
}

/** The zone a point is in. The maps of the zones overlap at their edges, and a city lies within its zone: the smallest wins. */
export function zoneAt(maps: GameMap[], continent: Continent, p: Point): { zone: GameMap; place: Point } | undefined {
  let best: { zone: GameMap; place: Point; size: number } | undefined
  for (const zone of maps) {
    if (zone.level !== 'zone' || zone.continent !== continent || !zone.rect) continue
    const place = placeOfUnits(zone.rect, p)
    if (place.x < 0 || place.x > 100 || place.y < 0 || place.y > 100) continue
    const size = (zone.rect.maxX - zone.rect.minX) * (zone.rect.maxY - zone.rect.minY)
    if (!best || size < best.size) best = { zone, place, size }
  }
  return best
}

const WAYS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
// ponytail: a straight line at a runner's pace. The real speed, mounts and roads come with the travel times (M7-F3).
const RUN = 7 // yards a second on foot

/** From one point of the map to another, as the label says it: "260 yd north-east", "0:37 on foot". */
export function wayTo(from: Point, to: Point): { far: string; time: string } {
  const dx = to.x - from.x, dy = to.y - from.y // y grows to the south
  const yards = Math.round(Math.hypot(dx, dy) * YARDS_PER_UNIT)
  const way = WAYS[((Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) % 8) + 8) % 8]!
  const seconds = Math.round(yards / RUN)
  return { far: `${yards.toLocaleString('en-US')} yd ${way}`, time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} on foot` }
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
