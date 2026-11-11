// The door between the window and the main process. The window listens; it can ask for four things
// only: to pick the game folder, to open the addon's page on CurseForge, to build the map again after a
// failure, and to stay over other windows. It says one: that its opening screen is drawn.
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
  // Builds the map again after a failure.
  retryTiles: (): Promise<void> => ipcRenderer.invoke('retry-tiles'),
  // The opening screen is drawn: the window can show itself.
  drawn: (): void => ipcRenderer.send('drawn'),
  setOnTop: (on: boolean): Promise<void> => ipcRenderer.invoke('set-on-top', on),
})
