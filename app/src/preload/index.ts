// The door between the window and the main process. The window listens; it can ask for eight things
// only: to pick the game folder, to open the addon's page on CurseForge, to build the map again after a
// failure, to stay over other windows, to search the player's QuestieDB, to mark a point in the
// game, to send it a route, and to step ahead on that route. It says one: that its opening screen is drawn.
import { contextBridge, ipcRenderer } from 'electron'
import type { LinkSnapshot } from '../shared/link'
import type { QuestsStatus } from '../shared/quests'
import type { RouteNews } from '../shared/route'
import type { Found } from '../shared/search'
import type { Pin } from '../shared/send'
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
  onQuests: (listener: (status: QuestsStatus) => void) => {
    ipcRenderer.on('quests', (_event, status: QuestsStatus) => listener(status))
  },
  // Opens the folder picker. Gives back what is wrong with the folder picked, or null.
  chooseGameFolder: (): Promise<string | null> => ipcRenderer.invoke('choose-game-folder'),
  openCurseForge: (): Promise<void> => ipcRenderer.invoke('open-curseforge'),
  // Builds the map again after a failure.
  retryTiles: (): Promise<void> => ipcRenderer.invoke('retry-tiles'),
  // The opening screen is drawn: the window can show itself.
  drawn: (): void => ipcRenderer.send('drawn'),
  setOnTop: (on: boolean): Promise<void> => ipcRenderer.invoke('set-on-top', on),
  // NPCs, quests and items whose name answers what was typed.
  search: (typed: string): Promise<Found[]> => ipcRenderer.invoke('search', typed),
  // Marks a point in the game. Gives back the number of the send, or what went wrong.
  sendPin: (pin: Pin): Promise<{ seq: number } | { error: string }> => ipcRenderer.invoke('send-pin', pin),
  // My pins, all of them: the game draws the same points on its own map. taken: the marks set in
  // the game that are now among them, by the name the addon knows them by.
  sendMarks: (pins: Pin[], taken: string[]): Promise<void> => ipcRenderer.invoke('send-marks', pins, taken),
  // Sends the route to the game, or takes it away from it with false.
  sendRoute: (route: RouteNews | false): Promise<{ seq: number } | { error: string }> => ipcRenderer.invoke('send-route', route),
  // Moves the game on to a stop of the route it has.
  sendStep: (step: { t: number; at: number }): Promise<{ seq: number } | { error: string }> => ipcRenderer.invoke('send-step', step),
})
