// Makes the map tiles on a thread of its own: a minute or two of work the first time, which would
// stop the reading of the strip if it ran with it. Tells its progress in whole percents.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import { gameMaps, UI_MAP_ASSIGNMENT_FILE, UI_MAP_FILE, type GameMap } from '../shared/maps'
import { AREA_POI_FILE, AREA_TABLE_FILE, places, UI_MAP_X_MAP_ART_FILE, WORLD_MAP_OVERLAY_FILE } from '../shared/places'
import { TAXI_NODES_FILE, TAXI_PATH_FILE, travel, TRAVEL_FORMAT, type Travel } from '../shared/services'
import type { TilesStatus } from '../shared/tiles-status'
import { readTable } from '../shared/wdc5'
import { WORLDS } from '../shared/world'
import { installedBuild, openClientFiles, type ClientFiles } from './client-files'
import { convertInteriors, ENCOUNTERS_FILE, finishedInteriors, INTERIORS_FILE, MAP_FILE, mapEntries, ROOM_PICTURES_FILE, roomPictures } from './interiors'
import { sentKeys } from './keys'
import { ICONS_MADE, writeIcons } from './icons'
import { convertWorld, dropOtherBuilds, finished, ICONS_FOLDER, MAPS_FILE, PLACES_FILE, tilesFolder, TRAVEL_FILE } from './tiles'

const { gameFolder, base } = workerData as { gameFolder: string; base: string }
const tell = (status: TilesStatus): void => parentPort?.postMessage(status)
/** In the folder of the build: the game's numbers of the keys the map was made with. */
const KEYS_FILE = 'keys.json'

try {
  const started = Date.now()
  const build = installedBuild(gameFolder)
  if (!build) throw new Error('the game folder holds no Forever')
  const folder = tilesFolder(base, build.buildKey)
  let tiles = 0, missing = 0, converted = false, told = -1
  // The keys the server has sent to this PC open what the game locked until it came out (keys.ts).
  // One that was not there when the map was made may open dungeons the map does without: what
  // comes from the tables with locked rows, and the insides, are made again. The pictures already
  // kept stay.
  // ponytail: any new key does it, also one that locks no map. Look at which tables name the key if that ever costs.
  const keys = sentKeys(gameFolder), keysFile = join(folder, KEYS_FILE)
  let usedKeys: number[] = []
  try {
    const listed: unknown = JSON.parse(readFileSync(keysFile, 'utf8'))
    if (Array.isArray(listed)) usedKeys = listed.filter((k): k is number => typeof k === 'number')
  } catch {
    // No list: a map made before the app opened anything, or none yet.
  }
  if ([...keys.keys()].some((k) => !usedKeys.includes(k))) for (const made of [PLACES_FILE, TRAVEL_FILE, INTERIORS_FILE]) rmSync(join(folder, made), { force: true })
  // The game's archive is opened only when there is something to convert: it takes half a second
  // and a few hundred megabytes, and on most starts the tiles are already there.
  let client: ClientFiles | undefined
  const open = (): ClientFiles => (client ??= openClientFiles(gameFolder, keys))
  const table = (b: Buffer) => readTable(b, (keyName) => open().opens(keyName))
  WORLDS.forEach((world, i) => {
    let result = finished(join(folder, world.name))
    if (!result) {
      const files = open()
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
  // The maps of the game and where each lies: what places the character on the tiles.
  if (!existsSync(join(folder, MAPS_FILE))) {
    const files = open()
    const uiMap = files.read(UI_MAP_FILE), assignments = files.read(UI_MAP_ASSIGNMENT_FILE)
    if (!uiMap || !assignments) throw new Error('the game has no table of its maps')
    writeFileSync(join(folder, MAPS_FILE), JSON.stringify(gameMaps(table(uiMap), table(assignments))))
  }
  // The names of towns, points of interest and areas, to write over the map. A folder made before
  // the app knew of them gets them now.
  if (!existsSync(join(folder, PLACES_FILE))) {
    const files = open()
    // The table of the areas has rows the game keeps encrypted: read around the ones still locked.
    const [poi, overlays, arts, areas] = [AREA_POI_FILE, WORLD_MAP_OVERLAY_FILE, UI_MAP_X_MAP_ART_FILE, AREA_TABLE_FILE].map((id) => files.read(id, true))
    const maps = JSON.parse(readFileSync(join(folder, MAPS_FILE), 'utf8')) as GameMap[]
    // Without the tables the map has the names of its zones only: no reason to refuse it.
    writeFileSync(join(folder, PLACES_FILE), JSON.stringify(poi && overlays && arts && areas ? places(table(poi), table(overlays), table(arts), table(areas), maps) : []))
  }
  // The doors of the dungeons and the flight routes. Without the tables the map has none of them.
  let travelMade = false
  try {
    travelMade = (JSON.parse(readFileSync(join(folder, TRAVEL_FILE), 'utf8')) as Travel).format === TRAVEL_FORMAT
  } catch {
    // Not there yet.
  }
  if (!travelMade) {
    const files = open()
    const zones = JSON.parse(readFileSync(join(folder, MAPS_FILE), 'utf8')) as GameMap[]
    const [maps, nodes, paths] = [MAP_FILE, TAXI_NODES_FILE, TAXI_PATH_FILE].map((id) => files.read(id, true))
    writeFileSync(join(folder, TRAVEL_FILE), JSON.stringify(maps && nodes && paths ? travel(table(maps), table(nodes), table(paths), zones) : { format: TRAVEL_FORMAT, doors: [], nodes: [], routes: [] }))
  }
  // The pictures of the pins. A folder made before the app knew of them, or of some of them, gets them now.
  if (!existsSync(join(folder, ICONS_FOLDER, ICONS_MADE))) writeIcons(open(), folder)
  const ready = { state: 'ready', folder, version: build.version, tiles, missing, seconds: (Date.now() - started) / 1000, converted } as const
  tell(ready)

  // The insides of buildings come after: the map of the continents is already usable.
  const insideStarted = Date.now()
  const interiors = (told: { maps: number; pieces: number; dropped: number; converted: boolean; problem?: string }): void =>
    tell({ ...ready, interiors: { ...told, seconds: (Date.now() - insideStarted) / 1000 } })
  try {
    let inside = finishedInteriors(folder)
    const insideConverted = !inside
    if (!inside) {
      const files = open()
      // These tables have parts the game keeps encrypted: read around the ones still locked.
      const maps = files.read(MAP_FILE, true), rooms = files.read(ROOM_PICTURES_FILE, true), fights = files.read(ENCOUNTERS_FILE, true)
      if (!maps || !rooms || !fights) throw new Error('the game has no table of its maps, of its room pictures or of its bosses')
      inside = convertInteriors(mapEntries(table(maps), table(fights)), roomPictures(table(rooms)), (id) => files.read(id), folder)
    }
    // Now the map holds all these keys could open. One it was made with and the cache has lost stays listed.
    writeFileSync(keysFile, JSON.stringify([...new Set([...usedKeys, ...keys.keys()])].sort((a, b) => a - b)))
    interiors({ maps: inside.maps.length, pieces: inside.maps.reduce((n, m) => n + m.pieces.length, 0), dropped: inside.dropped, converted: insideConverted })
    // The map of this build is whole, rooms and all: the ones of the builds before it only take room on the disk.
    dropOtherBuilds(base, build.buildKey)
  } catch (e) {
    // The map of the continents is there all the same.
    interiors({ maps: 0, pieces: 0, dropped: 0, converted: false, problem: e instanceof Error ? e.message : String(e) })
  }
} catch (e) {
  tell({ state: 'failed', message: e instanceof Error ? e.message : String(e) })
}
