// Opens the player's QuestieDB on a thread of its own (a third of a second that would stop the
// reading of the strip). The main process sends it what Questie shows, and it answers with the
// pins; or what was typed in the search, and it answers with what it found.
import { parentPort, workerData } from 'node:worker_threads'
import type { QuestieShown, QuestsStatus } from '../shared/quests'
import type { Found } from '../shared/search'
import { doerIndex, fixedPins, openQuestie, questLog, questPins, search, searchIndex } from './questie'

/** What the main process asks. */
export type Asked = { shown: QuestieShown } | { search: string; id: number }
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
  else if (db) tell({ questie: db.version, pins: questPins(db, asked.shown), log: questLog(db, asked.shown) })
})
