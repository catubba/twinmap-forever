// My pins: points the player saved, each with a name. They are kept from one run of the app to the
// next, and shown on the map as a layer of their own.
import { unitsOfPlace, type Point } from './geo'
import type { Continent, GameMap } from './maps'
import { zoneAt } from './point-label'
import { stopFrom, type Stop } from './route'

/** A saved pin is a point as a stop of the route is: a name, a place, and the same place as the game names it. */
export type SavedPin = Stop

export const MAX_PINS = 200
const NAME_MAX = 60

/** The pins as they were saved; none where nothing readable is there. */
export function savedFrom(saved: string | null): SavedPin[] {
  try {
    const read: unknown = JSON.parse(saved ?? '')
    if (!Array.isArray(read)) return []
    return read.map(stopFrom).filter((p): p is SavedPin => p !== null).slice(0, MAX_PINS)
  } catch {
    return []
  }
}

const same = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6
/** Which of the pins is on this very point, or -1. */
export const savedAt = (pins: SavedPin[], continent: Continent, at: Point): number => pins.findIndex((p) => p.continent === continent && same(p.at, at))

const named = (name: string): string => name.trim().slice(0, NAME_MAX)

/** One pin more. A point already saved, or past the limit, changes nothing. */
export function savePin(pins: SavedPin[], pin: SavedPin): SavedPin[] {
  if (pins.length >= MAX_PINS || savedAt(pins, pin.continent, pin.at) >= 0) return pins
  return [...pins, { ...pin, name: named(pin.name) || 'Pin' }]
}

/** A pin under another name. An empty name is no name: the old one stays. */
export function renamePin(pins: SavedPin[], index: number, name: string): SavedPin[] {
  const to = named(name)
  if (!pins[index] || !to || to === pins[index].name) return pins
  return pins.map((p, i) => (i === index ? { ...p, name: to } : p))
}

export const removePin = (pins: SavedPin[], index: number): SavedPin[] => (pins[index] ? pins.filter((_, i) => i !== index) : pins)

/**
 * A mark set in the game as a pin to save: the same point on Twinmap's map, named as a bare point
 * of the map is, by its zone and its place there. null where it was set on a map Twinmap does not draw.
 */
export function pinOfMark(maps: GameMap[], mark: { m: number; x: number; y: number; name: string }): SavedPin | null {
  const on = maps.find((map) => map.id === mark.m)
  if (!on || on.continent === null || !on.rect) return null
  const at = unitsOfPlace(on.rect, mark.x, mark.y), found = zoneAt(maps, on.continent, at)
  return {
    name: found ? `${found.zone.name} ${found.place.x.toFixed(1)}, ${found.place.y.toFixed(1)}` : mark.name,
    continent: on.continent,
    at,
    pin: found ? { m: found.zone.id, x: found.place.x, y: found.place.y } : null,
  }
}
