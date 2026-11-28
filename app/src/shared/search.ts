// The search of the top row: what it finds, and how names are ranked against what was typed.
import { DUNGEON_PINS } from './dungeon-pins'
import type { InsidePlace } from './dungeon-trainers'
import type { Point } from './geo'
import type { Continent } from './maps'
import type { Travel } from './services'

/** A result from the player's QuestieDB: where it is, as a percent of the map of a zone. */
export interface Found {
  kind: 'npc' | 'quest' | 'item'
  name: string
  /** What it is, in a few words: "Innkeeper", "Quest, level 12", "Sold by Karm Ironquill". */
  note: string
  /** The zone, by the game's area number. */
  area: number
  x: number
  y: number
  /** One of many: found by what it does, not by its name ("first aid" finds who teaches it), or one of the sellers of an item. The window shows the nearest. */
  does?: true
  /** Whom an NPC found so serves: "A", "H" or "AH". */
  side?: string
  /** The item found, by the game's number: its picture is shown beside it. */
  item?: number
  /** An NPC inside a dungeon (dungeon-trainers.ts): its map and its place there. area, x and y are 0. */
  inside?: InsidePlace
}

/**
 * Whether a text answers what was typed word by word: each word typed starts a word of the text,
 * in any order. So "first aid" and "trainer first" both find "first aid trainer". Both folded.
 */
export function wordsMatch(text: string, typed: string): boolean {
  const words = text.split(' ')
  return typed.split(' ').every((wanted) => words.some((word) => word.startsWith(wanted)))
}

/**
 * A name as the search compares it: small letters, no apostrophes, anything that is not a letter or
 * a digit a space. So "wanted hogger" finds WANTED: "Hogger", and "khadgars" Khadgar's Whisker.
 */
export const fold = (name: string): string => name.toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * How well a name answers what was typed, the lower the better: it starts with it, one of its
 * words does, or it only has it somewhere. null: not at all. Both folded.
 */
export function rank(name: string, typed: string): number | null {
  const at = name.indexOf(typed)
  if (at < 0) return null
  if (at === 0) return 0
  return name.includes(` ${typed}`) ? 1 : 2
}

/** The best of the names (lower: the name folded), the best first: by rank, then the shorter (the closer to what was typed), then by the alphabet. */
export function best<T extends { name: string }>(entries: Iterable<T & { lower: string }>, typed: string, most: number): T[] {
  const wanted = fold(typed)
  if (!wanted) return []
  const hits: { entry: T; rank: number }[] = []
  for (const entry of entries) {
    const r = rank(entry.lower, wanted)
    if (r !== null) hits.push({ entry, rank: r })
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.entry.name.length - b.entry.name.length || (a.entry.name < b.entry.name ? -1 : a.entry.name > b.entry.name ? 1 : 0))
    .slice(0, most)
    .map((hit) => hit.entry)
}

/** A dungeon or a raid the search finds by its name: its map, the wing when it is one of several on that map, and its door on the world map. */
export interface Dungeon {
  name: string
  /** The game's number of its map. */
  id: number
  wing?: string
  raid: boolean
  continent: Continent
  at: Point
}

/**
 * Every dungeon and raid behind the doors of the world map, by the game's names, and the wings of
 * the ones that have several on one map (Scarlet Monastery: Armory), by the names of the pins. Once
 * each, at its first door; a wing with a door of its own (Dire Maul: North) at that door.
 */
export function dungeonsOf(doors: Travel['doors']): Dungeon[] {
  const all: Dungeon[] = []
  const placeOf = (door: Travel['doors'][number]) => ({ continent: door.continent, at: { x: door.x, y: door.y } })
  for (const door of doors) {
    door.maps?.forEach((id, i) => {
      if (all.some((d) => d.id === id)) return
      const raid = door.raid === true
      all.push({ name: door.names[i] ?? door.names[0]!, id, raid, ...placeOf(door) })
      const wings = DUNGEON_PINS.filter((d) => d.map === id)
      if (wings.length > 1) for (const wing of wings) all.push({ name: wing.name, id, wing: wing.name, raid, ...placeOf(doors.find((d) => d.wing === wing.name && d.maps?.includes(id)) ?? door) })
    })
  }
  return all
}
