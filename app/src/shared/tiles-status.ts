// What the main process tells the window about the map tiles made from the player's game files.
export type TilesStatus =
  /** Looking for the game folder. */
  | { state: 'looking' }
  /** No folder with World of Warcraft: Forever was found. */
  | { state: 'no-game' }
  /** Converting, both continents together: 0 to 100. */
  | { state: 'converting'; percent: number }
  /** The tiles are in the folder, made from this version of the game. */
  | { state: 'ready'; folder: string; version: string; tiles: number; missing: number; seconds: number; converted: boolean }
  | { state: 'failed'; message: string }

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
      return `Map: ${status.tiles} tiles ready, game ${status.version}`
    case 'failed':
      return `Map: not made (${status.message})`
  }
}
