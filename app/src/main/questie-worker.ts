// Opens the player's QuestieDB on a thread of its own (a third of a second that would stop the
// reading of the strip). The main process sends it what Questie shows (or, without Questie, the
// game's own log, from which the same is made here), and it answers with the pins; or what was typed in the search, and it answers with what it found.
import { parentPort, workerData } from 'node:worker_threads'
import type { GameQuest, QuestieShown, QuestsStatus } from '../shared/quests'
import type { Found } from '../shared/search'
import type { ItemSources } from '../shared/tips'
import { readFileSync } from 'node:fs'
import type { GameMap } from '../shared/maps'
import { ABOUT_NPC, type Ask } from './gamelog'
import { setLang } from '../shared/i18n'
import { doerIndex, fixedPins, itemSources, metWhereQuestieSays, openQuestie, placed, questLog, questPins, search, searchIndex, shownFromLog } from './questie'

/** What the main process asks. */
export type Asked = { shown: QuestieShown } | { log: GameQuest[] } | { search: string; id: number } | { sources: number; id: number } | { placed: Ask[]; id: number; maps: string | null }
/** The answer to a search, with the number it was asked with. */
export interface Answer { id: number; found: Found[] }
/** Who sells, drops or holds an item, with the number it was asked with. */
export interface Sources { id: number; sources: ItemSources }
/** For each thing asked, whether QuestieDB has it with a place; all of them without QuestieDB, which cannot tell what is missing. */
export interface Placed { id: number; placed: boolean[] }

// A thread of its own speaks no language until told: the one of the app as it started the thread.
setLang((workerData as { lang?: string }).lang)
const db = openQuestie((workerData as { gameFolder: string }).gameFolder)
// The game's maps, to measure where an NPC was met against QuestieDB (M15-F24): read once for each build's file.
let maps: { file: string; read: GameMap[] | null } | null = null
const mapsOf = (file: string | null): GameMap[] | null => {
  if (!file) return null
  if (maps?.file !== file) {
    try {
      maps = { file, read: JSON.parse(readFileSync(file, 'utf8')) as GameMap[] }
    } catch {
      maps = { file, read: null }
    }
  }
  return maps.read
}
const tell = (status: QuestsStatus | Answer | Sources | Placed): void => parentPort?.postMessage(status)
tell({ questie: db?.version ?? null, pins: [], fixed: db ? fixedPins(db) : [] })
// The names to search, read once: twenty thousand items that nothing else decodes.
const index = db ? searchIndex(db) : []
const doers = db ? doerIndex(db) : []
parentPort?.on('message', (asked: Asked) => {
  if ('search' in asked) tell({ id: asked.id, found: db ? search(db, index, asked.search, undefined, doers) : [] })
  else if ('placed' in asked) {
    const maps = mapsOf(asked.maps)
    const of = (kind: string): string => (ABOUT_NPC.includes(kind) ? 'npc' : kind)
    tell({ id: asked.id, placed: asked.placed.map(([kind, id, ...rest]) => !db || (kind === 'talk' ? metWhereQuestieSays(db, id, rest as number[], maps) : placed(db, of(kind), id))) })
  }
  else if ('sources' in asked) tell({ id: asked.id, sources: db ? itemSources(db, asked.sources) : { sold: [], drops: [], found: [] } })
  else if (db) {
    const shown = 'log' in asked ? shownFromLog(db, asked.log) : asked.shown
    tell({ questie: db.version, pins: questPins(db, shown), log: questLog(db, shown) })
  }
})
