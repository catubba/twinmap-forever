// The door between the window and the main process. The window listens; it can ask for two things
// only, both of the first run: to pick the game folder, and to open the addon's page on CurseForge.
import { contextBridge, ipcRenderer } from 'electron'
import type { LinkSnapshot } from '../shared/link'
import type { SetupStatus } from '../shared/setup'
import type { TilesStatus } from '../shared/tiles-status'

contextBridge.exposeInMainWorld('twinmap', {
  onLink: (listener: (snapshot: LinkSnapshot) => void) => {
    ipcRenderer.on('link', (_event, snapshot: LinkSnapshot) => listener(snapshot))
  },
  onTiles: (listener: (status: TilesStatus) => void) => {
    ipcRenderer.on('tiles', (_event, status: TilesStatus) => listener(status))
  },
  onSetup: (listener: (status: SetupStatus) => void) => {
    ipcRenderer.on('setup', (_event, status: SetupStatus) => listener(status))
  },
  // Opens the folder picker. Gives back what is wrong with the folder picked, or null.
  chooseGameFolder: (): Promise<string | null> => ipcRenderer.invoke('choose-game-folder'),
  openCurseForge: (): Promise<void> => ipcRenderer.invoke('open-curseforge'),
})
