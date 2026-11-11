// The quests on the map: what the addon tells of Questie, and the pins the app makes of it with
// the places of the player's own QuestieDB.
import type { FixedPin } from './services'

/** What Questie is showing in the game, as the addon sends it: numbers only. */
export interface QuestieShown {
  /** The quests marked as there to take. */
  available: number[]
  /** Whoever drops a thing that starts a quest is marked too: a switch of Questie's own. */
  items: boolean
  active: ActiveQuest[]
}
/** A quest in the log. */
export interface ActiveQuest {
  id: number
  /** Ready to hand in. */
  done: boolean
  /** Something to do at a place, not someone to find. */
  event: boolean
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
  /** Who or what is there; the quest's own name for a place where something is to be done. */
  name: string
  /** The quests it is there for. */
  quests: string[]
}

/** What the main process tells the window: whether the player has Questie's data, and the pins. */
export interface QuestsStatus {
  /** QuestieDB's version, or null when the player has none. */
  questie: string | null
  pins: QuestPin[]
  /** Services, ore and herbs: told once, when the QuestieDB is opened, since they do not change. */
  fixed?: FixedPin[]
}

const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : [])

/** The section as it came off the strip, checked: anything that is not what the addon sends is left out. */
export function shownFrom(section: unknown): QuestieShown {
  const told = (typeof section === 'object' && section ? section : {}) as Record<string, unknown>
  const active = (Array.isArray(told.active) ? told.active : []).flatMap((q: unknown): ActiveQuest[] => {
    const quest = (typeof q === 'object' && q ? q : {}) as Record<string, unknown>
    if (!Number.isInteger(quest.id)) return []
    const targets = Array.isArray(quest.targets) ? quest.targets.filter((t): t is string => typeof t === 'string') : []
    return [{ id: quest.id as number, done: quest.done === true, event: quest.event === true, targets }]
  })
  return { available: ids(told.available), items: told.items === true, active }
}
