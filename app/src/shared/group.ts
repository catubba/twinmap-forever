// The companions of the group, as the addon tells them (addon/TwinmapForever/Group.lua).

export interface Companion {
  name: string
  /** The game's word for the class: "MAGE", "WARRIOR". */
  cls?: string
  role?: Role
  /** The zone map they are on and the percent of it, 0 to 100. Missing inside a dungeon or a raid: the game tells no place there. */
  map?: number
  x?: number
  y?: number
}

/** What a companion does in the group, where the group gave roles: tank, healer, damage. */
export type Role = 'T' | 'H' | 'D'

/** The colours companions are drawn in: none is the gold of the character's own arrow. */
export const COMPANION_COLOURS = ['#4cc9f0', '#ff6b9d', '#7ae582', '#ff9f43', '#b388ff'] as const

/**
 * A colour for each companion, by name: no two alike while the colours last (a group has four
 * companions, a raid more than there are colours), and who had one keeps it as others come and go.
 */
export function coloursFor(names: string[], before: ReadonlyMap<string, string> = new Map()): Map<string, string> {
  const out = new Map<string, string>()
  for (const name of names) if (before.has(name)) out.set(name, before.get(name)!)
  for (const name of names) {
    if (out.has(name)) continue
    const taken = new Set(out.values())
    out.set(name, COMPANION_COLOURS.find((c) => !taken.has(c)) ?? COMPANION_COLOURS[out.size % COMPANION_COLOURS.length]!)
  }
  return out
}

/**
 * The addon sends the group again every 30 seconds, changed or not. One that has not come for
 * longer is of a group the addon no longer tells of (the interface was reloaded alone): no one.
 */
export const GROUP_STALE = 45_000

/** The companions of a "group" section; none from anything else, or from one too old. */
export function groupFrom(section: unknown, age = 0): Companion[] {
  const list = (section as { list?: unknown } | undefined)?.list
  if (!Array.isArray(list) || age > GROUP_STALE) return []
  const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  return list.flatMap((entry: unknown): Companion[] => {
    const e = entry as { n?: unknown; c?: unknown; r?: unknown; m?: unknown; x?: unknown; y?: unknown } | null
    if (typeof e?.n !== 'string' || !e.n) return []
    const map = num(e.m), x = num(e.x), y = num(e.y)
    const placed = map !== undefined && x !== undefined && y !== undefined
    const role = e.r === 'T' || e.r === 'H' || e.r === 'D' ? e.r : undefined
    return [{ name: e.n, ...(typeof e.c === 'string' ? { cls: e.c } : {}), ...(role ? { role } : {}), ...(placed ? { map, x, y } : {}) }]
  })
}
