// Finds the ways on foot on a thread of its own: reading a continent's grid takes a moment, and a
// long search more than the reading of the strip can wait. The grid is the one in the player's
// own Shortest Path Forever, so it is always that of the version installed; where the addon is
// not there, or its files are of a format this app does not read, the copy shipped with the app.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import { UNITS_PER_BLOCK, unitsOfWorld } from '../shared/geo'
import { navFrom } from '../shared/nav-data'
import type { WalkAsk, WalkPath } from '../shared/walk'
import { BLOCK_YARDS, BLOCKS } from '../shared/world'
import { readAddonNav, shortestPathFolder, walker, type Walk, type Yards } from './walk'

const { gameFolder, shipped } = workerData as { gameFolder: string | null; shipped: string }
type Finder = (from: Yards, to: Yards) => Walk | null
const finders = new Map<number, Finder | null>()

function finder(continent: number): Finder | null {
  if (!finders.has(continent)) {
    let nav = gameFolder ? readAddonNav(shortestPathFolder(gameFolder), continent) : null
    try {
      nav ??= navFrom(readFileSync(join(shipped, `nav${continent}.json`), 'utf8'))
    } catch {
      // no file: no ways on foot, and the rest of the app goes on
    }
    finders.set(continent, nav && walker(nav))
  }
  return finders.get(continent) ?? null
}

// Map units to yards of the world: the other way of unitsOfWorld (shared/geo.ts).
const yardsOf = (p: { x: number; y: number }): Yards => [(BLOCKS / 2 - p.y / UNITS_PER_BLOCK) * BLOCK_YARDS, (BLOCKS / 2 - p.x / UNITS_PER_BLOCK) * BLOCK_YARDS]

parentPort?.on('message', ({ id, ask }: { id: number; ask: WalkAsk }) => {
  let path: WalkPath = null
  try {
    const walk = finder(ask.continent)?.(yardsOf(ask.from), yardsOf(ask.to))
    if (walk) path = { points: walk.points.map(([x, y]) => unitsOfWorld(x, y)), yards: walk.yards }
  } catch {
    // a grid that does not read as it should: no way, rather than a thread that dies
  }
  parentPort?.postMessage({ id, path })
})
