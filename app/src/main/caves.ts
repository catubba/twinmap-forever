// Which buildings of the continents are caves and mines: the ones whose rooms lie under the ground
// (shared/inside.ts, buriedBuildings), from the rooms the converter kept (interiors.ts) and the
// heights of the terrain (heights.ts). Kept beside them as caves.json, by continent, for the layer
// that shows them from outside. Made once a build, in a second or two.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { SIDE, STEP, unpackHeights } from '../shared/heights'
import { buriedBuildings, type Interiors } from '../shared/inside'
import { BLOCK_YARDS, WORLDS } from '../shared/world'
import { heightsFile } from './heights'

export const CAVES_FILE = 'caves.json'
/** How the list is worked out: one made another way is made again. */
const CAVES_VERSION = 1

/** The list by continent, made if it is not there yet. Null while a continent has no heights: tried again at the next start. */
export function makeCaves(base: string, inside: Interiors): Record<string, number[]> | null {
  const file = join(base, CAVES_FILE)
  try {
    const had = JSON.parse(readFileSync(file, 'utf8')) as { version?: number; worlds?: Record<string, number[]> }
    if (had.version === CAVES_VERSION && had.worlds) return had.worlds
  } catch {
    // not made yet
  }
  const worlds: Record<string, number[]> = {}
  for (const world of WORLDS) {
    const map = inside.maps.find((m) => m.kind === 'world' && m.id === world.continent)
    if (!map) continue
    const folder = join(base, world.name)
    if (!existsSync(join(folder, 'heights'))) return null
    const blocks = new Map<number, Float32Array | null>()
    const groundAt = (u: number, v: number): number | null => {
      const column = Math.floor(u / BLOCK_YARDS), row = Math.floor(v / BLOCK_YARDS), key = row * 64 + column
      if (!blocks.has(key)) {
        try {
          blocks.set(key, unpackHeights(inflateSync(readFileSync(heightsFile(folder, column, row)))))
        } catch {
          blocks.set(key, null) // the sea, or a block with no terrain
        }
      }
      const heights = blocks.get(key)
      if (!heights) return null
      const c = Math.min(SIDE - 1, Math.round((u - column * BLOCK_YARDS) / STEP)), r = Math.min(SIDE - 1, Math.round((v - row * BLOCK_YARDS) / STEP))
      const h = heights[r * SIDE + c]!
      return Number.isNaN(h) ? null : h
    }
    worlds[world.continent] = buriedBuildings(map.pieces, groundAt)
  }
  writeFileSync(file + '.part', JSON.stringify({ version: CAVES_VERSION, worlds }))
  renameSync(file + '.part', file)
  return worlds
}
