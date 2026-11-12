// Before it opens, the app looks for a newer version of itself among the releases on GitHub. If
// there is one it is downloaded behind a small window that says so, put in place of this one, and
// started: the player never opens an old Twinmap. With no network, or an answer that is slow to
// come, the app opens as it is.
import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'node:path'
import { WINDOW } from '../shared/window'

const ANSWER_WITHIN = 4000 // ms the look for a newer version may take before the app opens without it

/** What the small window is told while the newer version comes down. */
export type Updating = { version: string; percent: number }

/**
 * Updates the app if there is a newer version, else calls `open`. TWINMAP_UPDATES, for trials, is
 * an address to look at instead of GitHub. An app run from the sources never updates.
 */
export function updateFirst(open: () => void): void {
  if (!app.isPackaged) return open()
  let opened = false
  let win: BrowserWindow | null = null
  // Whatever goes wrong, at any point, the app opens as it is: an update is never a reason not to start.
  const go = (): void => {
    if (opened) return
    opened = true
    open() // before the small window goes: closing the last window closes the app
    win?.destroy()
  }
  const late = setTimeout(go, ANSWER_WITHIN)
  try {
    if (process.env.TWINMAP_UPDATES) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.TWINMAP_UPDATES })
    autoUpdater.autoDownload = false
    autoUpdater.on('error', go)
    void autoUpdater
      .checkForUpdates()
      .then((found) => {
        clearTimeout(late)
        if (opened || !found?.isUpdateAvailable) return go()
        let told: Updating = { version: found.updateInfo.version, percent: 0 }
        const small = (win = new BrowserWindow({
          title: 'Twinmap',
          width: 360,
          height: 400,
          resizable: false,
          maximizable: false,
          frame: false,
          backgroundColor: WINDOW.background,
          webPreferences: { preload: join(__dirname, '../preload/index.js') },
        }))
        const tell = (): void => {
          if (!small.isDestroyed()) small.webContents.send('update', told)
        }
        small.webContents.on('did-finish-load', tell)
        void small.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'update' })
        autoUpdater.on('download-progress', (progress) => {
          told = { ...told, percent: progress.percent }
          tell()
        })
        // Installed without a question, and the new version started in place of this one.
        autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall(true, true))
        return autoUpdater.downloadUpdate().then(() => {})
      })
      .catch(go)
  } catch {
    go()
  }
}
