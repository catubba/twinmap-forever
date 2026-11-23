// What the main process tells the window about the map tiles made from the player's game files.
import { t } from './i18n'

export type TilesStatus =
  /** Looking for the game folder. */
  | { state: 'looking' }
  /** No folder with World of Warcraft: Forever was found. */
  | { state: 'no-game' }
  /** Converting, both continents together: 0 to 100. */
  | { state: 'converting'; percent: number }
  /**
   * The tiles are in the folder, made from this version of the game. interiors: the insides of
   * buildings (dungeons, raids, caves), absent while they are still being read; the map of the
   * continents does not wait for them.
   */
  | { state: 'ready'; folder: string; version: string; tiles: number; missing: number; seconds: number; converted: boolean; interiors?: InteriorsStatus }
  | { state: 'failed'; message: string }

export interface InteriorsStatus {
  /** Maps with something inside: the two continents, dungeons, raids. */
  maps: number
  /** Pictures of rooms laid on them. */
  pieces: number
  /** Pictures the game lists that could not be laid. */
  dropped: number
  seconds: number
  converted: boolean
  /** Why they could not be read, when they could not: the map of the continents stays. */
  problem?: string
}

/** What the player can do about a map that is not there, or should know while it is made; nothing when there is nothing to say. */
export function tilesHelp(status: TilesStatus): string | null {
  // While it is built: that it is not so at every start, or one might think the app too slow to keep.
  if (status.state === 'converting') return t('app.tiles.builtOnce')
  if (status.state === 'no-game') return t('app.tiles.noGameHelp')
  if (status.state === 'failed') return t('app.tiles.failedHelp')
  return null
}

/** One line for the window. */
export function tilesLine(status: TilesStatus): string {
  switch (status.state) {
    case 'looking':
      return t('app.tiles.looking')
    case 'no-game':
      return t('app.tiles.noGame')
    case 'converting':
      return t('app.tiles.converting', { percent: status.percent })
    case 'ready': {
      const said = { tiles: status.tiles, version: status.version }
      if (!status.interiors) return t('app.tiles.readyReading', said)
      if (status.interiors.problem) return t('app.tiles.readyNoRooms', { ...said, problem: status.interiors.problem })
      return t('app.tiles.ready', { ...said, rooms: status.interiors.pieces })
    }
    case 'failed':
      return t('app.tiles.failed', { message: status.message })
  }
}
