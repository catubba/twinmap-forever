// The only door between the window and the main process: the window listens, it cannot ask for anything.
import { contextBridge, ipcRenderer } from 'electron'
import type { LinkSnapshot } from '../shared/link'
import type { TilesStatus } from '../shared/tiles-status'

contextBridge.exposeInMainWorld('twinmap', {
  onLink: (listener: (snapshot: LinkSnapshot) => void) => {
    ipcRenderer.on('link', (_event, snapshot: LinkSnapshot) => listener(snapshot))
  },
  onTiles: (listener: (status: TilesStatus) => void) => {
    ipcRenderer.on('tiles', (_event, status: TilesStatus) => listener(status))
  },
})
