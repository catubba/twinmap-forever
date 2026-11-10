import { app, BrowserWindow, Menu, protocol, screen } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { lostPercent } from '../shared/link'
import type { TilesStatus } from '../shared/tiles-status'
import { placeWindow, WINDOW } from '../shared/window'
import { findGameWindow, programOf } from './capture'
import { gameFolderFrom, registryInstallPath } from './client-files'
import { startLink } from './link'
import { servedFile } from './tiles'
import startTilesWorker from './tiles-worker?nodeWorker'

const SHOW_EVERY = 250 // ms between updates of the window
const LOG_EVERY = 5000 // ms between writes of the measures

const BLANK = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64') // a see-through picture of one pixel

// The window gets the map's files through an address of its own, twinmap://tiles/..., and only those.
protocol.registerSchemesAsPrivileged([{ scheme: 'twinmap', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])

// Makes the map tiles from the game's files, once per build of the game, and keeps the latest word on it.
// The folder: TWINMAP_DATA when set (for trials), or Twinmap under the local application data.
function startTiles(): { status: () => TilesStatus; stop: () => void } {
  let status: TilesStatus = { state: 'looking' }
  const running = findGameWindow()
  const gameFolder = gameFolderFrom([running === null ? null : programOf(running), registryInstallPath()])
  if (!gameFolder) return { status: () => ({ state: 'no-game' }), stop: () => {} }
  const base = process.env.TWINMAP_DATA ?? join(process.env.LOCALAPPDATA ?? app.getPath('userData'), 'Twinmap')
  const worker = startTilesWorker({ workerData: { gameFolder, base } })
  worker.on('message', (told: TilesStatus) => (status = told))
  worker.on('error', (e) => (status = { state: 'failed', message: e instanceof Error ? e.message : String(e) }))
  return { status: () => status, stop: () => void worker.terminate() }
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
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: WINDOW.symbols, height: WINDOW.top },
    webPreferences: { preload: join(__dirname, '../preload/index.js') },
  })
  if ((saved as { maximized?: unknown } | null)?.maximized === true) win.maximize()
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

  const link = startLink()
  const tiles = startTiles()
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
    win.webContents.send('link', link.snapshot())
    win.webContents.send('tiles', tiles.status())
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
    link.stop()
    tiles.stop()
    protocol.unhandle('twinmap')
  })
}

// The shipped app has no menu: with no title bar there is no place for one, and Alt must not bring one up.
if (app.isPackaged) Menu.setApplicationMenu(null)

void app.whenReady().then(createWindow)

// Windows only: closing the last window closes the app.
app.on('window-all-closed', () => app.quit())
