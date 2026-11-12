// What the main process tells the window about the map tiles made from the player's game files.
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

/** One line for the window. */
/** What the player can do about a map that is not there, or nothing when there is nothing to do. */
export function tilesHelp(status: TilesStatus): string | null {
  if (status.state === 'no-game') return 'Choose the folder where World of Warcraft: Forever is installed, the one that holds _forever_.'
  if (status.state === 'failed')
    return "Twinmap could not read the game's files. Close the game's launcher if it is updating or repairing the game, then try again. If it fails again, repair the game from the launcher and tell us with Feedback."
  return null
}

export function tilesLine(status: TilesStatus): string {
  switch (status.state) {
    case 'looking':
      return 'Looking for the game.'
    case 'no-game':
      return 'The game folder was not found.'
    case 'converting':
      return `Building the map from your game's files, ${status.percent}%.`
    case 'ready':
      return `Map: ${status.tiles} tiles ready, game ${status.version}` + (!status.interiors ? ', reading the rooms' : status.interiors.problem ? `, rooms not read (${status.interiors.problem})` : `, ${status.interiors.pieces} rooms`)
    case 'failed':
      return `The map could not be built: ${status.message}`
  }
}
