// The way on foot between two points of a continent, found on the walking grid (shared/nav-data.ts)
// as Shortest Path Forever finds it in the game: cells of about 8 yards, each walkable or not, the
// steps between them open or closed, and the cells of a road cheaper than the rest. Step rules
// adapted from Routing/PathGrid.lua of Shortest Path Forever, Copyright (c) cjber,
// GPL-3.0-or-later: see THIRD-PARTY-LICENSES.
//
// A place to stand is the base surface of a cell or a floor over or under it (the streets and
// bridges of a city, the rooms of a building, a cave): the format is told in the head of Shortest
// Path Forever's Nav/Nav0.lua, and the decoding here follows its Routing/PathGrid.lua.
//
// ponytail: one plain search over the cells, which gives up past LIMIT of them; Shortest Path's
// own goes cluster by cluster on a graph baked with the grid. The height of the two ends is not
// known here, so the way starts and ends on whichever surface of their cells is cheapest. Add
// the graph when ways across more than a zone or two are seen to fail.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { navFrom, type NavData, type NavField } from '../shared/nav-data'
import { BLOCK_YARDS } from '../shared/world'

const OFFROAD = 1.5 // a yard off the road counts as this many on it
const CLIMB = Math.tan((50 * Math.PI) / 180) // the steepest rise a character walks up, a yard for each yard on
const SNAP = 6 // cells around a point searched for one that can be walked
const LIMIT = 400_000 // cells a search looks at before it gives up
const TRACK_SLACK = 6 // steps a tracker searches past twice the cells between two points: a ramp, a stair that turns
const LEVEL = 3 // yards between two places to stand for one to be another floor
const HIGH = 10 // yards a place must be over a character on foot in the open to be over its head (see the tracker)
const NEAR = 1 // cells from the last place within which a place with no way to it is not believed (see the tracker)
const AREA = 25 // places to stand a floor over the character must lead to: the top of a tree or a lamp is an island
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

// What a cluster unpacks to. A node is a place to stand: the base surface of a cell (its number is
// the cell's, 0 to cells * cells - 1), or one of the floors over or under it (numbered after them).
interface Cluster {
  /** By node: 0 nothing, 1 ground, 2 water, 3 steep ground. */
  val: Uint8Array
  /** By cell: the data's step flags (1 closes +x, 2 closes +y, 4 opens +x+y, 8 opens -x-y). */
  flags: Uint8Array
  /** By node: its height, in yards. */
  z: Float32Array
  /** By node from cells * cells on: the cell a floor is over. */
  cell: Int32Array
  /** By cell: its first floor, or -1. */
  first: Int32Array
  /** By node: the steps besides the base grid's. layer: 0 the base surface, i the cell's ith floor, -1 the surface nearest the node's height. cost: whole yards for a drop, 0 for a step. */
  links: (Link[] | undefined)[]
  /** By cell: 1 on a road. */
  road: Uint8Array
}
interface Link { dx: number; dy: number; layer: number; cost: number }

const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1]
const KEY = 65536 // a node of the continent: its cluster times this, plus its number there

/**
 * A finder of ways on one continent's grid: the way between two points, and with `far` how many
 * yards it is on foot from one point to each of many, in one search that spreads from the first
 * (null for those not reached within `reach` yards, or with nowhere to stand).
 */
export type Walker = ((from: Yards, to: Yards) => Walk | null) & { far: (from: Yards, tos: Yards[], reach: number) => (number | null)[]; track: () => Tracker; wander: (from: Yards, count: number, random: () => number) => [Yards, number][] }

/**
 * Where a character stands, point after point (yards of the world): its height, and how many
 * other places to stand its cell has over it (a bridge over a canal, the floor above) and under
 * it. null where the point's cell has none at all. indoors: as the game tells it, for where to
 * start when there is no point before to go on.
 */
export type Tracker = (at: Yards, indoors?: boolean) => { z: number; over: number; under: number } | null

/** Clusters are unpacked as searches cross them, and kept. */
export function walker(nav: NavData): Walker {
  const C = nav.cells, N = C * C, GX = nav.nx * C, GY = nav.ny * C, cell = BLOCK_YARDS / C
  const clusters = new Map<number, Cluster | null>()
  // Steps both ways take from a floor into the next cluster are written on that floor only: the way back is kept here, by the node it leaves from.
  const across = new Map<number, number[]>()
  const pending = new Map<number, { node: number; link: Link }[]>() // by cluster: its steps into other clusters, not yet mirrored
  const mirrored = new Set<number>()

  const text = (field: NavField, k: number): string | null => {
    const blocks = nav.packed[field][k]
    return blocks ? Buffer.concat(blocks.map((b) => inflateSync(Buffer.from(b, 'base64')))).toString('latin1') : null
  }
  const sym = (s: string, i: number): number => B64[s.charCodeAt(i)]!
  const num = (s: string, i: number, width: 2 | 3): number => (width === 2 ? sym(s, i) * 64 + sym(s, i + 1) : (sym(s, i) * 64 + sym(s, i + 1)) * 64 + sym(s, i + 2))

  // The node on a cell for a link's layer; -1 where there is none.
  function surface(c: Cluster, lc: number, layer: number, h: number): number {
    if (layer === 0) return c.val[lc] !== 0 ? lc : -1
    const first = c.first[lc]!
    if (layer > 0) {
      const node = first < 0 ? -1 : first + layer - 1
      return node >= 0 && node < c.val.length && c.cell[node] === lc ? node : -1
    }
    let best = -1, gap = Infinity
    if (c.val[lc] !== 0) (best = lc), (gap = Math.abs(c.z[lc]! - h))
    for (let node = first; node >= 0 && node < c.val.length && c.cell[node] === lc; node++) {
      if (Math.abs(c.z[node]! - h) < gap) (best = node), (gap = Math.abs(c.z[node]! - h))
    }
    return best
  }

  function cluster(k: number): Cluster | null {
    const kept = clusters.get(k)
    if (kept !== undefined) return kept
    let made: Cluster | null = null
    try {
      made = unpack(k)
    } catch {
      // a cluster that does not read as the format says: nothing to walk there
    }
    clusters.set(k, made)
    return made
  }

  function unpack(k: number): Cluster | null {
    const grid = text('grid', k), heights = text('height', k)
    if (!grid || !heights) return null
    const floors = text('floor', k)
    const floorCount = floors ? countFloors(floors) : 0
    const val = new Uint8Array(N + floorCount), flags = new Uint8Array(N), z = new Float32Array(N + floorCount)
    const cellOf = new Int32Array(N + floorCount), first = new Int32Array(N).fill(-1), road = new Uint8Array(N)
    // A symbol under 48 is a cell (what it is, and its step flags); one from 48 on repeats the cell before it.
    let n = 0, v = 0, f = 0
    for (let i = 0; i < grid.length && n < N; i++) {
      const s = sym(grid, i)
      if (s < 48) {
        v = s >> 4
        f = s & 15
        // In a map with steep ground a ground cell's flag 8 says it is steep, not that its -x-y diagonal is open.
        if (nav.steep && v === 1 && f >= 8) (v = 3), (f -= 8)
        val[n] = v
        flags[n++] = f
      } else for (let r = 48; r <= s && n < N; r++) (val[n] = v), (flags[n++] = f)
    }
    // Heights of the cells that can be walked, each against its -y neighbour (else its -x one, else the cell before).
    const q = new Int32Array(N)
    let pos = 0, rep = 0, delta = 0, last = 0
    for (let a = 0; a < N; a++) {
      if (val[a] === 0) continue
      const pred = a % C > 0 && val[a - 1] !== 0 ? q[a - 1]! : a >= C && val[a - C] !== 0 ? q[a - C]! : last
      let h: number
      if (rep > 0) (rep--), (h = pred + delta)
      else {
        const s = sym(heights, pos)
        if (s === 47) (h = num(heights, pos + 1, 2) - 2048), (pos += 3)
        else {
          delta = s - 23
          pos++
          while (pos < heights.length && sym(heights, pos) >= 48) (rep += sym(heights, pos) - 47), pos++
          h = pred + delta
        }
      }
      last = q[a] = h
      z[a] = h * nav.zstep
    }
    // The cells that are road: runs, the first of cells that are not, two symbols a run.
    const runs = nav.roads[k]
    if (runs) {
      let at = 0, on = false
      for (let p = 0; p + 1 < runs.length; p += 2) {
        const run = num(runs, p, 2)
        if (on) road.fill(1, at, at + run)
        at += run
        on = !on
      }
    }
    const c: Cluster = { val, flags, z, cell: cellOf, first, links: [], road }
    if (floors) unpackFloors(k, c, floors)
    return c
  }

  const countFloors = (s: string): number => num(s, 0, 3)
  // The bits set in a step mask: a floor has a landing layer for each.
  const bitsOf = (mask: number): number => {
    let n = 0
    for (; mask; mask >>= 1) n += mask & 1
    return n
  }
  // A cell or a node, as a delta from the one before: a symbol under 63 is the delta, 63 is followed by the delta - 63 in three.
  const delta = (s: string, pos: number): [number, number] => (sym(s, pos) < 63 ? [sym(s, pos), pos + 1] : [63 + num(s, pos + 1, 3), pos + 4])

  // The floors of a cluster, and the steps to and from them. A step both ways take is a bit on the
  // floor it leaves, landing on the layer the floor names for it; every other is a record of its own.
  function unpackFloors(k: number, c: Cluster, s: string): void {
    let node = N, pos = 3, lc = 0
    const masks: number[] = [], landings: number[] = []
    for (let i = num(s, 0, 3); i > 0; i--) {
      const [d, at] = delta(s, pos)
      lc += d
      if (c.first[lc]! < 0) c.first[lc] = node
      c.val[node] = sym(s, at)
      c.z[node] = num(s, at + 1, 2) - 2048
      c.cell[node] = lc
      masks[node] = num(s, at + 3, 2)
      landings[node] = at + 5
      pos = at + 5 + bitsOf(masks[node]!)
      node++
    }
    const add = (at: number, link: Link): void => void (c.links[at] ??= []).push(link)
    const link = (from: number, dx: number, dy: number, layer: number, cost: number, both: boolean): void => {
      const made = { dx, dy, layer, cost }
      add(from, made)
      if (!both) return
      const lc = from < N ? from : c.cell[from]!, tx = Math.floor(lc / C) + dx, ty = (lc % C) + dy
      // Into another cluster: mirrored once that one is unpacked too.
      if (tx < 0 || ty < 0 || tx >= C || ty >= C) return void (pending.get(k) ?? pending.set(k, []).get(k)!).push({ node: from, link: made })
      const target = surface(c, tx * C + ty, layer, c.z[from]!)
      if (target >= 0) add(target, { dx: -dx, dy: -dy, layer: from < N ? 0 : from - c.first[lc]! + 1, cost })
    }
    for (let from = N; from < node; from++) {
      let landing = landings[from]!
      for (let d = 0, bits = masks[from]!; d < 8; d++, bits >>= 1) if (bits & 1) link(from, DX[d]!, DY[d]!, sym(s, landing++), 0, true)
    }
    const steps = num(s, pos, 3)
    pos += 3
    for (let i = 0, record = 0; i < steps; i++) {
      const [d, at] = delta(s, pos)
      record += d
      const kind = sym(s, at)
      link(record, DX[kind % 8]!, DY[kind % 8]!, sym(s, at + 1), 0, kind < 8)
      pos = at + 2
    }
    const drops = num(s, pos, 3)
    pos += 3
    for (let i = 0; i < drops; i++, pos += 8) link(num(s, pos, 3), sym(s, pos + 3) - 8, sym(s, pos + 4) - 8, sym(s, pos + 5), num(s, pos + 6, 2), false)  }

  const clusterAt = (gx: number, gy: number): number => Math.floor(gx / C) * nav.ny + Math.floor(gy / C)
  const local = (gx: number, gy: number): number => (gx % C) * C + (gy % C)
  const inside = (gx: number, gy: number): boolean => gx >= 0 && gy >= 0 && gx < GX && gy < GY
  const value = (gx: number, gy: number): number => (inside(gx, gy) ? (cluster(clusterAt(gx, gy))?.val[local(gx, gy)] ?? 0) : 0)
  const flagsAt = (gx: number, gy: number): number => cluster(clusterAt(gx, gy))?.flags[local(gx, gy)] ?? 0
  // A step the game lets a character take: no steeper than 50 degrees up, and with steep ground at either end downhill only.
  const climbable = (a: Cluster, from: number, b: Cluster, to: number, yards: number): boolean => {
    const rise = b.z[to]! - a.z[from]!
    return rise <= CLIMB * yards && ((a.val[from] !== 3 && b.val[to] !== 3) || rise <= 0)
  }
  const base = (gx: number, gy: number): [Cluster | null, number] => [cluster(clusterAt(gx, gy)), local(gx, gy)]
  const legalBetween = (ax: number, ay: number, bx: number, by: number): boolean => {
    const [a, from] = base(ax, ay), [b, to] = base(bx, by)
    return !!a && !!b && climbable(a, from, b, to, cell * Math.hypot(bx - ax, by - ay))
  }
  // A step north, south, east or west on the base surface, open in the data: its bit sits on the cell with the lower x or y.
  function stepOpen(gx: number, gy: number, dx: number, dy: number): boolean {
    const ax = dx < 0 ? gx + dx : gx, ay = dy < 0 ? gy + dy : gy
    if (value(ax, ay) === 0 || value(ax + (dx !== 0 ? 1 : 0), ay + (dy !== 0 ? 1 : 0)) === 0) return false
    const f = flagsAt(ax, ay)
    return dx !== 0 ? (f & 1) === 0 : (f & 2) === 0
  }
  const stepLegal = (gx: number, gy: number, dx: number, dy: number): boolean => stepOpen(gx, gy, dx, dy) && legalBetween(gx, gy, gx + dx, gy + dy)
  // A leg round a diagonal's corner: a step, and with steep ground at either end only between two cells of the same height.
  function detourLegal(gx: number, gy: number, dx: number, dy: number): boolean {
    if (!stepOpen(gx, gy, dx, dy)) return false
    const [a, from] = base(gx, gy), [b, to] = base(gx + dx, gy + dy)
    if (!a || !b) return false
    return a.val[from] !== 3 && b.val[to] !== 3 ? climbable(a, from, b, to, cell) : a.z[from] === b.z[to]
  }
  // A diagonal one: either way round its corner, or the data's own diagonal.
  function diagonalLegal(gx: number, gy: number, dx: number, dy: number): boolean {
    if (value(gx + dx, gy + dy) === 0) return false
    if ((detourLegal(gx, gy, dx, 0) && detourLegal(gx + dx, gy, 0, dy)) || (detourLegal(gx, gy, 0, dy) && detourLegal(gx, gy + dy, dx, 0))) return true
    const ax = dx < 0 ? gx + dx : gx, ay = dx < 0 ? gy + dy : gy, up = dx < 0 ? dy < 0 : dy > 0
    if (value(ax, ay) === 0) return false
    const f = flagsAt(ax, ay)
    return (up ? (f & 4) !== 0 : (f & 8) !== 0) && legalBetween(gx, gy, gx + dx, gy + dy)
  }

  // The clusters round one, unpacked, and their steps into it mirrored.
  function mirrorInto(k: number): void {
    if (mirrored.has(k)) return
    mirrored.add(k)
    const kx = Math.floor(k / nav.ny), ky = k % nav.ny
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const nx = kx + ox, ny = ky + oy, other = nx * nav.ny + ny
        if ((ox === 0 && oy === 0) || nx < 0 || ny < 0 || nx >= nav.nx || ny >= nav.ny) continue
        const from = cluster(other)
        for (const { node, link } of (from && pending.get(other)) || []) {
          const lc = node < N ? node : from!.cell[node]!, gx = nx * C + Math.floor(lc / C) + link.dx, gy = ny * C + (lc % C) + link.dy
          if (!inside(gx, gy) || clusterAt(gx, gy) !== k) continue
          const into = cluster(k), target = into ? surface(into, local(gx, gy), link.layer, from!.z[node]!) : -1
          if (target >= 0) (across.get(k * KEY + target) ?? across.set(k * KEY + target, []).get(k * KEY + target)!).push(other * KEY + node)
        }
      }
    }
  }

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const
  type Visit = (next: number, tx: number, ty: number, into: Cluster, target: number, drop: number) => void
  // Every step that can be taken from a place to stand: on the base grid, by the cluster's own
  // links, and in from the floors of the next cluster. drop: yards of a drop, 0 for a step.
  function steps(here: number, visit: Visit): void {
    const [gx, gy, c, node] = placeOf(here), k = Math.floor(here / KEY), lx = gx % C, ly = gy % C
    if (node < N) {
      for (const [dx, dy] of DIRS) {
        const tx = gx + dx, ty = gy + dy
        if (!inside(tx, ty) || !(dx !== 0 && dy !== 0 ? diagonalLegal(gx, gy, dx, dy) : stepLegal(gx, gy, dx, dy))) continue
        const tk = clusterAt(tx, ty)
        visit(tk * KEY + local(tx, ty), tx, ty, cluster(tk)!, local(tx, ty), 0)
      }
    }
    for (const link of c.links[node] ?? []) {
      const tx = gx + link.dx, ty = gy + link.dy
      if (!inside(tx, ty)) continue
      const tk = clusterAt(tx, ty), into = cluster(tk), target = into ? surface(into, local(tx, ty), link.layer, c.z[node]!) : -1
      if (target >= 0 && climbable(c, node, into!, target, cell * Math.hypot(link.dx, link.dy))) visit(tk * KEY + target, tx, ty, into!, target, link.cost)
    }
    // At the edge of a cluster: the steps that come in from the floors of the next one.
    if (lx === 0 || ly === 0 || lx === C - 1 || ly === C - 1) {
      mirrorInto(k)
      for (const next of across.get(here) ?? []) {
        const [tx, ty, into, target] = placeOf(next)
        if (climbable(c, node, into, target, cell * Math.hypot(tx - gx, ty - gy))) visit(next, tx, ty, into, target, 0)
      }
    }
  }
  const placeOf = (key: number): [number, number, Cluster, number] => {
    const k = Math.floor(key / KEY), node = key % KEY, c = cluster(k)!, lc = node < N ? node : c.cell[node]!
    return [Math.floor(k / nav.ny) * C + Math.floor(lc / C), (k % nav.ny) * C + (lc % C), c, node]
  }
  // Every place to stand on a cell: its base surface and its floors.
  function standing(gx: number, gy: number): number[] {
    if (!inside(gx, gy)) return []
    const k = clusterAt(gx, gy), c = cluster(k), lc = local(gx, gy), out: number[] = []
    if (!c) return out
    if (c.val[lc] !== 0) out.push(k * KEY + lc)
    for (let node = c.first[lc]!; node >= 0 && node < c.val.length && c.cell[node] === lc; node++) if (c.val[node] !== 0) out.push(k * KEY + node)
    return out
  }
  // The places to stand nearest to a point. Its height is not known here, so every surface of that cell counts.
  function snap([x, y]: Yards): number[] {
    const gx = Math.floor((x - nav.cx0 * BLOCK_YARDS) / cell), gy = Math.floor((y - nav.cy0 * BLOCK_YARDS) / cell)
    let best: number[] = [], least = Infinity
    for (let dx = -SNAP; dx <= SNAP; dx++) {
      for (let dy = -SNAP; dy <= SNAP; dy++) {
        if (dx * dx + dy * dy >= least) continue
        const here = standing(gx + dx, gy + dy)
        if (here.length) (best = here), (least = dx * dx + dy * dy)
      }
    }
    return best
  }
  const middle = (gx: number, gy: number): Yards => [nav.cx0 * BLOCK_YARDS + (gx + 0.5) * cell, nav.cy0 * BLOCK_YARDS + (gy + 0.5) * cell]

  // One search from a point. To one end it is steered towards it; to many it spreads evenly, until
  // each is reached or the yards walked (as the search prices them) pass `reach`. goals: by end, the
  // place to stand the way arrives at, or -1.
  function search(from: Yards, tos: Yards[], reach: number): { came: Map<number, number>; goals: number[] } {
    const cost = new Map<number, number>(), came = new Map<number, number>(), done = new Set<number>()
    const starts = snap(from), ends = new Map<number, number[]>(), goals = tos.map(() => -1)
    let left = 0
    tos.forEach((to, i) => {
      // An end farther than the reach as the crow flies would only keep the search going to its edge.
      const nodes = Math.hypot(to[0] - from[0], to[1] - from[1]) > reach ? [] : snap(to)
      if (nodes.length) left++
      for (const node of nodes) (ends.get(node) ?? ends.set(node, []).get(node)!).push(i)
    })
    if (!starts.length || !left) return { came, goals }
    const aim = tos.length === 1 ? placeOf(ends.keys().next().value!) : null
    // A binary heap on the first number: the yards walked plus, to one end, the yards still to go as the crow flies.
    const heap: [number, number][] = []
    const push = (e: [number, number]): void => {
      let i = heap.push(e) - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        if (heap[p]![0] <= heap[i]![0]) break
        ;[heap[p], heap[i]] = [heap[i]!, heap[p]!]
        i = p
      }
    }
    const pop = (): [number, number] => {
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
    for (const start of starts) {
      cost.set(start, 0)
      push([0, start])
    }
    while (heap.length && done.size < LIMIT) {
      const here = pop()[1]
      if (done.has(here)) continue
      done.add(here)
      const walked = cost.get(here)!
      if (walked > reach) break
      for (const i of ends.get(here) ?? []) if (goals[i]! < 0) (goals[i] = here), left--
      if (!left) break
      const [gx, gy, c] = placeOf(here)
      const relax = (next: number, tx: number, ty: number, into: Cluster, target: number, drop: number): void => {
        if (done.has(next)) return
        // Yards walked: half as much again off the road, the map's own price in water, a drop at its own.
        const step = drop > 0 ? drop : cell * (tx !== gx && ty !== gy ? Math.SQRT2 : 1) * (c.road[local(gx, gy)] === 1 && into.road[local(tx, ty)] === 1 ? 1 : OFFROAD) * (into.val[target] === 2 ? nav.swim : 1)
        if (walked + step >= (cost.get(next) ?? Infinity)) return
        cost.set(next, walked + step)
        came.set(next, here)
        push([walked + step + (aim ? cell * Math.hypot(tx - aim[0], ty - aim[1]) : 0), next])
      }
      steps(here, relax)
    }
    return { came, goals }
  }
  // The way a search found to one of its goals: the middles of its cells, and its yards. Never
  // fewer than the crow flies: the two ends are somewhere in their cells, not at the middles.
  function wayBack(came: Map<number, number>, goal: number, from: Yards, to: Yards): { cells: Yards[]; yards: number } {
    const cells: Yards[] = []
    for (let at: number | undefined = goal; at !== undefined; at = came.get(at)) {
      const [gx, gy] = placeOf(at)
      cells.push(middle(gx, gy))
    }
    cells.reverse()
    let yards = 0
    for (let i = 1; i < cells.length; i++) yards += Math.hypot(cells[i]![0] - cells[i - 1]![0], cells[i]![1] - cells[i - 1]![1])
    return { cells, yards: Math.round(Math.max(yards, Math.hypot(to[0] - from[0], to[1] - from[1]))) }
  }

  const zOf = (key: number): number => {
    const [, , c, node] = placeOf(key)
    return c.z[node]!
  }
  // A place to stand that leads to at least AREA others: a floor, a bridge, a hill; not the top of a tree.
  const wideKept = new Map<number, boolean>()
  const wide = (from: number): boolean => {
    if (!wideKept.has(from)) {
      const seen = new Set([from]), queue = [from]
      for (let i = 0; i < queue.length && seen.size < AREA; i++) steps(queue[i]!, (next) => void (seen.has(next) || (seen.add(next), queue.push(next))))
      wideKept.set(from, seen.size >= AREA)
    }
    return wideKept.get(from)!
  }
  // Follows one character: where it stood is where the next point is looked for from.
  const track = (): Tracker => {
    let at: number | null = null
    return ([x, y], indoors) => {
      const gx = Math.floor((x - nav.cx0 * BLOCK_YARDS) / cell), gy = Math.floor((y - nav.cy0 * BLOCK_YARDS) / cell)
      const here = standing(gx, gy)
      if (!here.length) return null // a wall, a roof, out of the grid: nothing to say, and the last place is kept
      if (at === null || !here.includes(at)) {
        // From the last place, the place of this cell the fewest steps reach (the steps of a fall
        // count too); of two as few steps away, the one nearer the last height.
        let found = -1
        if (at !== null) {
          const [ax, ay] = placeOf(at), most = 2 * Math.max(Math.abs(gx - ax), Math.abs(gy - ay)) + TRACK_SLACK, z0 = zOf(at)
          const wanted = new Set(here), depth = new Map([[at, 0]]), queue = [at]
          for (let i = 0; i < queue.length; i++) {
            const from = queue[i]!, d = depth.get(from)!
            if (d >= most || found >= 0) continue
            steps(from, (next) => {
              if (depth.has(next)) return
              if (wanted.has(next) && (found < 0 || (depth.get(found) === d + 1 && Math.abs(zOf(next) - z0) < Math.abs(zOf(found) - z0)))) found = next
              depth.set(next, d + 1)
              queue.push(next)
            })
          }
        }
        // No way there, one cell on, and every place far over or under the last: the cell is a wall
        // in the grid, with only the ground it keeps under a city. Nothing to say, the last place kept.
        if (found < 0 && at !== null) {
          const [ax, ay] = placeOf(at), z0 = zOf(at)
          if (Math.max(Math.abs(gx - ax), Math.abs(gy - ay)) <= NEAR && here.every((n) => Math.abs(zOf(n) - z0) > HIGH)) return null
        }
        // None: a flight, a portal, a first point. The surface nearest the last height; with none,
        // under a roof the highest that has another over it (a mine under its hill, the ground
        // floor of a house), in the open the top one (a bridge, where a flight lands).
        const last = at === null ? null : zOf(at), top = Math.max(...here.map(zOf))
        const roofed = here.filter((n) => zOf(n) < top - LEVEL), start = (list: number[]): number => list.reduce((a, b) => (zOf(b) > zOf(a) ? b : a))
        at = found >= 0 ? found : last !== null ? here.reduce((a, b) => (Math.abs(zOf(b) - last) < Math.abs(zOf(a) - last) ? b : a)) : start(indoors && roofed.length ? roofed : here)
      }
      // Over its head: under a roof (a mine, the floor above), or swimming (under a bridge), any
      // floor over it; on foot in the open only a high one. A city's streets lie a few yards under
      // the ground the grid keeps from the terrain beneath them, which is over no one's head.
      const z = zOf(at), [, , c, node] = placeOf(at), clear = indoors || c.val[node] === 2 ? LEVEL : HIGH
      return { z, over: here.filter((n) => zOf(n) > z + clear && wide(n)).length, under: here.filter((n) => zOf(n) < z - LEVEL).length }
    }
  }
  // For trials of the tracker: a walk taken step by step from a point, each step one the grid
  // allows, keeping its heading where it can. Gives the middle of each cell and the height stood at.
  const wander = (from: Yards, count: number, random: () => number): [Yards, number][] => {
    let here = snap(from)[0]
    if (here === undefined) return []
    const out: [Yards, number][] = []
    let heading: [number, number] = [0, 0]
    for (let i = 0; i < count; i++) {
      const [gx, gy] = placeOf(here)
      out.push([middle(gx, gy), zOf(here)])
      // A fall now and then, as a player jumps off a bridge: most of the time the steps that walk.
      let next: [number, number, number][] = []
      const falls: [number, number, number][] = []
      steps(here, (n, tx, ty, _into, _target, drop) => (drop > 0 ? falls : next).push([n, tx - gx, ty - gy]))
      if (!next.length || (falls.length && random() < 0.05)) next = falls
      if (!next.length) break
      const ahead = next.filter(([, dx, dy]) => dx === heading[0] && dy === heading[1])
      const [n, dx, dy] = ahead.length && random() < 0.8 ? ahead[Math.floor(random() * ahead.length)]! : next[Math.floor(random() * next.length)]!
      here = n
      heading = [Math.sign(dx), Math.sign(dy)]
    }
    return out
  }
  const find = (from: Yards, to: Yards): Walk | null => {
    const { came, goals } = search(from, [to], Infinity)
    if (goals[0]! < 0) return null
    const { cells, yards } = wayBack(came, goals[0]!, from, to)
    // The line starts and ends at the very points asked for, not at the middles of their cells.
    return { points: [from, ...thin(cells, cell / 2), to], yards }
  }
  const far = (from: Yards, tos: Yards[], reach: number): (number | null)[] => {
    const { came, goals } = search(from, tos, reach)
    return goals.map((goal, i) => (goal < 0 ? null : wayBack(came, goal, from, tos[i]!).yards))
  }
  return Object.assign(find, { far, track, wander })
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
