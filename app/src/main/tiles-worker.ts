// Makes the map tiles on a thread of its own: a minute or two of work the first time, which would
// stop the reading of the strip if it ran with it. Tells its progress in whole percents.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { parentPort, workerData } from 'node:worker_threads'
import { GAME_NAMES_FILE, pairNames, wingNames } from '../shared/game-names'
import { DUNGEON_PINS } from '../shared/dungeon-pins'
import { NEW_DUNGEON_PINS } from '../shared/new-dungeon-pins'
import { NPC, openQuestie } from './questie'
import { FACTS, gameItemFacts, type ItemFacts, ITEMS_FILE } from '../shared/items'
import { AH_NAMES_FILE, gameAhNames } from '../shared/ah'
import { spellFacts, SPELLS_FILE, SPELLS_FORMAT } from '../shared/spells'
import { talentFacts, TALENTS_FILE, TALENTS_FORMAT } from '../shared/talents'
import { trainerFacts, TRAINERS_FILE, TRAINERS_FORMAT } from '../shared/trainers'
import { gameMaps, UI_MAP_ASSIGNMENT_FILE, UI_MAP_FILE, type GameMap } from '../shared/maps'
import { AREA_POI_FILE, AREA_TABLE_FILE, places, UI_MAP_X_MAP_ART_FILE, WORLD_MAP_OVERLAY_FILE } from '../shared/places'
import { TAXI_NODES_FILE, TAXI_PATH_FILE, TAXI_PATH_NODE_FILE, travel, TRAVEL_FORMAT, type Travel } from '../shared/services'
import type { TilesStatus } from '../shared/tiles-status'
import { readTable, type Table } from '../shared/wdc5'
import { LIQUID_TYPE_FILE, liquidOfName, WATER } from '../shared/water'
import { WORLDS } from '../shared/world'
import { gameLocale, installedBuild, openClientFiles, type ClientFiles } from './client-files'
import { buildingsMade, buriedKey, makeBuildings } from './buildings'
import { makeProps, propsMade } from './props'
import { makeStands, standsMade } from './stands'
import { EncryptedFileError } from './client-files'
import { convertInteriors, dungeonWorldFile, ENCOUNTERS_FILE, finishedInteriors, INTERIORS_FILE, MAP_FILE, mapEntries, placedIn, ROOM_PICTURES_FILE, roomPictures } from './interiors'
import { sentKeys } from './keys'
import { convertHeights, heightsDone } from './heights'
import { CAVES_FILE, makeCaves, makeUnder } from './caves'
import { navFrom } from '../shared/nav-data'
import { walker, type Walker } from './walk'
import { MIDDLE_YARDS } from '../shared/inside'
import { ICONS_MADE, writeIcons } from './icons'
import { dungeonMaker } from './dungeons'
import { groundMaker } from './ground'
import { gamePictures, itemIcons } from './item-icons'
import { convertParchment, parchmentFolder, parchmentSea } from './parchment'
import startParchmentWorker from './parchment-worker?nodeWorker'
import { zoneGrid, ZONES_FILE } from './zone-grid'
import { convertWorld, dropOtherBuilds, finished, ICONS_FOLDER, MAPS_FILE, PLACES_FILE, tilesFolder, TRAVEL_FILE } from './tiles'

// openmap: OpenMap's fills for the parchment, shipped beside the walking grid (scripts/import-openmap.js).
const { gameFolder, base, nav, openmap } = workerData as { gameFolder: string; base: string; nav: string; openmap?: string }
const tell = (status: TilesStatus): void => parentPort?.postMessage(status)
/** In the folder of the build: the game's numbers of the keys the map was made with. */
const KEYS_FILE = 'keys.json'
/** In the folder of the build: the language of the game the names were read in (its textLocale). */
const LOCALE_FILE = 'locale.txt'
// The game's tables of the dungeons as its finder names them, of the skills, and of the spells (their rank, as Journeyman).
const LFG_DUNGEONS_FILE = 1361033, SKILL_LINE_FILE = 1240935, SPELL_FILE = 1140089

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
  // The names of zones, places, flights, dungeons, bosses, items, categories and spells are read in the game's language,
  // English where a file has none in it: all made again when the player changes it. A folder that says none was made in English.
  const locale = gameLocale(gameFolder) ?? 'enUS', localeFile = join(folder, LOCALE_FILE)
  let madeIn = 'enUS'
  try {
    madeIn = readFileSync(localeFile, 'utf8').trim() || 'enUS'
  } catch {
    // A map made before the app read the game's language, or none yet.
  }
  if (madeIn !== locale) {
    for (const made of [MAPS_FILE, PLACES_FILE, TRAVEL_FILE, INTERIORS_FILE, ITEMS_FILE, AH_NAMES_FILE, TRAINERS_FILE, SPELLS_FILE, TALENTS_FILE, GAME_NAMES_FILE]) rmSync(join(folder, made), { force: true })
    // The game's map paints the names of the continents in its language: its parchment too (parchment.ts).
    for (const world of WORLDS) rmSync(parchmentFolder(join(folder, world.name)), { recursive: true, force: true })
  }
  // The game's archive is opened only when there is something to convert: it takes half a second
  // and a few hundred megabytes, and on most starts the tiles are already there.
  let client: ClientFiles | undefined
  const open = (): ClientFiles => (client ??= openClientFiles(gameFolder, keys, locale))
  // The picture of an item, or of a spell by its file, when a screen asks for one the folder does not have yet (item-icons.ts).
  // Asked while the map is being made, it is answered once the making is done.
  const table = (b: Buffer) => readTable(b, (keyName) => open().opens(keyName))
  // The ground's own textures of the 3D view, the same way (ground.ts), and the buildings and objects of a dungeon (dungeons.ts).
  let maps: Table | undefined
  const dungeonWorld = (map: number): number | null => dungeonWorldFile((maps ??= table(open().read(MAP_FILE, true)!)), map)
  const makers = { items: itemIcons(open, folder), pictures: gamePictures(open, folder), ground: groundMaker(open, folder, dungeonWorld), dungeon: dungeonMaker(open, folder, table) }
  parentPort?.on('message', (asked: { kind?: unknown; id?: unknown }) => {
    if ((asked.kind === 'items' || asked.kind === 'pictures' || asked.kind === 'ground' || asked.kind === 'dungeon') && typeof asked.id === 'number') parentPort?.postMessage({ asked: `${asked.kind}/${asked.id}`, made: makers[asked.kind](asked.id) })
  })
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
  // Which zone each chunk of land is, for the zones tinted by level (zone-grid.ts): about a second a continent, once for each build.
  for (const world of WORLDS) {
    const file = join(folder, world.name, ZONES_FILE)
    if (existsSync(file)) continue
    try {
      const files = open(), wdt = files.read(world.file), areas = files.read(AREA_TABLE_FILE, true)
      const maps = JSON.parse(readFileSync(join(folder, MAPS_FILE), 'utf8')) as GameMap[]
      if (wdt && areas) writeFileSync(file, deflateSync(new Uint8Array(zoneGrid(wdt, (id) => files.read(id), table(areas), maps, world.continent).buffer)))
    } catch {
      // The zones are not tinted; tried again at the next start.
    }
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
    const [maps, nodes, paths, points, areas] = [MAP_FILE, TAXI_NODES_FILE, TAXI_PATH_FILE, TAXI_PATH_NODE_FILE, AREA_TABLE_FILE].map((id) => files.read(id, true))
    // Without the points of the ways or the names of the areas, no ships: the rest is there all the same.
    writeFileSync(join(folder, TRAVEL_FILE), JSON.stringify(maps && nodes && paths ? travel(table(maps), table(nodes), table(paths), zones, points ? table(points) : undefined, areas ? table(areas) : undefined) : { format: TRAVEL_FORMAT, doors: [], nodes: [], routes: [] }))
  }
  // The pictures of the pins. A folder made before the app knew of them, or of some of them, gets them now.
  if (!existsSync(join(folder, ICONS_FOLDER, ICONS_MADE))) writeIcons(open(), folder)
  // What the game says of each item, for the Items section and the vendors (shared/items.ts): made
  // again when the server has sent rows since, which the game keeps in its cache beside the keys
  // (keys.ts), or when an older app made it with fewer facts.
  try {
    const caches = join(gameFolder, '_forever_', 'Cache', 'ADB')
    // The rows of the game's language, and those of the others for the items it has no row of (gameItemFacts).
    const cacheOf = (language: string): string => join(caches, language, 'DBCache.bin')
    const sent = (existsSync(caches) ? readdirSync(caches) : []).filter((language) => existsSync(cacheOf(language))).sort((a, b) => Number(b === locale) - Number(a === locale)).map(cacheOf)
    const own = sent[0] === cacheOf(locale) ? 1 : 0
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
      const read = sent.map((f) => readFileSync(f))
      const facts = gameItemFacts(open(), read.slice(0, own), read.slice(own))
      if (facts) writeFileSync(itemsFile, JSON.stringify(facts))
    }
  } catch {
    // Items shows numbers and no prices; tried again at the next start.
  }
  // The names of the auction house's categories and of the kinds of items ("of the Eagle"): once for each build.
  try {
    if (!existsSync(join(folder, AH_NAMES_FILE))) {
      const names = gameAhNames(open())
      if (names) writeFileSync(join(folder, AH_NAMES_FILE), JSON.stringify(names))
    }
  } catch {
    // The auction house names its categories by number; tried again at the next start.
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
  // What the app keeps in English, in the game's language (shared/game-names.ts): each table read in English too, and the
  // names of the NPCs from QuestieDB for the bosses the tables have not. Nothing for a game in English.
  if (locale !== 'enUS' && locale !== 'enGB' && !existsSync(join(folder, GAME_NAMES_FILE))) {
    try {
      const english = openClientFiles(gameFolder, keys, 'enUS'), own = open(), names: Record<string, string> = {}
      const opens = (keyName: string): boolean => own.opens(keyName)
      // The game's maps, areas, dungeons as the finder names them, bosses, professions, and the ranks of spells (Journeyman).
      for (const [file, field, texts] of [[MAP_FILE, 1, [1]], [AREA_TABLE_FILE, 1, [1]], [LFG_DUNGEONS_FILE, 0, [0]], [ENCOUNTERS_FILE, 0, [0]], [SKILL_LINE_FILE, 0, [0]], [SPELL_FILE, 0, [0, 1, 2]]] as const) {
        const e = english.read(file, true), o = own.read(file, true)
        if (e && o) pairNames(readTable(e, opens, [...texts]), readTable(o, opens, [...texts]), field, names)
      }
      const [en, there] = [openQuestie(gameFolder, 'enUS'), openQuestie(gameFolder, locale)]
      if (en && there) pairNames({ rows: en.ids.Npc.map((id) => ({ id, text: () => String(en.get('Npc', id, NPC.name) ?? '') })) }, { rows: there.ids.Npc.map((id) => ({ id, text: () => String(there.get('Npc', id, NPC.name) ?? '') })) }, 0, names)
      wingNames([...DUNGEON_PINS, ...NEW_DUNGEON_PINS].map((d) => d.name), locale, names)
      writeFileSync(join(folder, GAME_NAMES_FILE), JSON.stringify(names))
    } catch {
      // The pins keep their English names; tried again at the next start.
    }
  }
  // The names are made again in this language: said so, for the next start. (The insides, after, are made in it too.)
  writeFileSync(localeFile, locale)
  // The continents whose parchment is made, each with the colour of its open sea.
  const parchment: Record<string, number[]> = {}
  for (const world of WORLDS) {
    const sea = parchmentSea(join(folder, world.name))
    if (sea) parchment[world.name] = sea
  }
  const ready = { state: 'ready', folder, version: build.version, tiles, missing, seconds: (Date.now() - started) / 1000, converted, parchment } as const
  let last: TilesStatus = ready
  tell(ready)
  // The spells of the game, for the panels of what a character knows (shared/spells.ts): once for each build, and again for an
  // older format. After the map is ready, which they would hold back a few seconds; the panels ask until the file is there.
  try {
    const spellsFile = join(folder, SPELLS_FILE)
    let format = 0
    try {
      format = (JSON.parse(readFileSync(spellsFile, 'utf8')) as { format?: number }).format ?? 0
    } catch {
      // Not there yet.
    }
    if (format !== SPELLS_FORMAT) {
      const facts = spellFacts(open())
      if (facts) writeFileSync(spellsFile, JSON.stringify(facts))
    }
  } catch {
    // Professions names no recipe; tried again at the next start.
  }
  // The talent trees (shared/talents.ts), the same way: once for each build and again for an older format.
  try {
    const talentsFile = join(folder, TALENTS_FILE)
    let format = 0
    try {
      format = (JSON.parse(readFileSync(talentsFile, 'utf8')) as { format?: number }).format ?? 0
    } catch {
      // Not there yet.
    }
    if (format !== TALENTS_FORMAT) {
      const facts = talentFacts(open())
      if (facts) writeFileSync(talentsFile, JSON.stringify(facts))
    }
  } catch {
    // Talents draws no tree; tried again at the next start.
  }

  // The insides of buildings come after: the map of the continents is already usable.
  const insideStarted = Date.now()
  const interiors = (told: { maps: number; pieces: number; dropped: number; converted: boolean; problem?: string }): void =>
    tell((last = { ...ready, interiors: { ...told, seconds: (Date.now() - insideStarted) / 1000 } }))
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
      const caves = makeCaves(folder, inside)
      // And for the 3D view the rooms inside the ground, each with its floor as the walking grid shipped with the app tells it.
      const walkers = new Map<number, Walker | null>()
      const walk = (continent: number): Walker | null => {
        if (!walkers.has(continent)) {
          const data = navFrom(readFileSync(join(nav, `nav${continent}.json`), 'utf8'))
          walkers.set(continent, data && walker(data))
        }
        return walkers.get(continent)!
      }
      if (caves) makeUnder(folder, inside, caves, (continent, u, v) => walk(continent)?.heights([MIDDLE_YARDS - v, MIDDLE_YARDS - u]) ?? [])
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
  // The buildings of the continents for the 3D view (buildings.ts): minutes the first time, after all the rest. The view
  // asks for them until they are there.
  const buildingsStarted = Date.now()
  try {
    if (!buildingsMade(folder, WORLDS.map((w) => w.name))) {
      const files = open()
      // a file the server has sent no key for is a building the view does without
      const read = (id: number): Buffer | null => {
        try {
          return files.read(id)
        } catch (e) {
          if (e instanceof EncryptedFileError) return null
          throw e
        }
      }
      // the buildings inside the ground (caves.json, by their place in the list of interiors.ts): their halls are the pictures of the rooms
      let caves: Record<string, number[]> = {}
      try {
        caves = (JSON.parse(readFileSync(join(folder, CAVES_FILE), 'utf8')) as { worlds: Record<string, number[]> }).worlds
      } catch {
        // none known: all drawn whole
      }
      // what each liquid of the buildings is, by its name in the game's table, as for the ground; without the table, all water
      const liquids = new Map<number, number>()
      try {
        for (const row of table(files.read(LIQUID_TYPE_FILE)!).rows) liquids.set(row.id, liquidOfName(row.text(0)))
      } catch {
        // all water
      }
      const made = makeBuildings(
        WORLDS.map((w) => {
          const wdt = read(w.file)!, list = placedIn(wdt, read)
          return { name: w.name, wdt, buried: new Set((caves[w.continent] ?? []).flatMap((n) => (list[n] ? [buriedKey(list[n].file, list[n].u, list[n].v)] : []))) }
        }),
        read,
        folder,
        (type) => liquids.get(type) ?? WATER,
      )
      parentPort?.postMessage({ buildings: { ...made, seconds: (Date.now() - buildingsStarted) / 1000 } })
    }
  } catch (e) {
    // The 3D view goes without them; tried again at the next start.
    parentPort?.postMessage({ buildings: { problem: e instanceof Error ? e.message : String(e) } })
  }
  // Where things stand over the game's ground (stands.ts): the streets of the cities the buildings draw.
  try {
    if (!standsMade(folder, WORLDS.map((w) => w.name))) {
      const started = Date.now()
      const cells = makeStands(folder, WORLDS, (continent) => {
        const data = navFrom(readFileSync(join(nav, `nav${continent}.json`), 'utf8'))
        return data && walker(data)
      })
      parentPort?.postMessage({ buildings: { stands: cells, seconds: (Date.now() - started) / 1000 } })
    }
  } catch (e) {
    parentPort?.postMessage({ buildings: { problem: `stands: ${e instanceof Error ? e.message : String(e)}` } })
  }
  // The trees and objects of the continents (props.ts), after the buildings, whose textures they share.
  const propsStarted = Date.now()
  try {
    if (!propsMade(folder, WORLDS.map((w) => w.name))) {
      const files = open()
      const read = (id: number): Buffer | null => {
        try {
          return files.read(id)
        } catch (e) {
          if (e instanceof EncryptedFileError) return null
          throw e
        }
      }
      // the buildings inside the ground, as for the buildings: their copies are cut as they are
      let caves: Record<string, number[]> = {}
      try {
        caves = (JSON.parse(readFileSync(join(folder, CAVES_FILE), 'utf8')) as { worlds: Record<string, number[]> }).worlds
      } catch {
        // none known
      }
      const made = makeProps(
        WORLDS.map((w) => {
          const wdt = read(w.file)!, list = placedIn(wdt, read)
          return { name: w.name, wdt, buried: new Set((caves[w.continent] ?? []).flatMap((n) => (list[n] ? [buriedKey(list[n].file, list[n].u, list[n].v)] : []))) }
        }),
        read,
        folder,
      )
      parentPort?.postMessage({ buildings: { props: made, seconds: (Date.now() - propsStarted) / 1000 } })
    }
  } catch (e) {
    parentPort?.postMessage({ buildings: { problem: `props: ${e instanceof Error ? e.message : String(e)}` } })
  }
  // The game's own map stitched into tiles (parchment.ts), a few seconds a continent: last of all, as the map does
  // without it until it is there. Its tiles are painted on threads of their own (parchment-worker.ts), and meanwhile
  // this one answers the pictures the window asks for. Told as each continent is made.
  void (async () => {
    for (const world of WORLDS) {
      if (parchment[world.name]) continue
      try {
        const files = open(), wdt = files.read(world.file), at = join(folder, world.name)
        const maps = JSON.parse(readFileSync(join(folder, MAPS_FILE), 'utf8')) as GameMap[]
        const sea = wdt && (await convertParchment(wdt, (id, skipHidden) => files.read(id, skipHidden), table, maps, world.continent, at, openmap, undefined, () => startParchmentWorker({}))) ? parchmentSea(at) : null
        if (sea && last.state === 'ready') tell((last = { ...last, parchment: { ...parchment, [world.name]: (parchment[world.name] = sea) } }))
      } catch {
        // The map shows its tiles; tried again at the next start.
      }
    }
  })()
} catch (e) {
  tell({ state: 'failed', message: e instanceof Error ? e.message : String(e) })
}
