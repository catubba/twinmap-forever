// The quests on the map: the icons the addon tells of Questie, and the pins the app makes of them
// with the names of the player's own QuestieDB.
import type { FixedPin } from './services'

/** An icon Questie holds on the game's map: its quest, and its place in percent of the map of a zone. */
export interface QuestIcon {
  quest: number
  /** The zone, by the game's area number. */
  area: number
  x: number
  y: number
}
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

// The addon sends an icon as four whole numbers in a row: quest, area, x and y in hundredths of a percent.
function iconsFrom(v: unknown): QuestIcon[] {
  const flat: unknown[] = Array.isArray(v) ? v : [], out: QuestIcon[] = []
  for (let i = 0; i + 3 < flat.length; i += 4) {
    const quest = flat[i], area = flat[i + 1], x = flat[i + 2], y = flat[i + 3]
    if (Number.isInteger(quest) && Number.isInteger(area) && typeof x === 'number' && typeof y === 'number') out.push({ quest: quest as number, area: area as number, x: x / 100, y: y / 100 })
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
  return { icons: { available: iconsFrom(icons.a), turnin: iconsFrom(icons.t), objective: iconsFrom(icons.o) }, active }
}
