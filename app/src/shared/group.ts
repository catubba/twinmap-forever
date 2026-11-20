// The companions of the group, as the addon tells them (addon/TwinmapForever/Group.lua).

import { CLASS_COLORS } from './characters'

export interface Companion {
  name: string
  /** The game's word for the class: "MAGE", "WARRIOR". */
  cls?: string
  role?: Role
  /** The zone map they are on and the percent of it, 0 to 100. Missing inside a dungeon or a raid: the game tells no place there. */
  map?: number
  x?: number
  y?: number
  /** Inside a dungeon or a raid, where their own Twinmap found them: the instance, and the yards of the world, x to the north and y to the west. */
  inst?: number
  wx?: number
  wy?: number
}

/** What a companion does in the group, where the group gave roles: tank, healer, damage. */
export type Role = 'T' | 'H' | 'D'

/** The colours of companions whose class the game did not tell: none is the gold of the character's own arrow. */
export const COMPANION_COLOURS = ['#4cc9f0', '#ff6b9d', '#7ae582', '#ff9f43', '#b388ff'] as const

/**
 * A colour for each companion, by name: the colour the game gives their class, as players expect.
 * Without a class, one of COMPANION_COLOURS: no two alike while the colours last (a raid has more
 * companions than there are colours), and who had one keeps it as others come and go.
 */
export function coloursFor(group: Pick<Companion, 'name' | 'cls'>[], before: ReadonlyMap<string, string> = new Map()): Map<string, string> {
  const out = new Map<string, string>()
  for (const { name, cls } of group) if (cls && CLASS_COLORS[cls]) out.set(name, CLASS_COLORS[cls])
  const names = group.map((c) => c.name)
  for (const name of names) if (!out.has(name) && (COMPANION_COLOURS as readonly string[]).includes(before.get(name)!)) out.set(name, before.get(name)!)
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
    const e = entry as { n?: unknown; c?: unknown; r?: unknown; m?: unknown; x?: unknown; y?: unknown; i?: unknown; wx?: unknown; wy?: unknown } | null
    if (typeof e?.n !== 'string' || !e.n) return []
    const map = num(e.m), x = num(e.x), y = num(e.y)
    const placed = map !== undefined && x !== undefined && y !== undefined
    const inst = num(e.i), wx = num(e.wx), wy = num(e.wy)
    const inside = inst !== undefined && wx !== undefined && wy !== undefined
    const role = e.r === 'T' || e.r === 'H' || e.r === 'D' ? e.r : undefined
    return [{ name: e.n, ...(typeof e.c === 'string' ? { cls: e.c } : {}), ...(role ? { role } : {}), ...(placed ? { map, x, y } : {}), ...(inside ? { inst, wx, wy } : {}) }]
  })
}
