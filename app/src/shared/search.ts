// The search of the top row: what it finds, and how names are ranked against what was typed.

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
