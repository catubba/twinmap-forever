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
