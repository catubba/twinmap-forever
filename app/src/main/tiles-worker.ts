// Makes the map tiles on a thread of its own: a minute or two of work the first time, which would
// stop the reading of the strip if it ran with it. Tells its progress in whole percents.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import { FACTS, gameItemFacts, type ItemFacts, ITEMS_FILE } from '../shared/items'
import { trainerFacts, TRAINERS_FILE, TRAINERS_FORMAT } from '../shared/trainers'
import { gameMaps, UI_MAP_ASSIGNMENT_FILE, UI_MAP_FILE, type GameMap } from '../shared/maps'
import { AREA_POI_FILE, AREA_TABLE_FILE, places, UI_MAP_X_MAP_ART_FILE, WORLD_MAP_OVERLAY_FILE } from '../shared/places'
import { TAXI_NODES_FILE, TAXI_PATH_FILE, travel, TRAVEL_FORMAT, type Travel } from '../shared/services'
import type { TilesStatus } from '../shared/tiles-status'
import { readTable } from '../shared/wdc5'
import { LIQUID_TYPE_FILE, liquidOfName, WATER } from '../shared/water'
import { WORLDS } from '../shared/world'
import { installedBuild, openClientFiles, type ClientFiles } from './client-files'
import { convertInteriors, ENCOUNTERS_FILE, finishedInteriors, INTERIORS_FILE, MAP_FILE, mapEntries, ROOM_PICTURES_FILE, roomPictures } from './interiors'
import { sentKeys } from './keys'
import { convertHeights, heightsDone } from './heights'
import { makeCaves } from './caves'
import { ICONS_MADE, writeIcons } from './icons'
import { gamePictures, itemIcons } from './item-icons'
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
  // The picture of an item, or of a spell by its file, when a screen asks for one the folder does not have yet (item-icons.ts).
  // Asked while the map is being made, it is answered once the making is done.
  const makers = { items: itemIcons(open, folder), pictures: gamePictures(open, folder) }
  parentPort?.on('message', (asked: { kind?: unknown; id?: unknown }) => {
    if ((asked.kind === 'items' || asked.kind === 'pictures') && typeof asked.id === 'number') parentPort?.postMessage({ asked: `${asked.kind}/${asked.id}`, made: makers[asked.kind](asked.id) })
  })
  const table = (b: Buffer) => readTable(b, (keyName) => open().opens(keyName))
  const progress = (percent: number): void => {
    if (Math.floor(percent) !== told) tell({ state: 'converting', percent: Math.floor(percent) })
    told = Math.floor(percent)
  }
  WORLDS.forEach((world, i) => {
    let result = finished(join(folder, world.name))
    // The heights and the relief (heights.ts) take a tenth of a continent's time when its tiles are made with them, all of it when the tiles were there already.
    const relief = !heightsDone(join(folder, world.name)), share = result ? 1 : relief ? 0.1 : 0
    const wdt = (): Buffer => {
      const read = open().read(world.file)
      if (!read) throw new Error(`the game has no world file for ${world.name}`)
      return read
    }
    if (!result) {
      const files = open()
      result = convertWorld(wdt(), (id) => files.read(id), join(folder, world.name), (done, total) => progress(((i + (1 - share) * (done / total)) / WORLDS.length) * 100))
    }
    if (relief) {
      try {
        const files = open()
        // What each liquid is, by its name in the game's table; without the table, all water.
        const liquids = new Map<number, number>()
        try {
          for (const row of table(files.read(LIQUID_TYPE_FILE)!).rows) liquids.set(row.id, liquidOfName(row.text(0)))
        } catch {
          // all water
        }
        convertHeights(wdt(), (id) => files.read(id), join(folder, world.name), (done, total) => progress(((i + 1 - share + share * (done / total)) / WORLDS.length) * 100), (type) => liquids.get(type) ?? WATER)
      } catch {
        // The map does without its relief; it is tried again at the next start.
      }
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
  // What the game says of each item, for the Items section and the vendors (shared/items.ts): made
  // again when the server has sent rows since, which the game keeps in its cache beside the keys
  // (keys.ts), or when an older app made it with fewer facts.
  try {
    const caches = join(gameFolder, '_forever_', 'Cache', 'ADB')
    const sent = existsSync(caches) ? readdirSync(caches).map((language) => join(caches, language, 'DBCache.bin')).filter((f) => existsSync(f)) : []
    const itemsFile = join(folder, ITEMS_FILE)
    const made = existsSync(itemsFile) ? statSync(itemsFile).mtimeMs : 0
    const older = (): boolean => {
      try {
        return Object.values(JSON.parse(readFileSync(itemsFile, 'utf8')) as ItemFacts)[0]?.length !== FACTS
      } catch {
        return true
      }
    }
    if (!made || sent.some((f) => statSync(f).mtimeMs > made) || older()) {
      const facts = gameItemFacts(open(), sent.map((f) => readFileSync(f)))
      if (facts) writeFileSync(itemsFile, JSON.stringify(facts))
    }
  } catch {
    // Items shows numbers and no prices; tried again at the next start.
  }
  // What the class trainers teach (shared/trainers.ts): made once for each build, and again for an older format.
  try {
    const trainersFile = join(folder, TRAINERS_FILE)
    let format = 0
    try {
      format = (JSON.parse(readFileSync(trainersFile, 'utf8')) as { format?: number }).format ?? 0
    } catch {
      // Not there yet.
    }
    if (format !== TRAINERS_FORMAT) {
      const facts = trainerFacts(open())
      if (facts) writeFileSync(trainersFile, JSON.stringify(facts))
    }
  } catch {
    // The trainer panel goes without the game's lists; tried again at the next start.
  }
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
    // Which of the continents' buildings are caves and mines: for the layer that shows them from outside. Without it the map goes on as before.
    try {
      makeCaves(folder, inside)
    } catch {
      // tried again at the next start
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
