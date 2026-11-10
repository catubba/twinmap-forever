// Makes the map tiles on a thread of its own: a minute or two of work the first time, which would
// stop the reading of the strip if it ran with it. Tells its progress in whole percents.
import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import type { TilesStatus } from '../shared/tiles-status'
import { WORLDS } from '../shared/world'
import { openClientFiles } from './client-files'
import { convertWorld, tilesFolder } from './tiles'

const { gameFolder, base } = workerData as { gameFolder: string; base: string }
const tell = (status: TilesStatus): void => parentPort?.postMessage(status)

try {
  const started = Date.now()
  const client = openClientFiles(gameFolder)
  const folder = tilesFolder(base, client.buildKey)
  let tiles = 0, missing = 0, converted = false, told = -1
  WORLDS.forEach((world, i) => {
    const wdt = client.read(world.file)
    if (!wdt) throw new Error(`the game has no world file for ${world.name}`)
    const result = convertWorld(wdt, (id) => client.read(id), join(folder, world.name), (done, total) => {
      const percent = Math.floor(((i + done / total) / WORLDS.length) * 100)
      if (percent !== told) tell({ state: 'converting', percent })
      told = percent
    })
    tiles += result.tiles
    missing += result.missing
    converted ||= result.converted
  })
  tell({ state: 'ready', folder, version: client.version, tiles, missing, seconds: (Date.now() - started) / 1000, converted })
} catch (e) {
  tell({ state: 'failed', message: e instanceof Error ? e.message : String(e) })
}
