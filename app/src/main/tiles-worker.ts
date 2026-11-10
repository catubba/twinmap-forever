// Makes the map tiles on a thread of its own: a minute or two of work the first time, which would
// stop the reading of the strip if it ran with it. Tells its progress in whole percents.
import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import type { TilesStatus } from '../shared/tiles-status'
import { WORLDS } from '../shared/world'
import { installedBuild, openClientFiles, type ClientFiles } from './client-files'
import { convertWorld, finished, tilesFolder } from './tiles'

const { gameFolder, base } = workerData as { gameFolder: string; base: string }
const tell = (status: TilesStatus): void => parentPort?.postMessage(status)

try {
  const started = Date.now()
  const build = installedBuild(gameFolder)
  if (!build) throw new Error('the game folder holds no Forever')
  const folder = tilesFolder(base, build.buildKey)
  let tiles = 0, missing = 0, converted = false, told = -1
  // The game's archive is opened only when there is something to convert: it takes half a second
  // and a few hundred megabytes, and on most starts the tiles are already there.
  let client: ClientFiles | undefined
  WORLDS.forEach((world, i) => {
    let result = finished(join(folder, world.name))
    if (!result) {
      const files = (client ??= openClientFiles(gameFolder))
      const wdt = files.read(world.file)
      if (!wdt) throw new Error(`the game has no world file for ${world.name}`)
      result = convertWorld(wdt, (id) => files.read(id), join(folder, world.name), (done, total) => {
        const percent = Math.floor(((i + done / total) / WORLDS.length) * 100)
        if (percent !== told) tell({ state: 'converting', percent })
        told = percent
      })
    }
    tiles += result.tiles
    missing += result.missing
    converted ||= result.converted
  })
  tell({ state: 'ready', folder, version: build.version, tiles, missing, seconds: (Date.now() - started) / 1000, converted })
} catch (e) {
  tell({ state: 'failed', message: e instanceof Error ? e.message : String(e) })
}
