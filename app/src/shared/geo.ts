// From a place the game tells (a percent of a zone's map) to a point of the map the app draws.
//
// The map's own units are the pixels of zoom 0, where the whole square of 64 x 64 blocks is one
// tile of 256 pixels: a block is 4 units, x to the right (east), y down (south). At zoom 7 a unit
// is 128 pixels, and a pixel is about a yard.
import type { Rect } from './maps'
import { BLOCK_YARDS, BLOCKS } from './world'

export const UNITS_PER_BLOCK = 256 / BLOCKS

export interface Point { x: number; y: number }

/** World yards (x north, y west) to map units. */
export function unitsOfWorld(x: number, y: number): Point {
  return { x: (BLOCKS / 2 - y / BLOCK_YARDS) * UNITS_PER_BLOCK, y: (BLOCKS / 2 - x / BLOCK_YARDS) * UNITS_PER_BLOCK }
}

/** A place given in percent of a zone's map (0 to 100, from its top left) to map units. */
export function unitsOfPlace(rect: Rect, percentX: number, percentY: number): Point {
  return unitsOfWorld(rect.maxX - (percentY / 100) * (rect.maxX - rect.minX), rect.maxY - (percentX / 100) * (rect.maxY - rect.minY))
}

/** The corners of a zone's map in map units: top left, bottom right. */
export function unitsOfRect(rect: Rect): [Point, Point] {
  return [unitsOfPlace(rect, 0, 0), unitsOfPlace(rect, 100, 100)]
}

/**
 * Points gathered where they lie close: each joins the first group whose middle is within reach of it, or
 * starts one. A group stands in the middle of its points. For the pins of a kind seen from far, which
 * would lie on each other: one is shown for the lot.
 */
// ponytail: greedy, in the order given, so which group a point between two joins depends on that order. Fine for a few dozen pins; a real clustering if they are ever thousands.
export function gathered<T extends { x: number; y: number }>(points: T[], reach: number): { x: number; y: number; of: T[] }[] {
  const groups: { x: number; y: number; of: T[] }[] = []
  for (const p of points) {
    const near = groups.find((g) => Math.hypot(g.x - p.x, g.y - p.y) <= reach)
    if (!near) groups.push({ x: p.x, y: p.y, of: [p] })
    else {
      near.of.push(p)
      near.x += (p.x - near.x) / near.of.length
      near.y += (p.y - near.y) / near.of.length
    }
  }
  return groups
}

/**
 * A point moved, as little as it takes, to stand at least so far from each of the others: for a pin that stands
 * for several and may be anywhere near them, so that it does not lie on another pin.
 */
// ponytail: pushed off the nearest that is too close, a few times over; among many crowded pins it may still touch one. A proper layout if that shows.
export function clearOf(p: { x: number; y: number }, others: { x: number; y: number }[], least: number): { x: number; y: number } {
  let at = { x: p.x, y: p.y }
  for (let pass = 0; pass < 8; pass++) {
    const near = others.map((o) => ({ o, far: Math.hypot(at.x - o.x, at.y - o.y) })).filter((n) => n.far < least - 1e-9).sort((a, b) => a.far - b.far)[0]
    if (!near) break
    // Away from it, the way the point already lies from it; east when it is right on it.
    const dx = near.far ? (at.x - near.o.x) / near.far : 1, dy = near.far ? (at.y - near.o.y) / near.far : 0
    at = { x: near.o.x + dx * least, y: near.o.y + dy * least }
  }
  return at
}
