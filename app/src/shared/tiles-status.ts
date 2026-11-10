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
export function tilesLine(status: TilesStatus): string {
  switch (status.state) {
    case 'looking':
      return 'Map: looking for the game'
    case 'no-game':
      return 'Map: game folder not found'
    case 'converting':
      return `Map: reading the game's own pictures, ${status.percent}%`
    case 'ready':
      return `Map: ${status.tiles} tiles ready, game ${status.version}` + (!status.interiors ? ', reading the rooms' : status.interiors.problem ? `, rooms not read (${status.interiors.problem})` : `, ${status.interiors.pieces} rooms`)
    case 'failed':
      return `Map: not made (${status.message})`
  }
}
