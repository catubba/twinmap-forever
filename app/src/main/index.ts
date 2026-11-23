import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, shell } from 'electron'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { hostname, userInfo } from 'node:os'
import { join } from 'node:path'
import { keep, keptFrom } from '../shared/kept'
import { burnt } from '../shared/hdr'
import { modelFrom, pictureDue, portraitsFrom, wornKey, type Portraits, type PortraitsTold } from '../shared/portrait'
import { heldOf, mergeSheet, sheetNewsFrom, sheetsFrom, type Sheets } from '../shared/sheet'
import { linkStatus, lostPercent, type LinkSnapshot } from '../shared/link'
import { logFrom, shownFrom, type QuestsStatus } from '../shared/quests'
import type { Found } from '../shared/search'
import { tipsFrom, type ItemSources, type Tips } from '../shared/tips'
import { groupFrom } from '../shared/group'
import { arrived, inboxFrom, marksNews, pinFrom, routeNewsFrom, stepFrom, takenFrom } from '../shared/send'
import { feedbackLink, sendFeedback } from '../shared/feedback'
import { pageOf, setupComplete, setupPages, type SetupStatus } from '../shared/setup'
import { tilesLine, type TilesStatus } from '../shared/tiles-status'
import { placeWindow, WINDOW, ZOOMS, zoomStep } from '../shared/window'
import { findGameWindow, programOf } from './capture'
import { readHdr } from './hdr'
import { gameFolderFrom, gameLocale, installedBuild, registryInstallPath } from './client-files'
import { homeAddress, LAN_PORT, startLan, type Lan, type Served } from './lan'
import { startLink } from './link'
import { startBosses } from './bosses'
import { sendLog, startGameLog, type Ask } from './gamelog'
import { describe, fault, startHealth } from './health'
import { startLog } from './log'
import type { Answer, Asked, Placed, Sources } from './questie-worker'
import startQuestieWorker from './questie-worker?nodeWorker'
import { sendSamples, startSamples } from './samples'
import { langFor, langNow, offerAll, offered, planned, setLang, t } from '../shared/i18n'
import { addonHearsFonts, addonsFolder, askLangOf, readSettings, setupStatus, writeSettings } from './setup'
import { hear, installChannel, removeSlots, send as sendSignal, sendOld, sentParts } from './signal'
import { MAPS_FILE, servedFile } from './tiles'
import startTilesWorker from './tiles-worker?nodeWorker'
import { updateFirst } from './update'
import startWalkWorker from './walk-worker?nodeWorker'
import { navFolder } from './nav'
import { encodePng } from './png'
import { farAskFrom, trackAskFrom, walkAskFrom, type Far, type FarAsk, type Floors, type TrackAsk, type WalkAsk, type WalkPath } from '../shared/walk'
import { startPrices } from './prices'
import { startAlerts } from './alerts'
import type { Listing } from '../shared/ah'

const SHOW_EVERY = 50 // ms between updates of the window: a position must be there well before the arrow needs it (BEHIND in glide.ts)
const LOG_EVERY = 5000 // ms between writes of the measures
const SHOW_AFTER = 3000 // ms after which the window shows itself even if its page has not said it is drawn

const BLANK = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64') // a see-through picture of one pixel

// Hardware acceleration, as the settings had it when the app started: Electron takes it only before it is ready.
// Without it Chromium draws WebGL on the processor (WARP), so the compass and the 3D view still work, slower.
const GPU = readSettings(join(app.getPath('userData'), 'settings.json')).noGpu !== true
if (!GPU) app.disableHardwareAcceleration()

// The window gets the map's files through an address of its own, twinmap://tiles/..., and only those.
protocol.registerSchemesAsPrivileged([{ scheme: 'twinmap', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])

// The game folder: the one the player picked, else the one of the game that is running, else the
// one the game's installer wrote down. TWINMAP_GAME, for trials, is looked at alone (a folder with no game in it: none found).
function findGameFolder(picked: string | undefined): string | null {
  if (process.env.TWINMAP_GAME !== undefined) return gameFolderFrom([process.env.TWINMAP_GAME])
  const running = findGameWindow()
  return gameFolderFrom([picked ?? null, running === null ? null : programOf(running), registryInstallPath()])
}

// Makes the map tiles from the game's files, once per build of the game, and keeps the latest word on it.
// The folder: TWINMAP_DATA when set (for trials), or Twinmap under the local application data.
type Picture = 'items' | 'pictures'
function startTiles(gameFolder: string | null): { status: () => TilesStatus; item: (kind: Picture, id: number) => Promise<boolean>; stop: () => void } {
  let status: TilesStatus = { state: 'looking' }
  if (!gameFolder) return { status: () => ({ state: 'no-game' }), item: () => Promise.resolve(false), stop: () => {} }
  const base = process.env.TWINMAP_DATA ?? join(process.env.LOCALAPPDATA ?? app.getPath('userData'), 'Twinmap')
  const worker = startTilesWorker({ workerData: { gameFolder, base, nav: navFolder() } })
  // The picture of an item, or of a spell by its file, the folder does not have yet is made by the worker, which has the game's archive (item-icons.ts).
  const items = new Map<string, ((made: boolean) => void)[]>()
  worker.on('message', (told: TilesStatus | { asked: string; made: boolean }) => {
    if (!('asked' in told)) {
      if (told.state === 'failed') fault(`map: ${told.message}`)
      return void (status = told)
    }
    for (const answer of items.get(told.asked) ?? []) answer(told.made)
    items.delete(told.asked)
  })
  worker.on('error', (e) => {
    fault(`map: worker stopped: ${describe(e)}`)
    status = { state: 'failed', message: e instanceof Error ? e.message : String(e) }
    for (const answers of items.values()) for (const answer of answers) answer(false)
    items.clear()
  })
  const item = (kind: Picture, id: number): Promise<boolean> =>
    new Promise((answer) => {
      const asked = `${kind}/${id}`, waiting = items.get(asked)
      if (waiting) return void waiting.push(answer)
      items.set(asked, [answer])
      worker.postMessage({ kind, id })
    })
  return { status: () => status, item, stop: () => void worker.terminate() }
}

// The quests on the map: the player's QuestieDB is opened once, and asked for the pins of what
// Questie shows each time the addon tells something new. tell: called with every answer.
function startQuests(
  gameFolder: string | null,
  tell: (status: QuestsStatus) => void,
): { show: (section: unknown, log?: unknown) => void; search: (typed: string) => Promise<Found[]>; sources: (item: number) => Promise<ItemSources>; placed: (asks: Ask[], maps: string | null) => Promise<boolean[]>; stop: () => void } {
  const NONE: ItemSources = { sold: [], drops: [], found: [] }
  const ALL = (asks: Ask[]): Promise<boolean[]> => Promise.resolve(asks.map(() => true))
  if (!gameFolder) return { show: () => {}, search: () => Promise.resolve([]), sources: () => Promise.resolve(NONE), placed: ALL, stop: () => {} }
  const worker = startQuestieWorker({ workerData: { gameFolder, lang: langNow() } })
  // A search waits for the answer that carries its number.
  const asked = new Map<number, (found: Found[]) => void>(), askedSources = new Map<number, (sources: ItemSources) => void>(), askedPlaced = new Map<number, { answer: (placed: boolean[]) => void; fail: (why: Error) => void }>()
  let dead = false
  let searches = 0
  const post = (message: Asked): void => worker.postMessage(message)
  worker.on('message', (told: QuestsStatus | Answer | Sources | Placed) => {
    if ('placed' in told) return void (askedPlaced.get(told.id)?.answer(told.placed), askedPlaced.delete(told.id))
    if ('sources' in told) return void (askedSources.get(told.id)?.(told.sources), askedSources.delete(told.id))
    if (!('found' in told)) return tell(told)
    asked.get(told.id)?.(told.found)
    asked.delete(told.id)
  })
  worker.on('error', (e) => {
    fault(`quests: worker stopped: ${describe(e)}`)
    tell({ questie: null, pins: [], fixed: [] }) // no quests on the map; the rest of the app goes on
    for (const answer of asked.values()) answer([])
    for (const answer of askedSources.values()) answer(NONE)
    // What QuestieDB has cannot be told: the sessions wait in the game's file for the app to open again.
    dead = true
    for (const { fail } of askedPlaced.values()) fail(new Error('QuestieDB could not be read'))
    askedPlaced.clear()
    asked.clear()
    askedSources.clear()
  })
  let last = ''
  return {
    // log: the game's own log, which the addon sends where Questie is not running.
    show: (section, log) => {
      const told = JSON.stringify([section ?? null, log ?? null])
      if (told === last) return
      last = told
      const own = section ? null : logFrom(log)
      post(own ? { log: own } : { shown: shownFrom(section) })
    },
    search: (typed) =>
      new Promise((answer) => {
        asked.set(++searches, answer)
        post({ search: typed, id: searches })
      }),
    sources: (item) =>
      new Promise((answer) => {
        askedSources.set(++searches, answer)
        post({ sources: item, id: searches })
      }),
    placed: (asks, maps) =>
      new Promise((answer, fail) => {
        if (dead) return fail(new Error('QuestieDB could not be read'))
        askedPlaced.set(++searches, { answer, fail })
        post({ placed: asks, id: searches, maps })
      }),
    stop: () => void worker.terminate(),
  }
}

// The ways on foot: found on a thread of its own, each asking answered under its number.
function startWalks(gameFolder: string | null): { find: (ask: WalkAsk) => Promise<WalkPath>; far: (ask: FarAsk) => Promise<Far>; track: (ask: TrackAsk) => Promise<Floors>; stop: () => void } {
  const worker = startWalkWorker({ workerData: { gameFolder, shipped: navFolder() } })
  const asked = new Map<number, (path: WalkPath | Far | Floors) => void>()
  let asks = 0
  worker.on('message', (told: { id: number; path: WalkPath | Far | Floors }) => {
    asked.get(told.id)?.(told.path)
    asked.delete(told.id)
  })
  worker.on('error', (e) => {
    fault(`walk: worker stopped: ${describe(e)}`)
    for (const answer of asked.values()) answer(null) // no line on the map, distances as the crow flies; the rest of the app goes on
    asked.clear()
  })
  const ask = <T extends WalkPath | Far | Floors>(what: WalkAsk | FarAsk | TrackAsk): Promise<T | null> =>
    new Promise((answer) => {
      asked.set(++asks, answer as (path: WalkPath | Far | Floors) => void)
      worker.postMessage({ id: asks, ask: what })
    })
  return {
    find: (what) => ask<WalkPath>(what),
    far: async (what) => (await ask<Far>(what)) ?? what.to.map(() => null),
    track: (what) => ask<Floors>(what),
    stop: () => void worker.terminate(),
  }
}

// The app's record of what happened to it, for the player to copy into a report.
const record = startLog(join(app.getPath('userData'), 'twinmap.log'))
// What falls over in the main process goes in the record, and in the reports of the app's health (health.ts).
process.on('uncaughtExceptionMonitor', (e, origin) => fault(`${origin}: ${describe(e)}`))
process.on('unhandledRejection', (why) => fault(`unhandled rejection: ${describe(why)}`))
// Every send to the game goes in the record: its number, the parts it changes by kind (the name of
// a mark holds its place, which the record does not keep), and how it goes: in how many fonts, or,
// to an addon from before the fonts carried everything, in the font or in a slot.
const send = (addons: string, changed: Record<string, unknown>, fonts: boolean): { seq: number } => {
  const kinds = [...new Set(Object.keys(changed).map((part) => /^[a-z]*/i.exec(part)![0]))].join(' ')
  if (fonts) {
    const sent = sendSignal(addons, changed)
    // Not the character's place inside a dungeon: it goes every second and a half.
    if (kinds !== 'here') record.say(`sent ${sent.seq}: ${kinds}, ${sent.bytes} bytes, in ${sent.pieces === 1 ? 'the font' : `${sent.pieces} fonts`}`)
    return sent
  }
  const sent = sendOld(addons, changed)
  record.say(`sent ${sent.seq}: ${kinds}, ${sent.bytes} bytes, ${sent.inFont ? 'in the font' : 'in a slot'}, to an older addon`)
  return sent
}

// The addon reads news every 5 s: a pause asked again sooner would only ask the same twice.
const PAUSE_AGAIN = 10_000

function createWindow(): void {
  // The window opens where it was closed: monitor, place, size, and maximized if it was.
  const placeFile = join(app.getPath('userData'), 'window.json')
  let saved: unknown = null
  try {
    saved = JSON.parse(readFileSync(placeFile, 'utf8'))
  } catch {
    // first run, or a file that cannot be read: the window opens centred
  }
  const place = placeWindow(saved, screen.getAllDisplays().map((d) => d.workArea), screen.getPrimaryDisplay().workArea)

  // No title bar of the system: the top row of the page is the title bar, and Windows draws its three buttons over it.
  const win = new BrowserWindow({
    title: 'Twinmap',
    ...place,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    backgroundColor: WINDOW.background,
    opacity: 0, // see-through until the opening screen is drawn on it: never an empty window
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: WINDOW.symbols, height: WINDOW.top },
    webPreferences: { preload: join(__dirname, '../preload/index.js') },
  })
  if ((saved as { maximized?: unknown } | null)?.maximized === true) win.maximize()
  // The page says when its opening screen is drawn; a page that never says so is shown all the same.
  // (A window kept hidden instead draws nothing new until it is shown, and is seen empty for a moment.)
  const open = (): void => {
    if (!win.isDestroyed()) win.setOpacity(1)
  }
  ipcMain.once('drawn', open)
  setTimeout(open, SHOW_AFTER)
  win.on('close', () => {
    try {
      writeFileSync(placeFile, JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }))
    } catch {
      // not being able to remember the place is no reason to refuse to close
    }
  })
  // F11: full screen and back. The top row stays.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F11') return
    win.setFullScreen(!win.isFullScreen())
    event.preventDefault()
  })

  // A page that falls over (out of memory, a crash) is said in the record and loaded again, at most
  // once a minute: never a window left empty, never one that loads again and again.
  let reloadedAt = 0
  win.webContents.on('render-process-gone', (_event, gone) => {
    const again = gone.reason !== 'clean-exit' && Date.now() - reloadedAt > 60_000
    const line = `window: page gone (${gone.reason}, code ${gone.exitCode})${again ? ', loaded again' : ''}`
    if (gone.reason === 'clean-exit') record.say(line)
    else fault(line)
    if (!again || win.isDestroyed()) return
    reloadedAt = Date.now()
    win.webContents.reload()
  })
  win.webContents.on('unresponsive', () => fault('window: page not answering'))
  // An error the page did not catch, as its console tells it; not the pictures it could not find, which are many and expected.
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' && e.message.startsWith('Uncaught')) fault(`page: ${e.message.split('\n')[0]}`)
  })
  win.webContents.on('responsive', () => record.say('window: page answering again'))

  // In development the renderer comes from the dev server, in a build from disk.
  // TWINMAP_KIT opens the trial page of the basic controls instead of the app.
  const devUrl = process.env.ELECTRON_RENDERER_URL, hash = process.env.TWINMAP_KIT ? 'kit' : ''
  if (devUrl) void win.loadURL(`${devUrl}#${hash}`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })

  const settingsFile = join(app.getPath('userData'), 'settings.json')
  const settings = readSettings(settingsFile)
  let gameFolder = findGameFolder(settings.gameFolder)
  // The language: the one chosen in the settings, else the game's, else English. The pages ask for it as they load.
  // TWINMAP_LANGS=all, for trials, offers the languages written but not out yet.
  if (process.env.TWINMAP_LANGS === 'all') offerAll()
  const gameLang = (): string | null => (gameFolder ? gameLocale(gameFolder) : null)
  setLang(langFor(settings.lang, gameLang()))
  // Asked once, as the app starts, for a player who had Twinmap before it spoke the game's language (LangAsk.svelte).
  let askLang = askLangOf(settings, gameLang(), offered)
  // The participation programme: with the choice on, the samples of a run in a dungeon are sent when the
  // character leaves it. With it off nothing is kept and nothing is sent. TWINMAP_SAMPLES, for trials, names another address.
  const participates = (): boolean => settings.participate === true
  const samples = startSamples(participates)
  const bosses = startBosses(participates, app.getVersion()) // where the bosses die, sent at the same moment (bosses.ts)
  const link = startLink(
    () => {
      const made = tiles.status()
      return made.state === 'ready' ? made.folder : null
    },
    (report, seen, own, now) => {
      const run = samples.take(report, seen, own, now), killed = bosses.take(report, now)
      if (!(run || killed) || !gameFolder) return
      const build = installedBuild(gameFolder)?.version, locale = gameLocale(gameFolder)
      if (!build || !locale) return record.say('samples: not sent, the build or the language of the game is not known')
      const said = { app: app.getVersion(), build, locale }
      if (run) void sendSamples(run, said, participates, process.env.TWINMAP_SAMPLES).then((sent) => record.say(`samples: ${sent} of ${run.samples.length} sent`))
      if (killed) void sendLog([killed], said, participates, process.env.TWINMAP_SAMPLES?.replace(/sample$/, 'log')).then((sent) => record.say(`bosses: ${sent.length ? 'sent' : 'not sent'}`))
    },
    // The addon draws again while paused (a /reload, a login): asked once more, but not before it had time to read the last ask.
    () => {
      if (paused && Date.now() - pauseToldAt > PAUSE_AGAIN) tellPause()
    },
  )
  // The Pause button: the app stops reading the strip and asks the addon to stop drawing it, for this run
  // of the app and that session of the game's interface alone. The part "pause" is a number new at every
  // ask, so that an ask after a /reload is news; false takes it back. Never kept: the app starts unpaused.
  let paused = false, pauseToldAt = 0
  const tellPause = (): void => {
    if (!gameFolder || !addonHearsFonts(gameFolder)) return // an addon from before the fonts has no pause: the app alone stops
    pauseToldAt = Date.now()
    try {
      send(addonsFolder(gameFolder), { pause: paused ? pauseToldAt : false }, true)
    } catch {
      record.say('pause: not told, the way to the addon is not ready')
    }
  }
  let tiles = startTiles(gameFolder)
  // The pins go to the window when they change, and once more when its page has loaded.
  let questsNow: QuestsStatus = { questie: null, pins: [] }
  const tellQuests = (status: QuestsStatus): void => {
    questsNow = { ...status, fixed: status.fixed ?? questsNow.fixed } // the fixed pins come once: kept for a page that loads later
    if (!win.isDestroyed()) win.webContents.send('quests', status)
    lan?.tell('quests', questsNow)
  }
  let quests = startQuests(gameFolder, tellQuests)
  // The addon's log of the participation programme, read from the settings the game saves (gamelog.ts).
  const gameLog = startGameLog(
    () => gameFolder,
    join(app.getPath('userData'), 'log-sent.json'),
    () => {
      const build = gameFolder && installedBuild(gameFolder)?.version, locale = gameFolder && gameLocale(gameFolder)
      return build && locale ? { app: app.getVersion(), build, locale } : null
    },
    participates,
    record.say,
    process.env.TWINMAP_SAMPLES?.replace(/sample$/, 'log'),
    // What QuestieDB has with a place is not sent; an NPC talked to, unless QuestieDB has it elsewhere.
    (asks) => {
      const made = tiles.status()
      return quests.placed(asks, made.state === 'ready' ? join(made.folder, MAPS_FILE) : null)
    },
  )
  // The app's health, for the same programme: its errors and the times of its looks at the minimap (health.ts).
  const health = startHealth(
    participates,
    () => {
      const build = gameFolder && installedBuild(gameFolder)?.version, locale = gameFolder && gameLocale(gameFolder)
      return build && locale ? { app: app.getVersion(), build, locale } : null
    },
    (): [string, string][] => [...(gameFolder ? [[gameFolder, '<game>'] as [string, string]] : []), [app.getPath('userData'), '<data>'], [app.getAppPath(), '<app>'], [app.getPath('temp'), '<temp>'], [app.getPath('home'), '<home>']],
    () => [userInfo().username, hostname(), ...Object.keys(sheets).flatMap((key) => key.split(' '))],
    record.say,
    process.env.TWINMAP_SAMPLES?.replace(/sample$/, 'errors'),
  )
  let walks = startWalks(gameFolder)
  // A file of the map, for the window and for a phone on the home network alike.
  // The pictures of the characters (shared/portrait.ts): a PNG each beside the settings, named by the letters of the character's name.
  const portraitsFolder = join(app.getPath('userData'), 'portraits')
  const portraitFile = (key: string): string => join(portraitsFolder, `${Buffer.from(key).toString('hex')}.png`)
  const served = async (path: string): Promise<Served> => {
    const portrait = /^\/portraits\/([^/]+)\.png$/.exec(path)
    if (portrait) {
      let key = ''
      try {
        key = decodeURIComponent(portrait[1]!)
      } catch {
        // not a name
      }
      const bytes = key ? await readFile(portraitFile(key)).catch(() => null) : null
      return bytes ? { status: 200, type: 'image/png', bytes } : { status: 404 }
    }
    const status = tiles.status()
    const file = status.state === 'ready' ? servedFile(status.folder, path) : null
    let bytes = file ? await readFile(file).catch(() => null) : null
    // The picture of an item is made the first time it is asked for; one the game has none of is no picture at all.
    const item = /^\/(items|pictures)\/(\d+)\.png$/.exec(path)
    if (item && file && !bytes) bytes = (await tiles.item(item[1] as Picture, Number(item[2]))) ? await readFile(file).catch(() => null) : null
    if (item && !bytes) return { status: 404 }
    // Where the game has no picture there is no file. That is the sea, not a fault: an empty picture for
    // a tile and an empty answer for a block, so the page logs no error for it.
    if (!bytes) return file?.endsWith('.png') ? { status: 200, type: 'image/gif', bytes: BLANK } : { status: file ? 204 : 404 }
    return { status: 200, type: file!.endsWith('.png') ? 'image/png' : file!.endsWith('.json') ? 'application/json' : 'application/octet-stream', bytes }
  }
  win.webContents.on('did-finish-load', () => win.webContents.send('quests', questsNow))

  // What a page may ask for from either place, the app's own window or a phone on the home network.
  // Each checks what it is given.
  const calls: Record<string, (...args: unknown[]) => unknown> = {}
  const asks = (name: string, answer: (...args: unknown[]) => unknown): void => {
    calls[name] = answer
    ipcMain.handle(name, (_event, ...args: unknown[]) => answer(...args))
  }
  // The route and My pins: one copy for every screen, in a file beside the settings. A screen that
  // changes one tells it here, and every screen is told. Written whole to a file of its own and
  // then put in place of the old one: a write cut short never leaves half of the pins.
  const keptFile = join(app.getPath('userData'), 'kept.json')
  let kept = keptFrom(null)
  try {
    kept = keptFrom(JSON.parse(readFileSync(keptFile, 'utf8')))
  } catch {
    // never kept: the window hands over what it kept by itself before this was shared
  }
  const tellKept = (): void => {
    if (!win.isDestroyed()) win.webContents.send('kept', kept)
    lan?.tell('kept', kept)
  }
  win.webContents.on('did-finish-load', tellKept)
  asks('keep', (key: unknown, value: unknown): void => {
    const now = keep(kept, key, value)
    if (JSON.stringify(now) === JSON.stringify(kept)) return
    kept = now
    try {
      writeFileSync(`${keptFile}.new`, JSON.stringify(kept))
      renameSync(`${keptFile}.new`, keptFile)
    } catch {
      // kept for this run only
    }
    tellKept()
  })
  // The prices of the auction house the window shows (M18-F7): asked for by the window, which knows
  // the house, and kept beside the settings. TWINMAP_PRICES, for trials, names another address.
  // Alerts on those prices (M18-F10), checked at every new listing; a met one goes to the game too when asked (sendParts, below).
  const alerts = startAlerts(join(app.getPath('userData'), 'alerts.json'), (all) => {
    if (!win.isDestroyed()) win.webContents.send('alerts', all)
    lan?.tell('alerts', all)
  }, (parts) => void sendParts(parts))
  let checked: Listing | null = null
  const prices = startPrices(join(app.getPath('userData'), 'prices'), (told) => {
    if (!win.isDestroyed()) win.webContents.send('prices', told)
    lan?.tell('prices', told)
    if (told.listing !== checked) alerts.check((checked = told.listing))
  }, process.env.TWINMAP_PRICES)
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('prices', prices.told())
    win.webContents.send('alerts', alerts.all())
  })
  asks('ah-alert', (asked: unknown): void => alerts.set(asked, prices.told().listing))
  asks('ah-unalert', (t: unknown): void => alerts.remove(t))
  asks('ah-house', (region: unknown, house: unknown): void => prices.want(region, house))
  asks('ah-again', (): void => prices.again())
  asks('ah-history', (keys: unknown, days: unknown) => prices.history(keys, days))
  // What the window may ask for, and only this: to let the player pick the game folder, to open the
  // addon's page on CurseForge in the browser, and (further down) to keep the window over the others.
  ipcMain.handle('choose-game-folder', async (): Promise<string | null> => {
    const picked = await dialog.showOpenDialog(win, { title: t('app.main.pickFolder'), properties: ['openDirectory'] })
    const chosen = picked.filePaths[0]
    if (picked.canceled || !chosen) return null
    const found = gameFolderFrom([chosen])
    if (!found) return t('app.main.notGame')
    settings.gameFolder = found
    writeSettings(settingsFile, settings)
    if (found !== gameFolder) {
      gameFolder = found
      channel = null
      tiles.stop()
      tiles = startTiles(found)
      quests.stop()
      quests = startQuests(found, tellQuests)
      walks.stop()
      walks = startWalks(found)
    }
    return null
  })
  // The search of the top row: what was typed, cut to a sane length.
  asks('search', (typed: unknown): Promise<Found[]> => (typeof typed === 'string' ? quests.search(typed.slice(0, 80)) : Promise.resolve([])))
  // Who sells an item, who drops it, where it is found: for its popup.
  asks('item-sources', (item: unknown): Promise<ItemSources> => (Number.isInteger(item) && (item as number) > 0 ? quests.sources(item as number) : Promise.resolve({ sold: [], drops: [], found: [] })))
  // The way on foot between two points of a continent, for the line of the journey.
  asks('walk', (asked: unknown): Promise<WalkPath> => {
    const ask = walkAskFrom(asked)
    return ask ? walks.find(ask) : Promise.resolve(null)
  })
  // How far on foot from one point to many: for Nearby, the search, the label of a point.
  asks('walk-far', (asked: unknown): Promise<Far> => {
    const ask = farAskFrom(asked)
    return ask ? walks.far(ask) : Promise.resolve([])
  })
  // The floor the character stands on, each time it moves: is something it can walk on over it.
  asks('walk-track', (asked: unknown): Promise<Floors> => {
    const ask = trackAskFrom(asked)
    return ask ? walks.track(ask) : Promise.resolve(null)
  })
  ipcMain.handle('open-curseforge', (_event, addon: unknown) => shell.openExternal(pageOf(addon)))
  // Feedback: an issue on GitHub or a letter in the player's mail program, and no other address.
  ipcMain.handle('open-feedback', (_event, way: unknown, details: unknown) => {
    const link = feedbackLink(way, details)
    if (link) void shell.openExternal(link)
  })
  // The latest lines of the app's record, for the player to copy.
  asks('read-log', (): string => record.read())
  asks('lang', (): string => langNow())
  // What the player wrote in the Feedback window, sent when they press Send. TWINMAP_API, for trials, names another address.
  asks('send-feedback', (sent: unknown): Promise<string | null> => sendFeedback(sent, record.read, process.env.TWINMAP_API))
  // A conversion that failed is started again, from where it stopped: the cause may be gone (a full disk, a folder in use).
  asks('retry-tiles', () => {
    if (tiles.status().state !== 'failed') return
    tiles.stop()
    tiles = startTiles(gameFolder)
  })
  // Where the first run stands, looked at every couple of seconds: an addon installed meanwhile shows by itself.
  // The map on the home network, for a phone or a tablet as the second screen: off until the player
  // turns it on in the settings. The same page, the same map files, and what a page may ask for above.
  let lan: Lan | null = null
  let lanWord: SetupStatus['lan'] = null
  const lookSetup = (): SetupStatus => ({ ...setupStatus(gameFolder, settings, app.getVersion()), lan: lanWord, zoom: settings.zoom ?? 1, gpu: { chosen: settings.noGpu !== true, running: GPU }, lang: langNow(), langs: planned(), gameLang: gameLang(), askLang })
  const lanUrl = async (): Promise<void> => {
    const address = await homeAddress()
    if (lan) lanWord = address ? { url: `http://${address}:${LAN_PORT}/?k=${settings.lanCode}` } : { error: t('app.main.noNetwork') }
  }
  const turnLan = (on: boolean): void => {
    lan?.stop()
    lan = null
    lanWord = null
    if (!on) return
    if (!settings.lanCode) {
      settings.lanCode = randomBytes(9).toString('base64url')
      writeSettings(settingsFile, settings)
    }
    const started = startLan(LAN_PORT, { code: settings.lanCode, page: join(__dirname, '../renderer'), tile: served, calls }, (message) => {
      if (lan !== started) return
      lan = null
      lanWord = { error: message }
    })
    lan = started
    lan.tell('quests', questsNow)
    lan.tell('kept', kept)
    lan.tell('sheets', sheets)
    lan.tell('portraits', portraitsTold())
    lan.tell('prices', prices.told())
    lan.tell('alerts', alerts.all())
    void lanUrl()
  }
  ipcMain.handle('set-lan', (_event, on: unknown) => {
    settings.lan = on === true
    writeSettings(settingsFile, settings)
    turnLan(settings.lan)
    setup = lookSetup()
  })
  ipcMain.handle('set-participate', (_event, on: unknown) => {
    settings.participate = on === true
    writeSettings(settingsFile, settings)
    setup = lookSetup()
    // The addon keeps its log only after a yes, and lets go of it at a no: told at once, and again at every start (readyChannel).
    if (!gameFolder || !channel) return
    try {
      send(addonsFolder(gameFolder), { log: participates() }, addonHearsFonts(gameFolder))
    } catch {
      // the way to the game is not there: it is told at the next start
    }
  })
  let setup = lookSetup()
  // The way back to the game: once the addon is there, the bank of font names and the slots go next
  // to it, by themselves and once. Where that fails (a folder that cannot be written) the map works all the same.
  let channel: Promise<unknown> | null = null
  // The character sheets (Sheet.lua): one for each character seen, in a file beside the settings,
  // written whole and then put in place, as the pins are. The addon sends what changed after the
  // revision the app holds; the app tells that revision back, the part "sheet", and the addon stops.
  // It is told too when the channel is ready, with the sync: what changed while the app was closed then comes.
  const sheetsFile = join(app.getPath('userData'), 'sheets.json')
  let sheets: Sheets = {}
  try {
    sheets = sheetsFrom(JSON.parse(readFileSync(sheetsFile, 'utf8')))
  } catch {
    // no character seen yet
  }
  // Every screen is told the sheets, for the picker of the character: at load, and at every change.
  const tellSheets = (): void => {
    if (!win.isDestroyed()) win.webContents.send('sheets', sheets)
    lan?.tell('sheets', sheets)
  }
  win.webContents.on('did-finish-load', tellSheets)
  const writeSheets = (): void => {
    try {
      writeFileSync(`${sheetsFile}.new`, JSON.stringify(sheets))
      renameSync(`${sheetsFile}.new`, sheetsFile)
    } catch {
      // kept for this run only: the addon is told all the same, and sends again what is lost when the app opens next
    }
    tellSheets()
  }
  // The tooltips of the items (M10-F15): sent once each with the sheet, kept here for good, every character's together.
  const tipsFile = join(app.getPath('userData'), 'tips.json')
  let tips: Tips = {}
  try {
    tips = tipsFrom(JSON.parse(readFileSync(tipsFile, 'utf8')))
  } catch {
    // none yet
  }
  const tellTips = (): void => {
    if (!win.isDestroyed()) win.webContents.send('tips', tips)
    lan?.tell('tips', tips)
  }
  win.webContents.on('did-finish-load', tellTips)
  const takeTips = (sent: unknown): void => {
    const news = tipsFrom(sent)
    if (!Object.keys(news).some((key) => JSON.stringify(tips[key]) !== JSON.stringify(news[key]))) return
    tips = { ...tips, ...news }
    try {
      writeFileSync(`${tipsFile}.new`, JSON.stringify(tips))
      renameSync(`${tipsFile}.new`, tipsFile)
    } catch {
      // kept for this run only
    }
    tellTips()
  }
  const tellHeld = (): void => {
    if (!gameFolder) return
    try {
      const addons = addonsFolder(gameFolder), held = heldOf(sheets)
      if (JSON.stringify(sentParts(addons).sheet) !== JSON.stringify(held)) send(addons, { sheet: held }, addonHearsFonts(gameFolder))
    } catch {
      // the way to the game is not there yet: the addon sends again until it is
    }
  }
  let sheetHeard = ''
  const takeSheet = (section: unknown): void => {
    const text = JSON.stringify(section ?? null)
    if (text === sheetHeard) return
    sheetHeard = text
    const sent = sheetNewsFrom(section)
    if (!sent) return
    // The tooltips go to their own file: the sheet keeps none of them.
    const { tips: sentTips, ...pieces } = sent.p
    if (sentTips !== undefined) takeTips(sentTips)
    const news = { ...sent, p: pieces }
    const now = mergeSheet(sheets, news, Date.now())
    if (now !== sheets) {
      sheets = now
      record.note('sheet', `revision ${news.rev}: ${Object.keys(sent.p).sort().join(', ')}`) // which pieces came, never what is in them
      writeSheets()
    }
    tellHeld()
  }
  // The pictures of the characters, read off the game's window while its character window shows the
  // model: when there is none yet, when what is worn is no longer what the picture shows, and when
  // the player asks for a new one (Retake), which waits for the window to be open.
  const portraitsFile = join(app.getPath('userData'), 'portraits.json')
  let portraits: Portraits = {}
  try {
    portraits = portraitsFrom(JSON.parse(readFileSync(portraitsFile, 'utf8')))
  } catch {
    // none taken yet
  }
  let retake: string | null = null
  const portraitsTold = (): PortraitsTold => ({ taken: portraits, retake })
  const tellPortraits = (): void => {
    if (!win.isDestroyed()) win.webContents.send('portraits', portraitsTold())
    lan?.tell('portraits', portraitsTold())
  }
  win.webContents.on('did-finish-load', tellPortraits)
  const keepPortraits = (now: Portraits): void => {
    portraits = now
    try {
      writeFileSync(`${portraitsFile}.new`, JSON.stringify(portraits))
      renameSync(`${portraitsFile}.new`, portraitsFile)
    } catch {
      // kept for this run only
    }
    tellPortraits()
  }
  const PORTRAIT_EVERY = 250 // ms between two looks at whether a picture is to be taken
  let portraitLooked = 0, portraitAwaited = false
  const lookPortrait = (state: LinkSnapshot['state'], now: number): void => {
    if (portraitAwaited || now - portraitLooked < PORTRAIT_EVERY) return
    portraitLooked = now
    // ponytail: a model told by a strip that then stopped (the addon paused with the window open) is still believed; only Retake can then take what is there
    const box = modelFrom(state.sections.model), sheet = box ? sheets[box.key] : undefined
    const gear = sheet && wornKey(sheet.pieces.gear)
    if (!box || !pictureDue(box, now - (state.updatedAt.model ?? now), gear, portraits[box.key], retake)) return
    const cut = link.cut(box.x, box.y, box.w, box.h)
    if (!cut) return // the game is not on show there now: at the next look
    const keep = (rgb: Uint8Array, how: string): void => {
      try {
        mkdirSync(portraitsFolder, { recursive: true })
        writeFileSync(portraitFile(box.key), encodePng(rgb, cut.width, cut.height))
      } catch {
        return
      }
      if (retake === box.key) retake = null
      record.say(`portrait taken${how}`) // never whose
      keepPortraits({ ...portraits, [box.key]: { at: now, gear: gear! } })
    }
    if (!burnt(cut.rgb)) return keep(cut.rgb, '')
    // Its lights are cut, as with Auto HDR on (shared/hdr.ts): the same rectangle is read again in floating point,
    // and that picture kept if there is one. Nothing else is looked at meanwhile.
    // ponytail: what came over the model in that moment is in the picture; Retake takes another.
    portraitAwaited = true
    void readHdr({ ...cut.at, width: cut.width, height: cut.height, seen: cut.rgb }).then((read) => {
      portraitAwaited = false
      keep(read?.rgb ?? cut.rgb, read ? ', read in HDR' : ', its lights cut')
    })
  }
  // Retake: a new picture of this character as soon as its model is on show; null takes the asking back.
  asks('retake-portrait', (key: unknown): void => {
    retake = typeof key === 'string' && Object.hasOwn(sheets, key) ? key : null
    tellPortraits()
  })
  // Save: a copy of the picture where the player says. The window's own: a browser on the home network downloads it.
  ipcMain.handle('save-portrait', async (_event, key: unknown): Promise<void> => {
    if (typeof key !== 'string' || !Object.hasOwn(portraits, key)) return
    const picked = await dialog.showSaveDialog(win, { title: t('app.main.savePicture', { name: key }), defaultPath: `${key}.png`, filters: [{ name: 'PNG', extensions: ['png'] }] })
    if (!picked.canceled && picked.filePath) await copyFile(portraitFile(key), picked.filePath).catch(() => {})
  })
  // A character the player no longer wants listed. The one in game comes back whole at its next send.
  asks('forget-sheet', (key: unknown): void => {
    if (typeof key !== 'string' || !Object.hasOwn(sheets, key)) return
    sheets = Object.fromEntries(Object.entries(sheets).filter(([k]) => k !== key))
    writeSheets()
    tellHeld()
    if (retake === key) retake = null
    rmSync(portraitFile(key), { force: true })
    keepPortraits(Object.fromEntries(Object.entries(portraits).filter(([k]) => k !== key)))
  })
  // My pins: the game draws them on its own map, so it is to have the points saved here and no
  // other. The window tells them at every change and when it loads; only what changed is sent.
  // A send the addon has not read yet when the next one leaves costs one of its slots, and it reads
  // every 5 seconds: so the changes of a few seconds go out together, and never right behind the send before.
  const MARKS_WAIT = 8000
  let marksAsked: unknown = null
  let takenAsked: string[] = [] // the marks set in the game that are now among the pins here: told with them, in the same send
  let marksTimer: ReturnType<typeof setTimeout> | null = null
  const sendMarks = (): void => {
    marksTimer = null
    if (!gameFolder) return
    try {
      const addons = addonsFolder(gameFolder)
      const have = sentParts(addons)
      const changed: Record<string, unknown> | null = marksNews(marksAsked, have)
      if (!changed) return
      if (JSON.stringify(have.taken ?? []) !== JSON.stringify(takenAsked)) changed.taken = takenAsked.length > 0 ? takenAsked : false
      if (Object.keys(changed).length > 0) send(addons, changed, addonHearsFonts(gameFolder))
    } catch {
      // the way to the game is not there yet: they go once it is
    }
  }
  const readyChannel = (): void => {
    if (!gameFolder || setup.addon === null || channel) return
    const addons = addonsFolder(gameFolder)
    // Once the way is there, the addon is told that this app was just opened and has heard nothing yet:
    // a game already running then sends everything again at once. With it goes the version of this
    // app, which is the newest the addon can be: an older addon says so in the game's chat.
    // Small enough to ride the font. And whether the addon is to keep its log (Log.lua): the
    // player's choice, told again at every start, since it may have changed with the game closed.
    // The slots are for an addon from before the fonts carried everything. Beside one of today they
    // are thirty folders nothing loads: taken away, with the game closed, since a game that started
    // with an older addon may still load one.
    const fonts = addonHearsFonts(gameFolder)
    if (fonts && findGameWindow() === null) {
      const gone = removeSlots(addons)
      if (gone) record.say(`took away ${gone} slot folders the addon no longer needs`)
    }
    channel = installChannel(addons, !fonts)
      // The pause is taken back too: one asked by a run of the app that closed while paused is not to stay.
      .then(() => void send(addons, { sync: Date.now(), latest: app.getVersion(), sheet: heldOf(sheets), log: participates(), ...(fonts ? { pause: paused ? Date.now() : false } : {}) }, addonHearsFonts(gameFolder!)))
      .then(() => (marksTimer ??= setTimeout(sendMarks, MARKS_WAIT)))
      .catch(() => {})
  }
  readyChannel()
  // Send to game: a point of the map becomes a pin in the game. The answer is the number of the
  // send, which the addon tells back on the strip once it has it, or what went wrong.
  type Sent = { seq: number } | { error: string }
  const sendParts = (parts: Record<string, unknown> | null): Sent => {
    if (!parts || !gameFolder) return { error: t('app.main.nothingToSend') }
    try {
      return { seq: send(addonsFolder(gameFolder), parts, addonHearsFonts(gameFolder)).seq }
    } catch {
      return { error: t('app.main.cannotWrite') }
    }
  }
  // The Pause button (tellPause, above).
  asks('set-pause', (on: unknown): void => {
    if ((on === true) === paused) return
    paused = on === true
    link.pause(paused)
    record.say(paused ? 'paused' : 'resumed')
    tellPause()
  })
  asks('send-pin', (asked: unknown): Sent => {
    const pin = pinFrom(asked)
    return sendParts(pin && { pin: { ...pin, t: Date.now() } })
  })
  asks('send-marks', (asked: unknown, taken: unknown): void => {
    marksAsked = asked
    takenAsked = takenFrom(taken)
    marksTimer ??= setTimeout(sendMarks, MARKS_WAIT)
  })
  // The point the game's arrow follows by itself is let go: a number new each time, so the addon acts once.
  asks('send-unfollow', (): Sent => sendParts({ unfollow: Date.now() }))
  // The route, whole, or false to take it away from the game; and a step ahead on the route the game has.
  asks('send-route', (asked: unknown): Sent => {
    const route = routeNewsFrom(asked)
    return sendParts(route === null ? null : { route })
  })
  asks('send-step', (asked: unknown): Sent => {
    const step = stepFrom(asked)
    return sendParts(step && { step })
  })
  win.setAlwaysOnTop(settings.onTop === true)
  // From the settings: the window over the others or not. The choice is kept.
  ipcMain.handle('set-on-top', (_event, on: unknown) => {
    settings.onTop = on === true
    writeSettings(settingsFile, settings)
    win.setAlwaysOnTop(settings.onTop)
    setup = lookSetup()
  })
  // Hardware acceleration on or off: kept, and taken at the next start. Restart starts the app again at once.
  ipcMain.handle('set-gpu', (_event, on: unknown) => {
    settings.noGpu = on !== true
    writeSettings(settingsFile, settings)
    setup = lookSetup()
  })
  // A language chosen in the settings: kept, spoken here at once, and the pages load again in it (App.svelte).
  ipcMain.handle('set-lang', (_event, code: unknown) => {
    settings.lang = setLang(code)
    settings.langAsked = true
    writeSettings(settingsFile, settings)
    setup = lookSetup()
  })
  // The window after the update closed, never asked again: with Done the language shown is kept, with the cross the
  // app stays in English, as it was before the update.
  ipcMain.handle('lang-asked', (_event, code: unknown) => {
    askLang = false
    settings.langAsked = true
    settings.lang = setLang(offered(code) ? code : 'enUS')
    writeSettings(settingsFile, settings)
    setup = lookSetup()
  })
  ipcMain.handle('restart', () => {
    record.say('restart: asked from the settings')
    app.relaunch()
    app.quit()
  })
  // The size of the whole window: from the settings, Ctrl with + - 0, Ctrl with the wheel. The choice is kept.
  // Windows' three buttons grow with the top row they sit in. The page loaded again keeps the size too.
  const showZoom = (): void => {
    const zoom = settings.zoom ?? 1
    win.webContents.setZoomFactor(zoom)
    win.setTitleBarOverlay({ height: Math.round(WINDOW.top * zoom) })
  }
  const zoomTo = (zoom: unknown): void => {
    if (!ZOOMS.some((z) => z === zoom)) return
    settings.zoom = zoom as number
    writeSettings(settingsFile, settings)
    showZoom()
    setup = lookSetup()
  }
  showZoom()
  win.webContents.on('did-finish-load', showZoom)
  ipcMain.handle('set-zoom', (_event, zoom: unknown) => zoomTo(zoom))
  // Ctrl and the wheel, from the page: it alone knows whether the map took the wheel first. (Electron's zoom-changed
  // comes all the same, at times twice for one turn.)
  ipcMain.handle('zoom-by', (_event, by: unknown) => zoomTo(zoomStep(settings.zoom ?? 1, by === -1 ? -1 : 1)))
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) return
    const by = input.key === '+' || input.key === '=' ? 1 : input.key === '-' ? -1 : input.key === '0' ? 0 : null
    if (by === null) return
    zoomTo(by === 0 ? 1 : zoomStep(settings.zoom ?? 1, by))
    event.preventDefault()
  })
  const look = setInterval(() => {
    if (!gameFolder && (gameFolder = findGameFolder(settings.gameFolder))) quests = startQuests(gameFolder, tellQuests) // the game may be started after the app
    if (gameFolder && tiles.status().state === 'no-game') tiles = startTiles(gameFolder)
    setup = lookSetup()
    // The record: each of these is written when it changes, not every two seconds.
    const made = tiles.status(), heard = linkStatus(link.snapshot(), Date.now())
    record.note('game folder', gameFolder ? 'found' : 'not found')
    record.note('addon', setup.addon ?? 'not installed')
    record.note('optional addons', `Questie ${setup.questie ? 'yes' : 'no'}, Shortest Path ${setup.shortestPath ? 'yes' : 'no'}`)
    record.note('map', made.state === 'converting' ? 'being built' : tilesLine(made))
    record.note('link', heard.kind === 'update-app' || heard.kind === 'update-addon' ? `${heard.word}: ${heard.line}` : heard.word)
    // What the game says it has of the sends: a slot gone with no send beside it is a read that went wrong.
    const inbox = inboxFrom(link.snapshot().state.sections.inbox)
    if (inbox) record.note('game has', `send ${inbox.seq}, ${inbox.left} slots left${inbox.off ? `, ${inbox.off}` : ''}`)
    readyChannel()
    void lanUrl() // the address of this computer may change while the app is open
    if (!settings.setupDone && setupComplete(setupPages(setup, tiles.status(), linkStatus(link.snapshot(), Date.now())))) {
      settings.setupDone = true
      settings.langAsked = true // the first run asked for it
      writeSettings(settingsFile, settings)
    }
  }, 2000)
  protocol.handle('twinmap', async (request) => {
    const url = new URL(request.url)
    const { status, type, bytes } = url.host === 'tiles' ? await served(url.pathname) : ({ status: 404 } as Served)
    return new Response(bytes ? new Uint8Array(bytes) : null, { status, headers: { ...(type ? { 'content-type': type } : {}), 'access-control-allow-origin': '*', ...(bytes && bytes !== BLANK ? { 'cache-control': 'max-age=3600' } : {}) } })
  })
  turnLan(settings.lan === true)
  let lanTick = false
  let heardLast = ''
  const show = setInterval(() => {
    const snapshot = link.snapshot()
    // What the addon says it has of the sends: the font is written again when it needs something else.
    const inbox = inboxFrom(snapshot.state.sections.inbox), heardNow = JSON.stringify(inbox)
    if (gameFolder && inbox?.id !== undefined && heardNow !== heardLast) {
      heardLast = heardNow
      try {
        hear(addonsFolder(gameFolder), { id: inbox.id, seq: inbox.seq, ...(inbox.got ? { got: inbox.got } : {}) })
      } catch {
        // the folder cannot be written now: at the next change
      }
    }
    quests.show(snapshot.state.sections.questie, snapshot.state.sections.quests)
    bosses.kills(snapshot.state.sections.kills, Date.now())
    takeSheet(snapshot.state.sections.sheet)
    lookPortrait(snapshot.state, Date.now())
    win.webContents.send('link', snapshot)
    win.webContents.send('tiles', tiles.status())
    win.webContents.send('setup', setup)
    if (!lan) return
    // ponytail: the whole snapshot ten times a second; only what changed, if a phone's battery or the wifi says so (M11-F6)
    if ((lanTick = !lanTick)) lan.tell('link', snapshot)
    lan.tell('tiles', tiles.status())
    lan.tell('setup', setup)
  }, SHOW_EVERY)

  // Inside a dungeon or a raid only this app knows where the character is, from the minimap. In a
  // group it tells the addon, which tells the companions' Twinmap: to the yard, when it changed, as
  // often as the addon reads inside. Out of there, or alone, the place is taken back; one left by an
  // app closed inside is taken back at the next start.
  const HERE_EVERY = 1500
  let hereSaid: string | null = null
  const tellHere = setInterval(() => {
    if (!gameFolder || !addonHearsFonts(gameFolder)) return
    const state = link.snapshot().state, inst = state.sections.pos?.inst
    const grouped = groupFrom(state.sections.group).length > 0
    const here = grouped && inst?.x !== undefined && inst.y !== undefined && { i: inst.id, x: Math.round(inst.x), y: Math.round(inst.y), l: inst.level ?? 0 }
    try {
      const addons = addonsFolder(gameFolder)
      hereSaid ??= JSON.stringify(sentParts(addons).here ?? false)
      if (JSON.stringify(here) === hereSaid) return
      send(addons, { here }, true)
      hereSaid = JSON.stringify(here)
    } catch {
      // the way to the game is not there yet
    }
  }, HERE_EVERY)

  // TWINMAP_TRIAL, for a trial of the way to the game with nobody clicking: 40 sends one behind the
  // other, each once the game has the one before, then one too big for a font, then five more, each
  // sent while the game says it is in a fight. All in the record. The part sent is one the addon
  // keeps and does nothing with, and the last send takes it away.
  if (process.env.TWINMAP_TRIAL) {
    const ROW = 40, FIGHTS = 5, began = Date.now()
    let n = 0, awaited = 0, at = 0
    const trial = setInterval(() => {
      const state = link.snapshot().state, inbox = inboxFrom(state.sections.inbox), fight = state.sections.pos?.combat === true
      if (!gameFolder || inbox?.id === undefined || Date.now() - began < 15000) return
      if (awaited) {
        if (!arrived(inbox, awaited)) return
        record.say(`trial ${n}: send ${awaited} arrived after ${Date.now() - at} ms${fight ? ', in a fight' : ''}`)
        awaited = 0
        if (n > ROW + 1 + FIGHTS) return clearInterval(trial)
      }
      const last = n === ROW + 1 + FIGHTS
      if (n > ROW && !last && !fight) return // the rest waits for a fight
      n++
      at = Date.now()
      try {
        awaited = send(addonsFolder(gameFolder), { trial: last ? false : n === ROW + 1 ? 'x'.repeat(3000) : n }, true).seq
        if (fight) record.say(`trial ${n}: sent in a fight`)
      } catch {
        n--
      }
    }, 250)
  }

  // The measures of a live session, for whoever tunes the link: read, lost, processor.
  const logFile = join(app.getPath('userData'), 'link-measures.json')
  const log = setInterval(() => {
    const s = link.snapshot(), seen = link.inside()
    const measures = {
      at: new Date().toISOString(),
      game: s.game,
      seconds: Math.round(s.seconds),
      reads: s.reads,
      blocks: s.state.blocks,
      lost: s.state.lost,
      lostPercent: Number(lostPercent(s.state).toFixed(2)),
      corrupt: s.state.corrupt,
      cpuPercent: Number(s.cpu.toFixed(2)),
      protocol: s.state.protocol?.message ?? null,
      pos: s.state.sections.pos ?? null,
      tiles: tiles.status(),
      // Inside a dungeon: what the last look at the minimap came to, and beside this file the square of the screen it looked at.
      inside: seen?.report ?? null,
    }
    void writeFile(logFile, JSON.stringify(measures, null, 1)).catch(() => {})
    if (seen?.seen) void writeFile(join(app.getPath('userData'), 'minimap-seen.png'), encodePng(seen.seen.rgb, seen.seen.size, seen.seen.size)).catch(() => {})
  }, LOG_EVERY)

  win.on('closed', () => {
    clearInterval(show)
    clearInterval(tellHere)
    clearInterval(log)
    clearInterval(look)
    ipcMain.removeHandler('choose-game-folder')
    ipcMain.removeHandler('open-curseforge')
    ipcMain.removeHandler('open-feedback')
    ipcMain.removeHandler('set-on-top')
    ipcMain.removeHandler('set-zoom')
    ipcMain.removeHandler('set-gpu')
    ipcMain.removeHandler('set-lang')
    ipcMain.removeHandler('lang-asked')
    ipcMain.removeHandler('restart')
    ipcMain.removeHandler('zoom-by')
    ipcMain.removeHandler('set-lan')
    ipcMain.removeHandler('set-participate')
    ipcMain.removeHandler('save-portrait')
    for (const name of Object.keys(calls)) ipcMain.removeHandler(name)
    lan?.stop()
    if (marksTimer) clearTimeout(marksTimer)
    link.stop()
    gameLog.stop()
    health.stop()
    tiles.stop()
    quests.stop()
    walks.stop()
    prices.stop()
    protocol.unhandle('twinmap')
  })
}

// The shipped app has no menu: with no title bar there is no place for one, and Alt must not bring one up.
if (app.isPackaged) Menu.setApplicationMenu(null)

// A newer version of the app, if there is one, comes first: see update.ts.
void app.whenReady().then(() => {
  record.say(`started: Twinmap ${app.getVersion()}${GPU ? '' : ', hardware acceleration off'}`)
  updateFirst(createWindow, (line) => record.say(`update: ${line}`))
})

// Windows only: closing the last window closes the app.
app.on('window-all-closed', () => app.quit())
