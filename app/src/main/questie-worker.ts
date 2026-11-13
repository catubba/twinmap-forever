// Opens the player's QuestieDB on a thread of its own (a third of a second that would stop the
// reading of the strip). The main process sends it what Questie shows (or, without Questie, the
// game's own log, from which the same is made here), and it answers with the pins; or what was typed in the search, and it answers with what it found.
import { parentPort, workerData } from 'node:worker_threads'
import type { GameQuest, QuestieShown, QuestsStatus } from '../shared/quests'
import type { Found } from '../shared/search'
import { doerIndex, fixedPins, openQuestie, questLog, questPins, search, searchIndex, shownFromLog } from './questie'

/** What the main process asks. */
export type Asked = { shown: QuestieShown } | { log: GameQuest[] } | { search: string; id: number }
/** The answer to a search, with the number it was asked with. */
export interface Answer { id: number; found: Found[] }

const db = openQuestie((workerData as { gameFolder: string }).gameFolder)
const tell = (status: QuestsStatus | Answer): void => parentPort?.postMessage(status)
tell({ questie: db?.version ?? null, pins: [], fixed: db ? fixedPins(db) : [] })
// The names to search, read once: twenty thousand items that nothing else decodes.
const index = db ? searchIndex(db) : []
const doers = db ? doerIndex(db) : []
parentPort?.on('message', (asked: Asked) => {
  if ('search' in asked) tell({ id: asked.id, found: db ? search(db, index, asked.search, undefined, doers) : [] })
  else if (db) {
    const shown = 'log' in asked ? shownFromLog(db, asked.log) : asked.shown
    tell({ questie: db.version, pins: questPins(db, shown), log: questLog(db, shown) })
  }
})
