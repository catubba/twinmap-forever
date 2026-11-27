// Where things stand over the game's ground on the continents (shared/stands.ts, M23-F4), made once per build of the
// game from the ground of the 3D view (heights.ts) and the walking grid shipped with the app (walk.ts): a few seconds a
// continent.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { BLOCK_ZOOM, unpackLevels } from '../shared/levels'
import { OVER, STANDS_FILE, standsOf, type Over, type Stands } from '../shared/stands'
import { BLOCKS, BLOCK_YARDS } from '../shared/world'
import { levelsFile } from './heights'
import type { Walker } from './walk'

const FORMAT = 1

/** Whether those of these continents are all made, in this format. */
export function standsMade(folder: string, worlds: string[]): boolean {
  return worlds.every((w) => {
    try {
      return (JSON.parse(readFileSync(join(folder, w, STANDS_FILE), 'utf8')) as Stands).format === FORMAT
    } catch {
      return false
    }
  })
}

/**
 * A continent's, from the ground kept in its folder. walk: its walking grid. Coordinates as the 3D view: a block by its
 * column (east) and row (south), a cell of a block the same way; the grid counts yards north and west of the middle.
 */
export function standsOfWorld(folder: string, walk: Walker): Stands {
  const C = walk.cells, cell = BLOCK_YARDS / C, W = BLOCKS * C, middle = (BLOCKS / 2) * BLOCK_YARDS
  const ground = new Float32Array(W * W).fill(NaN), over = new Map<number, Over>()
  for (let c = 0; c < BLOCKS; c++)
    for (let r = 0; r < BLOCKS; r++) {
      const file = levelsFile(folder, BLOCK_ZOOM, c, r), l = existsSync(file) ? unpackLevels(inflateSync(readFileSync(file))) : null
      if (!l) continue
      for (let j = 0; j < C; j++)
        for (let i = 0; i < C; i++) {
          // the ground and the water at the middle of the cell
          const k = Math.round(((j + 0.5) * (l.side - 1)) / C) * l.side + Math.round(((i + 0.5) * (l.side - 1)) / C), g = l.heights[k]!
          if (Number.isNaN(g)) continue
          const at = (r * C + j) * W + c * C + i, wet = Number.isNaN(l.water[k]!) ? -Infinity : l.water[k]!
          ground[at] = g
          const stands = walk.stands([middle - r * BLOCK_YARDS - (j + 0.5) * cell, middle - c * BLOCK_YARDS - (i + 0.5) * cell]).filter((s) => s.z > g + OVER && s.z > wet + 2)
          if (!stands.length) continue
          const base = stands.find((s) => !s.floor)
          over.set(at, base ? { base: base.z, floors: [] } : { base: null, floors: stands.map((s) => s.z) })
        }
    }
  const blocks: Record<string, number[]> = {}
  for (const [at, z] of standsOf(W, over, (a) => ground[a]!)) {
    const x = at % W, y = Math.floor(at / W)
    ;(blocks[`${Math.floor(x / C)}-${Math.floor(y / C)}`] ??= []).push((y % C) * C + (x % C), Math.round(z * 4))
  }
  return { format: FORMAT, cells: C, blocks }
}

/** Makes those of the continents given, each in its folder of the build. walk: a continent's walking grid, null when the app has none. Gives the cells written. */
export function makeStands(folder: string, worlds: readonly { name: string; continent: number }[], walk: (continent: number) => Walker | null): number {
  let cells = 0
  for (const w of worlds) {
    const grid = walk(w.continent), made: Stands = grid ? standsOfWorld(join(folder, w.name), grid) : { format: FORMAT, cells: 1, blocks: {} }
    const file = join(folder, w.name, STANDS_FILE)
    writeFileSync(file + '.part', JSON.stringify(made))
    renameSync(file + '.part', file)
    cells += Object.values(made.blocks).reduce((n, b) => n + b.length / 2, 0)
  }
  return cells
}
