// The way on foot between two points of a continent, found on the walking grid (shared/nav-data.ts)
// as Shortest Path Forever finds it in the game: cells of about 8 yards, each walkable or not, the
// steps between them open or closed, and the cells of a road cheaper than the rest. Step rules
// adapted from Routing/PathGrid.lua of Shortest Path Forever, Copyright (c) cjber,
// GPL-3.0-or-later: see THIRD-PARTY-LICENSES.
//
// ponytail: the base surface only, one plain search over the cells. Left out: the floors of
// buildings above and below it, steep ground as a one-way step (taken both ways here), the graph
// between clusters. So a goal inside a building is reached at its door at best, and a search gives
// up past LIMIT cells. Add them when the line is seen to differ from the game's where it matters.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { navFrom, type NavData, type NavField } from '../shared/nav-data'
import { BLOCK_YARDS } from '../shared/world'

const OFFROAD = 1.5 // a yard off the road counts as this many on it
const SNAP = 6 // cells around a point searched for one that can be walked
const LIMIT = 400_000 // cells a search looks at before it gives up
const B64 = new Uint8Array(128)
Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/').forEach((c, i) => (B64[c.charCodeAt(0)] = i))

/** A point of the world, in yards: north, then west. */
export type Yards = [number, number]

/** The folder of Shortest Path Forever in a game folder. */
export const shortestPathFolder = (gameFolder: string): string => join(gameFolder, '_forever_', 'Interface', 'AddOns', 'ShortestPathForever')

/**
 * The grid of a continent as the player's own Shortest Path Forever has it: always the one of the
 * version installed. null where the addon is not there, or its files are not of a format this app
 * reads: the grid shipped with the app is then the one to use. The same reading as scripts/import-nav.js.
 */
export function readAddonNav(folder: string, map: number): NavData | null {
  try {
    const headFile = join(folder, 'Nav', `Nav${map}.lua`)
    if (!existsSync(headFile)) return null
    const head = readFileSync(headFile, 'utf8')
    const num = (name: string): number => Number(new RegExp(`\\b${name} = (-?[\\d.]+)`).exec(head)?.[1])
    const packed: Record<NavField, Record<string, string[]>> = { graph: {}, grid: {}, height: {}, floor: {}, terrain: {} }
    for (const file of readdirSync(join(folder, 'Nav')).filter((f) => f.startsWith(`Nav${map}_`)).sort()) {
      for (const m of readFileSync(join(folder, 'Nav', file), 'latin1').matchAll(/data\.packed\.(\w+)\[(\d+)\] = \{([^}]*)\}/g)) {
        const field = packed[m[1] as NavField]
        if (!field) return null // a field this reader does not know: a newer format
        field[Number(m[2]) - 1] = Array.from(m[3]!.matchAll(/"([^"]*)"/g), (b) => b[1]!)
      }
    }
    const perCluster = (file: string): Record<string, string> => {
      const out: Record<string, string> = {}
      let at: number | null = null
      for (const line of readFileSync(join(folder, 'Data', file), 'latin1').split('\n')) {
        const top = /^\t\[(\d+)\] = \{/.exec(line), row = /^\t\t\[(\d+)\] = "([^"]*)"/.exec(line)
        if (top) at = Number(top[1])
        else if (row && at === map) out[Number(row[1]) - 1] = row[2]!
      }
      return out
    }
    const version = /^## Version:\s*(\S+)/m.exec(readFileSync(join(folder, 'ShortestPathForever.toc'), 'utf8'))?.[1] ?? 'unknown'
    return navFrom(JSON.stringify({
      map, from: `Shortest Path Forever ${version}, as installed`, source: head.split('\n').slice(0, 3).map((line) => line.replace(/^-- /, '').trim()),
      cx0: num('cx0'), cy0: num('cy0'), nx: num('nx'), ny: num('ny'), cells: num('cells'), swim: num('swim'), zstep: num('zstep'), format: num('format'), steep: /\bsteep = true/.test(head),
      packed, roads: perCluster('RoadCells.lua'), roadEdges: perCluster('RoadEdges.lua'),
    }))
  } catch {
    return null
  }
}

export interface Walk {
  /** The way, from the first point to the last, in yards of the world; thinned to its turns. */
  points: Yards[]
  yards: number
}

/** A finder of ways on one continent's grid. Clusters are unpacked as searches cross them, and kept. */
export function walker(nav: NavData): (from: Yards, to: Yards) => Walk | null {
  const C = nav.cells, GX = nav.nx * C, GY = nav.ny * C, cell = BLOCK_YARDS / C
  const clusters = new Map<number, { val: Uint8Array; flags: Uint8Array; road: Uint8Array } | null>()
  function cluster(k: number): { val: Uint8Array; flags: Uint8Array; road: Uint8Array } | null {
    const kept = clusters.get(k)
    if (kept !== undefined) return kept
    const blocks = nav.packed.grid[k]
    let made: { val: Uint8Array; flags: Uint8Array; road: Uint8Array } | null = null
    if (blocks) {
      const s = Buffer.concat(blocks.map((b) => inflateSync(Buffer.from(b, 'base64'))))
      const val = new Uint8Array(C * C), flags = new Uint8Array(C * C), road = new Uint8Array(C * C)
      let n = 0, v = 0, f = 0
      // A symbol under 48 is a cell (what it is, and which of its steps are closed); one from 48 on repeats the cell before it.
      for (let i = 0; i < s.length && n < C * C; i++) {
        const sym = B64[s[i]!]!
        if (sym < 48) {
          v = sym >> 4
          f = sym & 15
          if (nav.steep && v === 1 && f >= 8) (v = 3), (f -= 8)
          val[n] = v
          flags[n++] = f
        } else for (let r = 48; r <= sym && n < C * C; r++) (val[n] = v), (flags[n++] = f)
      }
      // The cells that are road: runs, the first of cells that are not, two symbols a run.
      const runs = nav.roads[k]
      if (runs) {
        let at = 0, on = false
        for (let p = 0; p + 1 < runs.length; p += 2) {
          const run = B64[runs.charCodeAt(p)]! * 64 + B64[runs.charCodeAt(p + 1)]!
          if (on) road.fill(1, at, at + run)
          at += run
          on = !on
        }
      }
      made = { val, flags, road }
    }
    clusters.set(k, made)
    return made
  }
  const at = (gx: number, gy: number): { val: Uint8Array; flags: Uint8Array; road: Uint8Array } | null => (gx < 0 || gy < 0 || gx >= GX || gy >= GY ? null : cluster(Math.floor(gx / C) * nav.ny + Math.floor(gy / C)))
  const idx = (gx: number, gy: number): number => (gx % C) * C + (gy % C)
  const ground = (gx: number, gy: number): boolean => {
    const v = at(gx, gy)?.val[idx(gx, gy)]
    return v === 1 || v === 3
  }
  const flag = (gx: number, gy: number): number => at(gx, gy)?.flags[idx(gx, gy)] ?? 0
  const isRoad = (gx: number, gy: number): boolean => at(gx, gy)?.road[idx(gx, gy)] === 1
  // A step north, south, east or west: its bit sits on the cell with the lower x or y.
  function stepOpen(gx: number, gy: number, dx: number, dy: number): boolean {
    const ax = dx < 0 ? gx + dx : gx, ay = dy < 0 ? gy + dy : gy
    if (!ground(ax, ay) || !ground(ax + (dx !== 0 ? 1 : 0), ay + (dy !== 0 ? 1 : 0))) return false
    return dx !== 0 ? (flag(ax, ay) & 1) === 0 : (flag(ax, ay) & 2) === 0
  }
  function diagonal(gx: number, gy: number, dx: number, dy: number): boolean {
    if (!ground(gx + dx, gy + dy)) return false
    if ((stepOpen(gx, gy, dx, 0) && stepOpen(gx + dx, gy, 0, dy)) || (stepOpen(gx, gy, 0, dy) && stepOpen(gx, gy + dy, dx, 0))) return true
    const ax = dx < 0 ? gx + dx : gx, ay = dx < 0 ? gy + dy : gy, up = dx < 0 ? dy < 0 : dy > 0
    return ground(ax, ay) && (up ? (flag(ax, ay) & 4) !== 0 : (flag(ax, ay) & 8) !== 0)
  }
  // The cell that can be walked nearest to a point.
  function snap([x, y]: Yards): [number, number] | null {
    const gx = Math.floor((x - nav.cx0 * BLOCK_YARDS) / cell), gy = Math.floor((y - nav.cy0 * BLOCK_YARDS) / cell)
    let best: [number, number] | null = null, least = Infinity
    for (let dx = -SNAP; dx <= SNAP; dx++) {
      for (let dy = -SNAP; dy <= SNAP; dy++) {
        if (dx * dx + dy * dy < least && ground(gx + dx, gy + dy)) (best = [gx + dx, gy + dy]), (least = dx * dx + dy * dy)
      }
    }
    return best
  }
  const middle = (gx: number, gy: number): Yards => [nav.cx0 * BLOCK_YARDS + (gx + 0.5) * cell, nav.cy0 * BLOCK_YARDS + (gy + 0.5) * cell]
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const

  return (from, to) => {
    const a = snap(from), b = snap(to)
    if (!a || !b) return null
    const id = (gx: number, gy: number): number => gx * GY + gy, goal = id(b[0], b[1])
    const cost = new Map<number, number>([[id(a[0], a[1]), 0]]), came = new Map<number, number>(), done = new Set<number>()
    // A binary heap on the first number: the yards walked plus the yards still to go as the crow flies.
    const heap: [number, number, number][] = [[0, a[0], a[1]]]
    const push = (e: [number, number, number]): void => {
      let i = heap.push(e) - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        if (heap[p]![0] <= heap[i]![0]) break
        ;[heap[p], heap[i]] = [heap[i]!, heap[p]!]
        i = p
      }
    }
    const pop = (): [number, number, number] => {
      const top = heap[0]!, last = heap.pop()!
      if (heap.length) {
        heap[0] = last
        for (let i = 0; ; ) {
          let s = i
          const l = 2 * i + 1, r = l + 1
          if (l < heap.length && heap[l]![0] < heap[s]![0]) s = l
          if (r < heap.length && heap[r]![0] < heap[s]![0]) s = r
          if (s === i) break
          ;[heap[s], heap[i]] = [heap[i]!, heap[s]!]
          i = s
        }
      }
      return top
    }
    while (heap.length && done.size < LIMIT) {
      const [, gx, gy] = pop(), here = id(gx, gy)
      if (done.has(here)) continue
      done.add(here)
      if (here === goal) break
      for (const [dx, dy] of DIRS) {
        const nx = gx + dx, ny = gy + dy, next = id(nx, ny)
        if (done.has(next) || !(dx !== 0 && dy !== 0 ? diagonal(gx, gy, dx, dy) : stepOpen(gx, gy, dx, dy))) continue
        const walked = cost.get(here)! + cell * (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1) * (isRoad(gx, gy) && isRoad(nx, ny) ? 1 : OFFROAD)
        if (walked >= (cost.get(next) ?? Infinity)) continue
        cost.set(next, walked)
        came.set(next, here)
        push([walked + cell * Math.hypot(nx - b[0], ny - b[1]), nx, ny])
      }
    }
    if (!done.has(goal)) return null
    const cells: Yards[] = []
    for (let c: number | undefined = goal; c !== undefined; c = came.get(c)) cells.push(middle(Math.floor(c / GY), c % GY))
    cells.reverse()
    let yards = 0
    for (let i = 1; i < cells.length; i++) yards += Math.hypot(cells[i]![0] - cells[i - 1]![0], cells[i]![1] - cells[i - 1]![1])
    // The line starts and ends at the very points asked for, not at the middles of their cells.
    return { points: [from, ...thin(cells, cell / 2), to], yards: Math.round(yards) }
  }
}

/** Fewer points, none more than so many yards off the line (Douglas and Peucker). */
export function thin(points: Yards[], off: number): Yards[] {
  if (points.length < 3) return points
  const a = points[0]!, b = points[points.length - 1]!, length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  let far = 0, at = 0
  points.forEach((p, i) => {
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / length
    if (d > far) (far = d), (at = i)
  })
  return far <= off ? [a, b] : [...thin(points.slice(0, at + 1), off).slice(0, -1), ...thin(points.slice(at), off)]
}
