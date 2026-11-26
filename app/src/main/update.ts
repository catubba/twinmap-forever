// Before it opens, the app looks for a newer version of itself among the releases on GitHub. If
// there is one it is downloaded behind a small window that says so, put in place of this one, and
// started: the player never opens an old Twinmap. With no network, or an answer that is slow to
// come, the app opens as it is.
//
// This app has to close for the new one to be put in its place, and its small window with it. So
// the window says what comes next before it goes, the installer shows its own while it works, and
// the new app, told by the installer that it was just put there, opens without looking again.
//
// On macOS the new app comes as the zip of the release (latest-mac.yml, written by mac-app.yml), and
// macOS itself (Squirrel.Mac) puts it in place and starts it, only if it is signed by the same
// developer. It cannot replace an app outside the Applications folder: one opened from Downloads runs
// from a copy that cannot be written. That app opens as it is and offers to move there.
//
// On Linux the new app is the AppImage of the release (latest-linux.yml, written by release.yml), put
// over the old file under the same name, so shortcuts to it keep working.
import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'node:path'
import { t } from '../shared/i18n'
import { WINDOW } from '../shared/window'

const ANSWER_WITHIN = 4000 // ms the look for a newer version may take before the app opens without it
const READ_FOR = 1200 // ms the small window says the new version is being put in place, before this app closes

/** What the small window is told while the newer version comes down. */
export type Updating = { version: string; percent: number; installing?: boolean }

/**
 * Updates the app if there is a newer version, else calls `open`. TWINMAP_UPDATES, for trials, is
 * an address to look at instead of GitHub. An app run from the sources never updates. `say`: told
 * what came of the look, for the app's record.
 */
export function updateFirst(open: () => void, say: (line: string) => void): void {
  // Started by the installer after an update: it says so, and there is nothing newer to look for.
  if (!updatesItself() || !app.isPackaged || process.argv.includes('--updated')) {
    open()
    if (process.platform === 'darwin' && app.isPackaged) offerApplications(say)
    return
  }
  let opened = false
  let win: BrowserWindow | null = null
  // Whatever goes wrong, at any point, the app opens as it is: an update is never a reason not to start.
  const go = (): void => {
    if (opened) return
    opened = true
    open() // before the small window goes: closing the last window closes the app
    win?.destroy()
  }
  const late = setTimeout(() => {
    if (!opened) say('no answer in time')
    go()
  }, ANSWER_WITHIN)
  try {
    if (process.env.TWINMAP_UPDATES) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.TWINMAP_UPDATES })
    autoUpdater.autoDownload = false
    // A Mac release has no blockmap for its zip: the whole zip comes down, and no copy of it is kept for the next time.
    autoUpdater.disableDifferentialDownload = process.platform === 'darwin'
    autoUpdater.on('error', (e) => {
      say(`failed, ${e.message.split('\n')[0]}`)
      go()
    })
    void autoUpdater
      .checkForUpdates()
      .then((found) => {
        clearTimeout(late)
        if (opened || !found?.isUpdateAvailable) {
          say(opened ? 'the answer came too late' : 'none')
          return go()
        }
        say(`found ${found.updateInfo.version}`)
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
        // Installed without a question, and the new version started in place of this one. The
        // installer is not silent: its own window is all there is on screen while this app is closed.
        autoUpdater.on('update-downloaded', () => {
          told = { ...told, percent: 100, installing: true }
          tell()
          setTimeout(() => autoUpdater.quitAndInstall(false, true), READ_FOR)
        })
        return autoUpdater.downloadUpdate().then(() => {})
      })
      .catch(go)
  } catch {
    go()
  }
}

/**
 * Whether this app can put a newer version in its own place: on Windows always, on Linux as an AppImage
 * (its launcher names the file in APPIMAGE), on macOS only from the Applications folder.
 */
export function updatesItself(): boolean {
  if (process.platform === 'win32') return true
  if (process.platform === 'linux') return !!process.env.APPIMAGE
  return process.platform === 'darwin' && app.isInApplicationsFolder()
}

/** Asked as the app opens, each time it is outside the Applications folder: moved there, it starts again from there. */
function offerApplications(say: (line: string) => void): void {
  if (app.isInApplicationsFolder()) return
  void dialog
    .showMessageBox({
      type: 'question',
      message: t('app.main.moveApp'),
      detail: t('app.main.moveAppWhy'),
      buttons: [t('app.main.moveAppYes'), t('app.main.moveAppNo')],
      defaultId: 0,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response !== 0) return say('outside Applications, left there')
      say('moved to Applications')
      app.moveToApplicationsFolder()
    })
    .catch((e: Error) => say(`could not move to Applications, ${e.message.split('\n')[0]}`))
}
