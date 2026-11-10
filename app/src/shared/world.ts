// The two continents as the game stores them: a square of 64 x 64 blocks, each 533.33 yards wide,
// each with its own minimap picture of 512 pixels. One file per continent (a .wdt) lists the
// pictures of its blocks, so two fixed file numbers are all the app needs to find every tile.
//
// A world position (x north, y west, in yards) falls in column 32 - y / 533.33 and row
// 32 - x / 533.33 of that square.

export const BLOCKS = 64
export const BLOCK_YARDS = 1600 / 3
export const BLOCK_PIXELS = 512

/** continent: as in the game's tables (maps.ts). name: the folder its tiles go in. file: its .wdt. */
export const WORLDS = [
  { continent: 0, name: 'azeroth', file: 775971 },
  { continent: 1, name: 'kalimdor', file: 782779 },
] as const

/** The minimap picture of each block that has one: block (row * 64 + column) -> file number. */
export function minimapTiles(wdt: Buffer): Map<number, number> {
  const tiles = new Map<number, number>()
  // A .wdt is a run of chunks: a four letter tag written backwards, a size, the data.
  for (let at = 0; at + 8 <= wdt.length; ) {
    const tag = wdt.toString('latin1', at, at + 4), size = wdt.readUInt32LE(at + 4)
    if (tag === 'DIAM') {
      // "MAID": eight file numbers for each block, the minimap picture last.
      for (let block = 0; block < BLOCKS * BLOCKS; block++) {
        const file = wdt.readUInt32LE(at + 8 + block * 32 + 28)
        if (file) tiles.set(block, file)
      }
    }
    at += 8 + size
  }
  return tiles
}
