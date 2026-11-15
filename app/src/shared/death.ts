// A death of the character, as the addon tells it (addon/TwinmapForever/Death.lua): where the
// corpse lies, where the ghost came back, and where to walk to live again.
import { unitsOfPlace, type Point } from './geo'
import type { Continent, GameMap } from './maps'
import type { Travel } from './services'

/** A place as the game tells it: a map and percent of it. */
interface Spot { map: number; x: number; y: number }

export interface Death {
  /** Released: a ghost, walking back. */
  ghost: boolean
  /** Where the game shows the corpse. Missing in a dungeon, where the game shows none. */
  corpse?: Spot
  /** The dungeon or raid the character died in: the ghost lives again at its door. */
  inst?: number
  /** Where the ghost first stood: the graveyard. */
  yard?: Spot
}

/** The addon tells a death again every 30 seconds: one not told for longer is of a game gone, or long over. */
export const DEATH_STALE = 45_000

const spotOf = (v: unknown): Spot | undefined => {
  const s = v as Partial<Spot> | null
  return typeof s?.map === 'number' && typeof s.x === 'number' && typeof s.y === 'number' ? { map: s.map, x: s.x, y: s.y } : undefined
}

/** The death a "dead" section tells, or null: alive, or a section too old or not readable. */
export function deathFrom(section: unknown, age = 0): Death | null {
  const s = section as { dead?: unknown; ghost?: unknown; corpse?: unknown; inst?: unknown; yard?: unknown } | undefined
  if (s?.dead !== true || age > DEATH_STALE) return null
  const corpse = spotOf(s.corpse), yard = spotOf(s.yard), inst = typeof s.inst === 'number' ? s.inst : undefined
  return { ghost: s.ghost === true, ...(corpse ? { corpse } : {}), ...(inst !== undefined ? { inst } : {}), ...(yard ? { yard } : {}) }
}

export interface Place { continent: Continent; at: Point }
const placeOf = (maps: GameMap[], spot: Spot | undefined): Place | null => {
  const on = spot && maps.find((m) => m.id === spot.map)
  return on?.rect && on.continent !== null ? { continent: on.continent, at: unitsOfPlace(on.rect, spot!.x, spot!.y) } : null
}

/**
 * Where the ghost goes to live again: the corpse, or the door of the dungeon it lies in. And the
 * graveyard it came back at. Either is null when the app cannot place it.
 */
export function deathPlaces(death: Death, maps: GameMap[], doors: Travel['doors']): { back: (Place & { name: string; door: boolean }) | null; yard: Place | null } {
  const door = death.inst === undefined ? undefined : doors.find((d) => d.maps?.includes(death.inst!))
  const corpse = placeOf(maps, death.corpse)
  const back = door ? { continent: door.continent, at: { x: door.x, y: door.y }, name: door.names[door.maps!.indexOf(death.inst!)] ?? door.names[0]!, door: true } : corpse && { ...corpse, name: 'Your corpse', door: false }
  return { back, yard: placeOf(maps, death.yard) }
}
