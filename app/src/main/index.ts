import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, shell } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { linkStatus, lostPercent } from '../shared/link'
import { shownFrom, type QuestsStatus } from '../shared/quests'
import type { Found } from '../shared/search'
import { marksNews, pinFrom, routeNewsFrom, stepFrom, takenFrom } from '../shared/send'
import { CURSEFORGE, setupComplete, setupPages } from '../shared/setup'
import type { TilesStatus } from '../shared/tiles-status'
import { placeWindow, WINDOW } from '../shared/window'
import { findGameWindow, programOf } from './capture'
import { gameFolderFrom, registryInstallPath } from './client-files'
import { startLink } from './link'
import type { Answer, Asked } from './questie-worker'
import startQuestieWorker from './questie-worker?nodeWorker'
import { addonsFolder, readSettings, setupStatus, writeSettings } from './setup'
import { installChannel, send, sentParts } from './signal'
import { servedFile } from './tiles'
import startTilesWorker from './tiles-worker?nodeWorker'
import startWalkWorker from './walk-worker?nodeWorker'
import { navFolder } from './nav'
import { farAskFrom, walkAskFrom, type Far, type FarAsk, type WalkAsk, type WalkPath } from '../shared/walk'

const SHOW_EVERY = 50 // ms between updates of the window: a position must be there well before the arrow needs it (BEHIND in glide.ts)
const LOG_EVERY = 5000 // ms between writes of the measures
const SHOW_AFTER = 3000 // ms after which the window shows itself even if its page has not said it is drawn

const BLANK = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64') // a see-through picture of one pixel

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
function startTiles(gameFolder: string | null): { status: () => TilesStatus; stop: () => void } {
  let status: TilesStatus = { state: 'looking' }
  if (!gameFolder) return { status: () => ({ state: 'no-game' }), stop: () => {} }
  const base = process.env.TWINMAP_DATA ?? join(process.env.LOCALAPPDATA ?? app.getPath('userData'), 'Twinmap')
  const worker = startTilesWorker({ workerData: { gameFolder, base } })
  worker.on('message', (told: TilesStatus) => (status = told))
  worker.on('error', (e) => (status = { state: 'failed', message: e instanceof Error ? e.message : String(e) }))
  return { status: () => status, stop: () => void worker.terminate() }
}

// The quests on the map: the player's QuestieDB is opened once, and asked for the pins of what
// Questie shows each time the addon tells something new. tell: called with every answer.
function startQuests(gameFolder: string | null, tell: (status: QuestsStatus) => void): { show: (section: unknown) => void; search: (typed: string) => Promise<Found[]>; stop: () => void } {
  if (!gameFolder) return { show: () => {}, search: () => Promise.resolve([]), stop: () => {} }
  const worker = startQuestieWorker({ workerData: { gameFolder } })
  // A search waits for the answer that carries its number.
  const asked = new Map<number, (found: Found[]) => void>()
  let searches = 0
  const post = (message: Asked): void => worker.postMessage(message)
  worker.on('message', (told: QuestsStatus | Answer) => {
    if (!('found' in told)) return tell(told)
    asked.get(told.id)?.(told.found)
    asked.delete(told.id)
  })
  worker.on('error', () => {
    tell({ questie: null, pins: [], fixed: [] }) // no quests on the map; the rest of the app goes on
    for (const answer of asked.values()) answer([])
    asked.clear()
  })
  let last = ''
  return {
    show: (section) => {
      const told = JSON.stringify(section ?? null)
      if (told === last) return
      last = told
      post({ shown: shownFrom(section) })
    },
    search: (typed) =>
      new Promise((answer) => {
        asked.set(++searches, answer)
        post({ search: typed, id: searches })
      }),
    stop: () => void worker.terminate(),
  }
}

// The ways on foot: found on a thread of its own, each asking answered under its number.
function startWalks(gameFolder: string | null): { find: (ask: WalkAsk) => Promise<WalkPath>; far: (ask: FarAsk) => Promise<Far>; stop: () => void } {
  const worker = startWalkWorker({ workerData: { gameFolder, shipped: navFolder() } })
  const asked = new Map<number, (path: WalkPath | Far) => void>()
  let asks = 0
  worker.on('message', (told: { id: number; path: WalkPath | Far }) => {
    asked.get(told.id)?.(told.path)
    asked.delete(told.id)
  })
  worker.on('error', () => {
    for (const answer of asked.values()) answer(null) // no line on the map, distances as the crow flies; the rest of the app goes on
    asked.clear()
  })
  const ask = <T extends WalkPath | Far>(what: WalkAsk | FarAsk): Promise<T | null> =>
    new Promise((answer) => {
      asked.set(++asks, answer as (path: WalkPath | Far) => void)
      worker.postMessage({ id: asks, ask: what })
    })
  return {
    find: (what) => ask<WalkPath>(what),
    far: async (what) => (await ask<Far>(what)) ?? what.to.map(() => null),
    stop: () => void worker.terminate(),
  }
}

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

  // In development the renderer comes from the dev server, in a build from disk.
  // TWINMAP_KIT opens the trial page of the basic controls instead of the app.
  const devUrl = process.env.ELECTRON_RENDERER_URL, hash = process.env.TWINMAP_KIT ? 'kit' : ''
  if (devUrl) void win.loadURL(`${devUrl}#${hash}`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })

  const link = startLink(() => {
    const made = tiles.status()
    return made.state === 'ready' ? made.folder : null
  })
  const settingsFile = join(app.getPath('userData'), 'settings.json')
  const settings = readSettings(settingsFile)
  let gameFolder = findGameFolder(settings.gameFolder)
  let tiles = startTiles(gameFolder)
  // The pins go to the window when they change, and once more when its page has loaded.
  let questsNow: QuestsStatus = { questie: null, pins: [] }
  const tellQuests = (status: QuestsStatus): void => {
    questsNow = { ...status, fixed: status.fixed ?? questsNow.fixed } // the fixed pins come once: kept for a page that loads later
    if (!win.isDestroyed()) win.webContents.send('quests', status)
  }
  let quests = startQuests(gameFolder, tellQuests)
  let walks = startWalks(gameFolder)
  win.webContents.on('did-finish-load', () => win.webContents.send('quests', questsNow))

  // What the window may ask for, and only this: to let the player pick the game folder, to open the
  // addon's page on CurseForge in the browser, and (further down) to keep the window over the others.
  ipcMain.handle('choose-game-folder', async (): Promise<string | null> => {
    const picked = await dialog.showOpenDialog(win, { title: 'Where World of Warcraft: Forever is installed', properties: ['openDirectory'] })
    const chosen = picked.filePaths[0]
    if (picked.canceled || !chosen) return null
    const found = gameFolderFrom([chosen])
    if (!found) return 'World of Warcraft: Forever is not in that folder. Choose the one that holds _forever_.'
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
  ipcMain.handle('search', (_event, typed: unknown): Promise<Found[]> => (typeof typed === 'string' ? quests.search(typed.slice(0, 80)) : Promise.resolve([])))
  // The way on foot between two points of a continent, for the line of the journey.
  ipcMain.handle('walk', (_event, asked: unknown): Promise<WalkPath> => {
    const ask = walkAskFrom(asked)
    return ask ? walks.find(ask) : Promise.resolve(null)
  })
  // How far on foot from one point to many: for Nearby, the search, the label of a point.
  ipcMain.handle('walk-far', (_event, asked: unknown): Promise<Far> => {
    const ask = farAskFrom(asked)
    return ask ? walks.far(ask) : Promise.resolve([])
  })
  ipcMain.handle('open-curseforge', () => shell.openExternal(CURSEFORGE))
  // A conversion that failed is started again, from where it stopped: the cause may be gone (a full disk, a folder in use).
  ipcMain.handle('retry-tiles', () => {
    if (tiles.status().state !== 'failed') return
    tiles.stop()
    tiles = startTiles(gameFolder)
  })
  // Where the first run stands, looked at every couple of seconds: an addon installed meanwhile shows by itself.
  let setup = setupStatus(gameFolder, settings, app.getVersion())
  // The way back to the game: once the addon is there, the bank of font names and the slots go next
  // to it, by themselves and once. Where that fails (a folder that cannot be written) the map works all the same.
  let channel: Promise<unknown> | null = null
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
      if (Object.keys(changed).length > 0) send(addons, changed)
    } catch {
      // the way to the game is not there yet: they go once it is
    }
  }
  const readyChannel = (): void => {
    if (!gameFolder || setup.addon === null || channel) return
    const addons = addonsFolder(gameFolder)
    // Once the way is there, the addon is told that this app was just opened and has heard nothing yet:
    // a game already running then sends everything again at once. Small enough to ride the font.
    channel = installChannel(addons)
      .then(() => void send(addons, { sync: Date.now() }))
      .then(() => (marksTimer ??= setTimeout(sendMarks, MARKS_WAIT)))
      .catch(() => {})
  }
  readyChannel()
  // Send to game: a point of the map becomes a pin in the game. The answer is the number of the
  // send, which the addon tells back on the strip once it has it, or what went wrong.
  type Sent = { seq: number } | { error: string }
  const sendParts = (parts: Record<string, unknown> | null): Sent => {
    if (!parts || !gameFolder) return { error: 'There is nothing to send.' }
    try {
      return { seq: send(addonsFolder(gameFolder), parts).seq }
    } catch {
      return { error: 'Twinmap could not write next to the addon in the game folder.' }
    }
  }
  ipcMain.handle('send-pin', (_event, asked: unknown): Sent => {
    const pin = pinFrom(asked)
    return sendParts(pin && { pin: { ...pin, t: Date.now() } })
  })
  ipcMain.handle('send-marks', (_event, asked: unknown, taken: unknown): void => {
    marksAsked = asked
    takenAsked = takenFrom(taken)
    marksTimer ??= setTimeout(sendMarks, MARKS_WAIT)
  })
  // The point the game's arrow follows by itself is let go: a number new each time, so the addon acts once.
  ipcMain.handle('send-unfollow', (): Sent => sendParts({ unfollow: Date.now() }))
  // The route, whole, or false to take it away from the game; and a step ahead on the route the game has.
  ipcMain.handle('send-route', (_event, asked: unknown): Sent => {
    const route = routeNewsFrom(asked)
    return sendParts(route === null ? null : { route })
  })
  ipcMain.handle('send-step', (_event, asked: unknown): Sent => {
    const step = stepFrom(asked)
    return sendParts(step && { step })
  })
  win.setAlwaysOnTop(settings.onTop === true)
  // From the settings: the window over the others or not. The choice is kept.
  ipcMain.handle('set-on-top', (_event, on: unknown) => {
    settings.onTop = on === true
    writeSettings(settingsFile, settings)
    win.setAlwaysOnTop(settings.onTop)
    setup = setupStatus(gameFolder, settings, app.getVersion())
  })
  const look = setInterval(() => {
    if (!gameFolder && (gameFolder = findGameFolder(settings.gameFolder))) quests = startQuests(gameFolder, tellQuests) // the game may be started after the app
    if (gameFolder && tiles.status().state === 'no-game') tiles = startTiles(gameFolder)
    setup = setupStatus(gameFolder, settings, app.getVersion())
    readyChannel()
    if (!settings.setupDone && setupComplete(setupPages(setup, tiles.status(), linkStatus(link.snapshot(), Date.now())))) {
      settings.setupDone = true
      writeSettings(settingsFile, settings)
    }
  }, 2000)
  protocol.handle('twinmap', async (request) => {
    const status = tiles.status(), url = new URL(request.url)
    const file = status.state === 'ready' && url.host === 'tiles' ? servedFile(status.folder, url.pathname) : null
    const bytes = file ? await readFile(file).catch(() => null) : null
    // Where the game has no picture there is no file. That is the sea, not a fault: an empty picture for
    // a tile and an empty answer for a block, so the window logs no error for it.
    if (!bytes) {
      if (file?.endsWith('.png')) return new Response(new Uint8Array(BLANK), { headers: { 'content-type': 'image/gif', 'access-control-allow-origin': '*' } })
      return new Response(null, { status: file ? 204 : 404, headers: { 'access-control-allow-origin': '*' } })
    }
    const type = file!.endsWith('.png') ? 'image/png' : file!.endsWith('.json') ? 'application/json' : 'application/octet-stream'
    return new Response(new Uint8Array(bytes), { headers: { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'max-age=3600' } })
  })
  const show = setInterval(() => {
    const snapshot = link.snapshot()
    quests.show(snapshot.state.sections.questie)
    win.webContents.send('link', snapshot)
    win.webContents.send('tiles', tiles.status())
    win.webContents.send('setup', setup)
  }, SHOW_EVERY)

  // The measures of a live session, for whoever tunes the link: read, lost, processor.
  const logFile = join(app.getPath('userData'), 'link-measures.json')
  const log = setInterval(() => {
    const s = link.snapshot()
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
    }
    void writeFile(logFile, JSON.stringify(measures, null, 1)).catch(() => {})
  }, LOG_EVERY)

  win.on('closed', () => {
    clearInterval(show)
    clearInterval(log)
    clearInterval(look)
    ipcMain.removeHandler('choose-game-folder')
    ipcMain.removeHandler('open-curseforge')
    ipcMain.removeHandler('retry-tiles')
    ipcMain.removeHandler('set-on-top')
    ipcMain.removeHandler('send-pin')
    ipcMain.removeHandler('send-marks')
    ipcMain.removeHandler('send-unfollow')
    if (marksTimer) clearTimeout(marksTimer)
    ipcMain.removeHandler('send-route')
    ipcMain.removeHandler('send-step')
    link.stop()
    tiles.stop()
    quests.stop()
    walks.stop()
    ipcMain.removeHandler('walk')
    ipcMain.removeHandler('walk-far')
    protocol.unhandle('twinmap')
  })
}

// The shipped app has no menu: with no title bar there is no place for one, and Alt must not bring one up.
if (app.isPackaged) Menu.setApplicationMenu(null)

void app.whenReady().then(createWindow)

// Windows only: closing the last window closes the app.
app.on('window-all-closed', () => app.quit())
