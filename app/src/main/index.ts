import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { WINDOW } from '../shared/window'

function createWindow(): void {
  const win = new BrowserWindow({
    title: 'Twinmap',
    width: WINDOW.width,
    height: WINDOW.height,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    backgroundColor: WINDOW.background,
    autoHideMenuBar: true,
  })

  // In development the renderer comes from the dev server, in a build from disk.
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

void app.whenReady().then(createWindow)

// Windows only: closing the last window closes the app.
app.on('window-all-closed', () => app.quit())
