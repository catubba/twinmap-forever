// Opens the player's QuestieDB on a thread of its own (a third of a second that would stop the
// reading of the strip) and turns what Questie shows into pins, each time the main process says
// what that is.
import { parentPort, workerData } from 'node:worker_threads'
import type { QuestieShown, QuestsStatus } from '../shared/quests'
import { fixedPins, openQuestie, questPins } from './questie'

const db = openQuestie((workerData as { gameFolder: string }).gameFolder)
const tell = (status: QuestsStatus): void => parentPort?.postMessage(status)
tell({ questie: db?.version ?? null, pins: [], fixed: db ? fixedPins(db) : [] })
parentPort?.on('message', (shown: QuestieShown) => {
  if (db) tell({ questie: db.version, pins: questPins(db, shown) })
})
