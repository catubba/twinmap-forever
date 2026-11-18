// Which buildings of the continents are caves and mines: the ones whose rooms lie under the ground
// (shared/inside.ts, buriedBuildings), from the rooms the converter kept (interiors.ts) and the
// heights of the terrain (heights.ts). Kept beside them as caves.json, by continent, for the layer
// that shows them from outside. Made once a build, in a second or two.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { SIDE, STEP, unpackHeights } from '../shared/heights'
import { buriedBuildings, floorsOf, roofOf, type Interiors, type UnderRoom } from '../shared/inside'
import { BLOCK_YARDS, WORLDS } from '../shared/world'
import { heightsFile } from './heights'

// The height of the terrain of a continent over a place, from its heights as the converter keeps them; null where there is none.
function groundOf(folder: string): (u: number, v: number) => number | null {
  const blocks = new Map<number, Float32Array | null>()
  return (u, v) => {
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
}

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
    const groundAt = groundOf(folder)
    worlds[world.continent] = buriedBuildings(map.pieces, groundAt)
  }
  writeFileSync(file + '.part', JSON.stringify({ version: CAVES_VERSION, worlds }))
  renameSync(file + '.part', file)
  return worlds
}

export const UNDER_FILE = 'under.json'
const UNDER_VERSION = 3

/**
 * For the 3D view, which shows the rooms under the ground inside it (design/ui.md, section 4): the
 * rooms of the buildings under the ground that are themselves inside it, each with the height of its
 * floor and how much ground it has over it. By continent, a room as [its place in the list of the
 * continent's pieces, floor, roof], in yards. Kept beside the caves as under.json, made once a build.
 * heightsAt: every height one stands at on a place of a continent, from the walking grid (walk.ts).
 */
export function makeUnder(base: string, inside: Interiors, caves: Record<string, number[]>, heightsAt: (continent: number, u: number, v: number) => number[]): Record<string, UnderRoom[]> {
  const file = join(base, UNDER_FILE)
  try {
    const had = JSON.parse(readFileSync(file, 'utf8')) as { version?: number; worlds?: Record<string, UnderRoom[]> }
    if (had.version === UNDER_VERSION && had.worlds) return had.worlds
  } catch {
    // not made yet
  }
  const worlds: Record<string, UnderRoom[]> = {}
  for (const world of WORLDS) {
    const map = inside.maps.find((m) => m.kind === 'world' && m.id === world.continent), buried = new Set(caves[world.continent])
    if (!map) continue
    const groundAt = groundOf(join(base, world.name))
    const by = new Map<number, number[]>() // by building: where its rooms are in the list
    map.pieces.forEach((p, index) => {
      if (buried.has(p.building)) (by.get(p.building) ?? by.set(p.building, []).get(p.building)!).push(index)
    })
    worlds[world.continent] = [...by.values()]
      .flatMap((rooms) => {
        const floors = floorsOf(rooms.map((i) => map.pieces[i]!), (u, v) => heightsAt(world.continent, u, v))
        return rooms.flatMap((index, k): UnderRoom[] => {
          const under = roofOf(map.pieces[index]!, floors[k]!, groundAt)
          return under === null ? [] : [[index, Math.round(floors[k]! * 10) / 10, Math.round(under)]]
        })
      })
      .sort((a, b) => a[0] - b[0])
  }
  writeFileSync(file + '.part', JSON.stringify({ version: UNDER_VERSION, worlds }))
  renameSync(file + '.part', file)
  return worlds
}
