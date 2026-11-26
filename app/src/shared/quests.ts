// The quests on the map: the icons the addon tells of Questie, and the pins the app makes of them
// with the names of the player's own QuestieDB.
import { gathered } from './geo'
import type { FixedPin } from './services'

/** An icon Questie holds on the game's map: its quest, and its place in percent of the map of a zone. */
export interface QuestIcon {
  quest: number
  /** The zone, by the game's area number. */
  area: number
  x: number
  y: number
  /** For an objective: what it asks for. Not told by an addon older than this, nor for a kind it does not know. */
  kind?: ObjectiveKind
}
/** What an objective asks for there: a creature to slay, a thing to loot, an object to use, something to see happen, someone to talk to. */
export type ObjectiveKind = 'slay' | 'loot' | 'object' | 'event' | 'talk'
/** What Questie is showing in the game, as the addon sends it: numbers only. */
export interface QuestieShown {
  /** Its icons, as it draws them: its own limits, filters and switches are already in them. */
  icons: Record<QuestPinType, QuestIcon[]>
  active: ActiveQuest[]
}
/** A quest in the log. */
export interface ActiveQuest {
  id: number
  /** Ready to hand in. */
  done: boolean
  /** Who or what still has to be found, as Questie names them: "m_117" a creature, "o_42" an object. */
  targets: string[]
}

export type QuestPinType = 'available' | 'turnin' | 'objective'
/** One pin: a place in percent of the map of a zone, the zone by the game's area number. */
export interface QuestPin {
  type: QuestPinType
  area: number
  x: number
  y: number
  /** For an objective: what it asks for, where the addon told. */
  kind?: ObjectiveKind
  /** Who or what is there; the quest's own name for a place where something is to be done. */
  name: string
  /** The quests it is there for. */
  quests: string[]
  /** What each of them gives, by its line in quests: missing where nothing is known. */
  rewards?: Record<string, QuestReward>
}

/** Objectives laid as one pin: where, which, what they ask for, the quests they are for, and whether they are lit. */
export interface ObjectiveGroup<T> {
  x: number
  y: number
  of: T[]
  kind?: ObjectiveKind
  quests: string[]
  lit: boolean
}
/**
 * The objectives as the map lays them: those within reach of each other that ask for the same thing are one pin in
 * their middle, as the quests seen from far are (gathered). front: a quest picked in the Now column, or null; its
 * objectives are gathered on their own and lit, every other one is dim.
 */
export function objectiveGroups<T extends { x: number; y: number; p: QuestPin }>(placed: T[], reach: number, front: string | null): ObjectiveGroup<T>[] {
  const sets = new Map<string, T[]>()
  for (const q of placed) {
    const key = `${q.p.kind ?? ''} ${front === null || q.p.quests.includes(front)}`
    sets.set(key, [...(sets.get(key) ?? []), q])
  }
  return [...sets].flatMap(([key, of]) =>
    gathered(of, reach).map((g) => ({ ...g, kind: of[0]!.p.kind, quests: [...new Set(g.of.flatMap((q) => q.p.quests))], lit: key.endsWith('true') })),
  )
}

type Spot = { x: number; y: number }
/** Where a quest's objectives are, as the game's map draws an area: rings of points (an area may be in pieces, and have holes). */
export interface ObjectiveArea {
  quest: string
  rings: Spot[][]
}
/**
 * The objectives as areas (M21-F5); the game's own are the server's and never told to an addon. For each quest, all
 * the ground within reach of one of its places, traced on a grid of cells (marching squares): places near each other
 * make one area that follows them, a place alone a round one.
 */
export function objectiveAreas(placed: { x: number; y: number; p: QuestPin }[], reach: number, cell: number): ObjectiveArea[] {
  const quests = [...new Set(placed.flatMap((q) => q.p.quests))]
  return quests.map((quest) => ({ quest, rings: outline(placed.filter((q) => q.p.quests.includes(quest)), reach, cell) }))
}
/** The edge of the ground within reach of some of the points, as closed rings. */
function outline(points: Spot[], reach: number, cell: number): Spot[][] {
  const margin = reach + 2 * cell
  const x0 = Math.min(...points.map((p) => p.x)) - margin, y0 = Math.min(...points.map((p) => p.y)) - margin
  const nx = Math.ceil((Math.max(...points.map((p) => p.x)) + margin - x0) / cell) + 1, ny = Math.ceil((Math.max(...points.map((p) => p.y)) + margin - y0) / cell) + 1
  // How far inside each corner of the grid is: reach less the way to the nearest point, under 0 outside.
  const inside = new Float64Array(nx * ny).fill(-reach)
  const span = Math.ceil(reach / cell) + 1
  for (const p of points) {
    const ci = Math.round((p.x - x0) / cell), cj = Math.round((p.y - y0) / cell)
    for (let j = Math.max(0, cj - span); j <= Math.min(ny - 1, cj + span); j++)
      for (let i = Math.max(0, ci - span); i <= Math.min(nx - 1, ci + span); i++) {
        const v = reach - Math.hypot(x0 + i * cell - p.x, y0 + j * cell - p.y)
        if (v > inside[j * nx + i]!) inside[j * nx + i] = v
      }
  }
  const at = (i: number, j: number): number => inside[j * nx + i]!
  // Where the edge crosses the side of a cell between two corners, as a key and a point: h from (i, j) east, v south.
  const cross = (i: number, j: number, side: 'h' | 'v'): [string, Spot] => {
    const [a, b] = side === 'h' ? [at(i, j), at(i + 1, j)] : [at(i, j), at(i, j + 1)], t = a / (a - b)
    return [`${i},${j}${side}`, side === 'h' ? { x: x0 + (i + t) * cell, y: y0 + j * cell } : { x: x0 + i * cell, y: y0 + (j + t) * cell }]
  }
  const ends = new Map<string, string[]>(), spots = new Map<string, Spot>()
  const join = (a: [string, Spot], b: [string, Spot]): void => {
    for (const [k, s] of [a, b]) spots.set(k, s)
    ends.set(a[0], [...(ends.get(a[0]) ?? []), b[0]])
    ends.set(b[0], [...(ends.get(b[0]) ?? []), a[0]])
  }
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const top = cross(i, j, 'h'), bottom = cross(i, j + 1, 'h'), left = cross(i, j, 'v'), right = cross(i + 1, j, 'v')
      const corners = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)].map((v) => v > 0)
      // The sides the edge crosses, in order round the cell: top, right, bottom, left.
      const crossed = [top, right, bottom, left].filter((_, k) => corners[k] !== corners[(k + 1) % 4])
      if (crossed.length === 2) join(crossed[0]!, crossed[1]!)
      // Two corners inside across from each other: kept apart (the top left one joined to its two sides).
      else if (crossed.length === 4) {
        join(crossed[corners[0] ? 3 : 0]!, crossed[corners[0] ? 0 : 1]!)
        join(crossed[corners[0] ? 1 : 2]!, crossed[corners[0] ? 2 : 3]!)
      }
    }
  const rings: Spot[][] = [], walked = new Set<string>()
  for (const start of ends.keys()) {
    if (walked.has(start)) continue
    const ring: Spot[] = []
    for (let k: string | undefined = start; k && !walked.has(k); k = ends.get(k)!.find((n) => !walked.has(n))) {
      walked.add(k)
      ring.push(spots.get(k)!)
    }
    rings.push(ring)
  }
  return rings
}

/** What a quest gives: its XP at the level QuestieDB has it for, and the money the game's cache tells (copper). */
export interface QuestReward {
  level?: number
  xp?: number
  copper?: number
}

// ponytail: Questie's own reckoning (from CMaNGOS), its rounding included, so that the two show the same; Forever's own
// multipliers of a quest (the game's cache has them) are not read.
/** A quest's XP for a character: less for a quest under it, rounded as the game rounds it. */
export function questXp(base: number, questLevel: number, level: number): number {
  const v = (base * Math.min(10, Math.max(1, 2 * (questLevel - level) + 20))) / 10
  return v <= 100 ? 5 * Math.floor((v + 2) / 5) : v <= 500 ? 10 * Math.floor((v + 5) / 10) : v <= 1000 ? 25 * Math.floor((v + 12) / 25) : 50 * Math.floor((v + 25) / 50)
}

/**
 * Whether a quest's XP drops soon for a character (questXp: whole while the quest is at most five levels under it):
 * 'less' when it gives less already, the level it drops at when that is the next level or the one after, else null.
 */
export function xpDrop(questLevel: number, level: number): 'less' | number | null {
  const at = questLevel + 6
  return level >= at ? 'less' : at - level <= 2 ? at : null
}

/** A quest of the log, by the name its pins carry. */
export interface LogQuest {
  name: string
  /** Ready to hand in. */
  done: boolean
}

/** What the main process tells the window: whether the player has Questie's data, the pins and the log. */
export interface QuestsStatus {
  /** QuestieDB's version, or null when the player has none. */
  questie: string | null
  pins: QuestPin[]
  /** Every quest of the log, with or without a pin: told with the pins, once the game has spoken. */
  log?: LogQuest[]
  /** Services, ore and herbs: told once, when the QuestieDB is opened, since they do not change. */
  fixed?: FixedPin[]
}

/** A quest of the game's own log, as the addon sends it where Questie is not running. */
export interface GameQuest {
  id: number
  /** Ready to hand in. */
  done: boolean
  /** Its objectives in the game's order. kind: 1 a creature, 2 an object, 3 an item, 0 anything else. */
  objectives: { kind: number; done: boolean }[]
}

/** The section of the game's own log as it came off the strip, checked. null: the addon sent none, Questie is running. */
export function logFrom(section: unknown): GameQuest[] | null {
  if (typeof section !== 'object' || !section) return null
  const rows = (section as Record<string, unknown>).log
  return (Array.isArray(rows) ? rows : []).flatMap((q: unknown): GameQuest[] => {
    const quest = (typeof q === 'object' && q ? q : {}) as Record<string, unknown>
    if (!Number.isInteger(quest.id)) return []
    // Two numbers an objective: its kind, and 1 when it is done.
    const flat: unknown[] = Array.isArray(quest.o) ? quest.o : [], objectives: GameQuest['objectives'] = []
    for (let i = 0; i + 1 < flat.length; i += 2) objectives.push({ kind: typeof flat[i] === 'number' ? (flat[i] as number) : 0, done: flat[i + 1] === 1 })
    return [{ id: quest.id as number, done: quest.done === true, objectives }]
  })
}

// The letter the addon sends for what an objective asks for. To interact with a thing is to use an object.
const KINDS: Record<string, ObjectiveKind> = { s: 'slay', l: 'loot', o: 'object', i: 'object', e: 'event', t: 'talk' }

// The addon sends an icon as four whole numbers in a row: quest, area, x and y in hundredths of a
// percent. kinds: for the objectives, a letter for each icon in the same order.
function iconsFrom(v: unknown, kinds?: unknown): QuestIcon[] {
  const flat: unknown[] = Array.isArray(v) ? v : [], out: QuestIcon[] = []
  for (let i = 0; i + 3 < flat.length; i += 4) {
    const quest = flat[i], area = flat[i + 1], x = flat[i + 2], y = flat[i + 3]
    const kind = typeof kinds === 'string' ? KINDS[kinds[i / 4] ?? ''] : undefined
    if (Number.isInteger(quest) && Number.isInteger(area) && typeof x === 'number' && typeof y === 'number') out.push({ quest: quest as number, area: area as number, x: x / 100, y: y / 100, ...(kind && { kind }) })
  }
  return out
}

/** The section as it came off the strip, checked: anything that is not what the addon sends is left out. */
export function shownFrom(section: unknown): QuestieShown {
  const told = (typeof section === 'object' && section ? section : {}) as Record<string, unknown>
  const icons = (typeof told.icons === 'object' && told.icons ? told.icons : {}) as Record<string, unknown>
  const active = (Array.isArray(told.active) ? told.active : []).flatMap((q: unknown): ActiveQuest[] => {
    const quest = (typeof q === 'object' && q ? q : {}) as Record<string, unknown>
    if (!Number.isInteger(quest.id)) return []
    const targets = Array.isArray(quest.targets) ? quest.targets.filter((t): t is string => typeof t === 'string') : []
    return [{ id: quest.id as number, done: quest.done === true, targets }]
  })
  return { icons: { available: iconsFrom(icons.a), turnin: iconsFrom(icons.t), objective: iconsFrom(icons.o, icons.k) }, active }
}
