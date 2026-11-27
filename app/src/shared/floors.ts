// The floors of a dungeon's building, for the 3D view (M23-F24). Inside a dungeon the app knows where the character is
// on the map and which level it is on, counted from the minimap (main/minimap.ts), not how high it stands: the height
// is the floor under that place, looked for in the building itself (its triangles that look up, as buildings3d.ts
// reads them): the one nearest to where the character stood a moment ago, and to begin with the floor of the room the
// 2D map shows there at that level.
import type { Draw } from './buildings'
import { inPiece, type Piece } from './inside'

/** Yards a side of the squares the triangles are kept by. */
const CELL = 8
/** Yards between two heights under one place for them to be two floors. */
const APART = 2
/** Yards a floor may lie under the bottom or over the top of its room's box. */
const SLACK = 2
/** How much of a triangle's normal looks up for it to be walked on: steeper is a wall. */
const UP = 0.5
/** A place read a little into a wall has no floor under it: then the ones this many yards round it, the nearest first. */
const ROUND = [[0, 0], ...[2, 4].flatMap((r) => [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]])] as const

/** The triangles one walks on, nine numbers each (x, y up, z of its three corners), and which of them lie over each square. */
export interface Floors {
  triangles: Float32Array
  cells: Map<number, number[]>
}

/**
 * The triangles of a building that look up, in its file's own yards: nine numbers each. Not its ceilings nor its
 * liquids. position, normal: three numbers a point; index: three points a triangle; draws: the runs of the index.
 */
export function walkedOn(position: ArrayLike<number>, normal: ArrayLike<number>, index: ArrayLike<number>, draws: Pick<Draw, 'start' | 'count' | 'ceiling' | 'liquid'>[]): Float32Array {
  const out: number[] = []
  for (const d of draws) {
    if (d.ceiling || d.liquid) continue
    for (let k = d.start; k < d.start + d.count; k += 3) {
      const a = index[k]!, b = index[k + 1]!, c = index[k + 2]!
      if ((normal[a * 3 + 1]! + normal[b * 3 + 1]! + normal[c * 3 + 1]!) / 3 < UP) continue
      for (const p of [a, b, c]) out.push(position[p * 3]!, position[p * 3 + 1]!, position[p * 3 + 2]!)
    }
  }
  return new Float32Array(out)
}

/** The floors of a building where it stands: its triangles walked on, put at x, y, z of the view, turned round y and scaled as its mesh is. */
export function floorsOf(walked: Float32Array, x: number, y: number, z: number, turn: number, scale: number): Floors {
  const triangles = new Float32Array(walked.length), cos = Math.cos(turn) * scale, sin = Math.sin(turn) * scale
  for (let k = 0; k < walked.length; k += 3) {
    triangles[k] = x + walked[k]! * cos + walked[k + 2]! * sin
    triangles[k + 1] = y + walked[k + 1]! * scale
    triangles[k + 2] = z - walked[k]! * sin + walked[k + 2]! * cos
  }
  const cells = new Map<number, number[]>()
  for (let t = 0; t < triangles.length; t += 9) {
    const xs = [triangles[t]!, triangles[t + 3]!, triangles[t + 6]!], zs = [triangles[t + 2]!, triangles[t + 5]!, triangles[t + 8]!]
    for (let cz = Math.floor(Math.min(...zs) / CELL); cz <= Math.floor(Math.max(...zs) / CELL); cz++)
      for (let cx = Math.floor(Math.min(...xs) / CELL); cx <= Math.floor(Math.max(...xs) / CELL); cx++) {
        const key = cz * 65536 + cx, list = cells.get(key)
        if (list) list.push(t)
        else cells.set(key, [t])
      }
  }
  return { triangles, cells }
}

/** The heights of the floors under a place, the highest first: two of them less than APART yards from each other are one. */
export function floorsAt(floors: Floors, x: number, z: number): number[] {
  const t = floors.triangles, found: number[] = []
  for (const k of floors.cells.get(Math.floor(z / CELL) * 65536 + Math.floor(x / CELL)) ?? []) {
    // where the place is in the triangle seen from above: inside when its three weights are not negative
    const ax = t[k]!, az = t[k + 2]!, bx = t[k + 3]! - ax, bz = t[k + 5]! - az, cx = t[k + 6]! - ax, cz = t[k + 8]! - az
    const area = bx * cz - cx * bz
    if (Math.abs(area) < 1e-9) continue
    const u = ((x - ax) * cz - cx * (z - az)) / area, v = (bx * (z - az) - (x - ax) * bz) / area
    if (u < 0 || v < 0 || u + v > 1) continue
    found.push(t[k + 1]! + u * (t[k + 4]! - t[k + 1]!) + v * (t[k + 7]! - t[k + 1]!))
  }
  found.sort((a, b) => b - a)
  return found.filter((h, i) => i === 0 || found[i - 1]! - h >= APART)
}

/**
 * The height the character stands at in a dungeon. pieces: the pictures of its rooms, the lowest first; x, z: the
 * place, in the yards of the map (u east, v south); level: the one the minimap tells, the rooms up to which are on show
 * (undefined: all of them); before: the height it stood at a moment ago, null when not known; solid: whether a room's
 * picture is solid at the place, undefined while the picture is not read yet.
 *
 * With a height before: of the floors under the place, the nearest to it, as one walks. With none: the lowest floor of
 * the room the 2D map shows at the place (of the rooms on show whose picture is solid there, the one drawn last, over
 * the others); what lies higher in a room's box is a bridge, the top of a wall, a ledge. Both tried against other ways
 * on the recorded runs of Blackrock Depths (design/ROADMAP.md, M23-F24; design/dungeons3d/floors.ts). A place read a
 * little into a wall has no floor under it: then the floors a few yards round it. null where there is none;
 * undefined while a picture is awaited.
 */
export function standsOn(floors: Floors, pieces: Piece[], x: number, z: number, level: number | undefined, before: number | null, solid: (piece: Piece, x: number, z: number) => boolean | undefined): number | null | undefined {
  if (before !== null) {
    for (const [dx, dz] of ROUND) {
      const all = floorsAt(floors, x + dx, z + dz)
      if (all.length) return all.reduce((a, b) => (Math.abs(b - before) < Math.abs(a - before) ? b : a))
    }
    return null
  }
  let room: Piece | undefined
  for (const p of pieces) {
    if ((level !== undefined && p.level > level) || !inPiece(p, x, z)) continue
    const is = solid(p, x, z)
    if (is === undefined) return undefined
    if (is) room = p
  }
  let lowest: number | null = null
  for (const [dx, dz] of ROUND) {
    const all = floorsAt(floors, x + dx, z + dz), inRoom = all.filter((h) => room && h >= room.bottom - SLACK && h <= room.top + SLACK)
    if (inRoom.length) return inRoom.at(-1)!
    lowest ??= all.at(-1) ?? null
  }
  return lowest
}
