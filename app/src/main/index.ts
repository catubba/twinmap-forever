import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { lostPercent } from '../shared/link'
import { WINDOW } from '../shared/window'
import { startLink } from './link'

const SHOW_EVERY = 250 // ms between updates of the window
const LOG_EVERY = 5000 // ms between writes of the measures

function createWindow(): void {
  const win = new BrowserWindow({
    title: 'Twinmap',
    width: WINDOW.width,
    height: WINDOW.height,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    backgroundColor: WINDOW.background,
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js') },
  })

  // In development the renderer comes from the dev server, in a build from disk.
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  const link = startLink()
  const show = setInterval(() => win.webContents.send('link', link.snapshot()), SHOW_EVERY)

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
    }
    void writeFile(logFile, JSON.stringify(measures, null, 1)).catch(() => {})
  }, LOG_EVERY)

  win.on('closed', () => {
    clearInterval(show)
    clearInterval(log)
    link.stop()
  })
}

void app.whenReady().then(createWindow)

// Windows only: closing the last window closes the app.
app.on('window-all-closed', () => app.quit())
