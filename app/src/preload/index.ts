// The door between the window and the main process. The window listens; it can ask for ten things
// only: to forget a character, to pick the game folder, to open the addon's page on CurseForge, to build the map again after a
// failure, to stay over other windows, to show the map on the home network, to search the player's QuestieDB, to mark a point in the
// game, to send it a route, to step ahead on that route, and to fetch the prices of an auction house. It says one: that its opening screen is drawn.
import { contextBridge, ipcRenderer } from 'electron'
import type { PricesTold } from '../shared/ah'
import type { FeedbackSent, FeedbackWay } from '../shared/feedback'
import type { Kept, KeptKey } from '../shared/kept'
import type { PortraitsTold } from '../shared/portrait'
import type { Sheets } from '../shared/sheet'
import type { ItemSources, Tips } from '../shared/tips'
import type { LinkSnapshot } from '../shared/link'
import type { Updating } from '../main/update'
import type { QuestsStatus } from '../shared/quests'
import type { RouteNews } from '../shared/route'
import type { Found } from '../shared/search'
import type { Pin } from '../shared/send'
import type { Optional, SetupStatus } from '../shared/setup'
import type { TilesStatus } from '../shared/tiles-status'
import type { Far, FarAsk, Floors, TrackAsk, WalkAsk, WalkPath } from '../shared/walk'

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
  // The route and My pins, kept by the app for every screen: told when a screen changes one.
  onKept: (listener: (kept: Kept) => void) => {
    ipcRenderer.on('kept', (_event, kept: Kept) => listener(kept))
  },
  keep: (key: KeptKey, value: unknown): Promise<void> => ipcRenderer.invoke('keep', key, value),
  // The sheets of the characters the app has seen, for the picker: told at load and at every change.
  onSheets: (listener: (sheets: Sheets) => void) => {
    ipcRenderer.on('sheets', (_event, sheets: Sheets) => listener(sheets))
  },
  // Takes a character off the list.
  forgetSheet: (key: string): Promise<void> => ipcRenderer.invoke('forget-sheet', key),
  // The pictures of the characters, and whose is awaited: told at load and at every change.
  onPortraits: (listener: (told: PortraitsTold) => void) => {
    ipcRenderer.on('portraits', (_event, told: PortraitsTold) => listener(told))
  },
  // A new picture of a character once its character window is open in game; null takes the asking back.
  retakePortrait: (key: string | null): Promise<void> => ipcRenderer.invoke('retake-portrait', key),
  // A copy of a character's picture, where the player says.
  savePortrait: (key: string): Promise<void> => ipcRenderer.invoke('save-portrait', key),
  // The game's tooltips of the items met: told at load and at every change.
  onTips: (listener: (tips: Tips) => void) => {
    ipcRenderer.on('tips', (_event, tips: Tips) => listener(tips))
  },
  // The prices of the auction house asked for, kept by the app: told at load and at every change.
  onPrices: (listener: (told: PricesTold) => void) => {
    ipcRenderer.on('prices', (_event, told: PricesTold) => listener(told))
  },
  // The house whose prices to fetch, now and every hour; and again at once, after a failure.
  ahHouse: (region: string, house: number): Promise<void> => ipcRenderer.invoke('ah-house', region, house),
  ahAgain: (): Promise<void> => ipcRenderer.invoke('ah-again'),
  // Who sells an item, who drops it, where it is found.
  itemSources: (item: number): Promise<ItemSources> => ipcRenderer.invoke('item-sources', item),
  onQuests: (listener: (status: QuestsStatus) => void) => {
    ipcRenderer.on('quests', (_event, status: QuestsStatus) => listener(status))
  },
  // In the small window of an update: which version is coming down, and how far along it is.
  onUpdate: (listener: (updating: Updating) => void) => {
    ipcRenderer.on('update', (_event, updating: Updating) => listener(updating))
  },
  // Opens the folder picker. Gives back what is wrong with the folder picked, or null.
  chooseGameFolder: (): Promise<string | null> => ipcRenderer.invoke('choose-game-folder'),
  // The page of Twinmap Forever on CurseForge, or the one of an optional addon when it is named.
  openCurseForge: (addon?: Optional): Promise<void> => ipcRenderer.invoke('open-curseforge', addon),
  // Opens the player's feedback where they chose to write it, with the details the app adds.
  openFeedback: (way: FeedbackWay, details: string): Promise<void> => ipcRenderer.invoke('open-feedback', way, details),
  // Sends what the player wrote in the Feedback window. Gives back what went wrong, or null.
  sendFeedback: (sent: FeedbackSent): Promise<string | null> => ipcRenderer.invoke('send-feedback', sent),
  // The latest lines of the app's record of what happened to it.
  readLog: (): Promise<string> => ipcRenderer.invoke('read-log'),
  // Builds the map again after a failure.
  retryTiles: (): Promise<void> => ipcRenderer.invoke('retry-tiles'),
  // The opening screen is drawn: the window can show itself.
  drawn: (): void => ipcRenderer.send('drawn'),
  setOnTop: (on: boolean): Promise<void> => ipcRenderer.invoke('set-on-top', on),
  // Shows the map to the other devices of the home network, or stops showing it.
  setLan: (on: boolean): Promise<void> => ipcRenderer.invoke('set-lan', on),
  setParticipate: (on: boolean): Promise<void> => ipcRenderer.invoke('set-participate', on),
  // The Pause button: stops reading the game and asks the addon to stop drawing its strip, until Resume.
  setPause: (on: boolean): Promise<void> => ipcRenderer.invoke('set-pause', on),
  // NPCs, quests and items whose name answers what was typed.
  search: (typed: string): Promise<Found[]> => ipcRenderer.invoke('search', typed),
  // The way on foot between two points of a continent; null where there is none.
  walk: (ask: WalkAsk): Promise<WalkPath> => ipcRenderer.invoke('walk', ask),
  // How many yards on foot from one point to each of many; null for those no way was found to.
  walkFar: (ask: FarAsk): Promise<Far> => ipcRenderer.invoke('walk-far', ask),
  walkTrack: (ask: TrackAsk): Promise<Floors> => ipcRenderer.invoke('walk-track', ask),
  // Marks a point in the game. Gives back the number of the send, or what went wrong.
  sendPin: (pin: Pin): Promise<{ seq: number } | { error: string }> => ipcRenderer.invoke('send-pin', pin),
  // My pins, all of them: the game draws the same points on its own map. taken: the marks set in
  // the game that are now among them, by the name the addon knows them by.
  sendMarks: (pins: Pin[], taken: string[]): Promise<void> => ipcRenderer.invoke('send-marks', pins, taken),
  // Has the game's arrow let go of the point it follows by itself.
  sendUnfollow: (): Promise<{ seq: number } | { error: string }> => ipcRenderer.invoke('send-unfollow'),
  // Sends the route to the game, or takes it away from it with false.
  sendRoute: (route: RouteNews | false): Promise<{ seq: number } | { error: string }> => ipcRenderer.invoke('send-route', route),
  // Moves the game on to a stop of the route it has.
  sendStep: (step: { t: number; at: number }): Promise<{ seq: number } | { error: string }> => ipcRenderer.invoke('send-step', step),
})
