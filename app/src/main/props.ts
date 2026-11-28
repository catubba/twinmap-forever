// The trees and objects of the continents in 3D (M23-F7; the prototype, its measures and the user's choices:
// design/ROADMAP.md, M23-F6), made from the game's own files once per build of the game, after the buildings.
//
// What the game has: a tree, a fence, a cart, a lamp is an M2 model (a file of its own: "MD21" its points and materials,
// "SFID" its skin, which runs its triangles by texture, "TXID" its textures). The blocks place copies of them ("MDDF" of
// each block's "obj0": file, position, turn, scale), and so do the buildings ("MODD" of the building's file, in sets: the
// first set always, and the one of the place).
//
// What is kept: each model once, each run of its skin's first layers a piece with its own points, but not the pieces the
// game keeps hidden (their texture weight or the alpha of their colour at rest is 0: the smoke columns of the Great
// Forge, which read as stripes in the prototype of M23-F15). The copies by block: those of the blocks, those of the
// buildings in a room in the open, and every one of a building inside the ground (caves.json: the anvils and forges of
// Ironforge, M23-F17), which the view cuts as it cuts its building. Trees thinned once for the whole continent (DENSITIES).
//   buildings/m2/format.json        the format the models and copies were made in: another one is made again
//   buildings/m2/<file>.bin         a model, deflated (PropHead)
//   buildings/tex/                  the textures, shared with the buildings (buildings.ts)
//   <continent>/props/<c>-<r>.bin   the copies of a block, deflated (KEPT_BITS)
//   <continent>/props.json          the blocks that have copies (PropBlocks), written last
// A dungeon's are made the same way when it is first opened in 3D (dungeons.ts), without the lid the game leaves over its rooms (isLid).
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { lidOver, type Piece } from '../shared/inside'
import { COPY, DENSITIES, KEPT_BITS, TREE_RADIUS, type Density, type PropBlocks, type PropHead, type PropPiece } from '../shared/props'
import { BLOCKS, BLOCK_YARDS } from '../shared/world'
import { BUILDINGS_FOLDER, buriedKey, textureKeeper, type Texture } from './buildings'
import { keep } from './tiles'

export const PROPS_FILE = 'props.json'
const FORMAT = 3 // 1 had no copies of the rooms under a roof of the buildings inside the ground; 2 did not tell how low and how tall a model stands
const M2 = 'm2'

function* chunks(b: Buffer, from = 0): Generator<{ tag: string; data: Buffer }> {
  for (let at = from; at + 8 <= b.length; ) {
    const size = b.readUInt32LE(at + 4)
    yield { tag: b.toString('latin1', at, at + 4), data: b.subarray(at + 8, at + 8 + size) }
    at += 8 + size
  }
}
const chunk = (b: Buffer, tag: string): Buffer | undefined => {
  for (const c of chunks(b)) if (c.tag === tag) return c.data
}

/**
 * A model of the game for the view: its pieces with their points turned into the view's axes (x east = -y of the file,
 * y up = z, z south = -x, as a building's), or null for a file with nothing to draw. texture: what a texture is.
 */
export function makeModel(f: Buffer, read: (id: number) => Buffer | null, texture: (id: number) => Texture | null): { head: PropHead; body: Buffer } | null {
  const md = chunk(f, 'MD21'), sfid = chunk(f, 'SFID'), txid = chunk(f, 'TXID')
  const skin = md && sfid && sfid.length >= 4 ? read(sfid.readUInt32LE(0)) : null
  if (!md || !skin) return null
  const u32 = (b: Buffer, at: number): number => (at + 4 <= b.length ? b.readUInt32LE(at) : 0)
  const u16 = (b: Buffer, at: number): number => (at + 2 <= b.length ? b.readUInt16LE(at) : 0)
  const f32 = (at: number): number => (at + 4 <= md.length ? md.readFloatLE(at) : 0)
  // the head of MD21: an array is its count, then where it starts
  const arr = (at: number): [number, number] => [u32(md, at), u32(md, at + 4)]
  const [nv, ov] = arr(60), [ncol, ocol] = arr(72), [nt, ot] = arr(80), [ntwt, otwt] = arr(88), [nm, om] = arr(112), [nc, oc] = arr(128), [nu, ou] = arr(136), [ntw, otw] = arr(144)
  // the first value of a track of fixed-point numbers (values by sequence at 12), else 1
  const still = (track: number): number => {
    const [seqs, os] = arr(track + 12)
    for (let q = 0; q < seqs && os + q * 8 + 8 <= md.length; q++) {
      const [c, o] = arr(os + q * 8)
      if (c && o + 2 <= md.length) return md.readInt16LE(o) / 32767
    }
    return 1
  }
  const [nb, ob] = [u32(skin, 36), u32(skin, 40)], [ni, oi] = [u32(skin, 12), u32(skin, 16)], osv = u32(skin, 8), oss = u32(skin, 32)
  const pieces: { piece: PropPiece; data: number[]; idx: number[] }[] = []
  let radius = 0, low = Infinity, high = -Infinity
  for (let b = 0; b < nb; b++) {
    const at = ob + b * 24
    if (u16(skin, at + 12) !== 0) continue // the first layer of a material only
    const combo = u16(skin, at + 16), material = u16(skin, at + 10)
    if (combo >= nc || material >= nm) continue
    // shown at rest: its texture weight, and the alpha of its colour
    const weight = u16(skin, at + 20), colour = u16(skin, at + 8)
    const opacity = (weight < ntw && ntwt ? still(otwt + u16(md, otw + weight * 2) * 20) : 1) * (colour !== 0xffff && colour < ncol ? still(ocol + colour * 40 + 20) : 1)
    if (opacity < 0.01) continue
    const t = u16(md, oc + combo * 2), type = t < nt ? u32(md, ot + t * 16) : 1
    const id = type === 0 && txid && t * 4 + 4 <= txid.length ? txid.readUInt32LE(t * 4) : 0 // others are replaced by the game (skins): none
    // the second set of texture coordinates when the skin says so; a layer mapped round the view (-1) from its normal
    const coord = u16(skin, at + 18) < nu ? md.readInt16LE(ou + u16(skin, at + 18) * 2) : 0
    const section = oss + u16(skin, at + 4) * 48
    const start = u16(skin, section + 8) + (u16(skin, section + 2) << 16), count = u16(skin, section + 10)
    const data: number[] = [], idx: number[] = [], local = new Map<number, number>()
    for (let k = start; k < start + count && k < ni; k++) {
      const v = u16(skin, osv + u16(skin, oi + k * 2) * 2)
      if (v >= nv) continue
      let i = local.get(v)
      if (i === undefined) {
        local.set(v, (i = local.size))
        const a = ov + v * 48, x = f32(a), y = f32(a + 4), z = f32(a + 8), nx = f32(a + 20), ny = f32(a + 24), nz = f32(a + 28)
        const uv = coord < 0 ? [0.5 + 0.5 * nx, 0.5 - 0.5 * ny] : [f32(a + 32 + (coord === 1 ? 8 : 0)), f32(a + 36 + (coord === 1 ? 8 : 0))]
        data.push(-y, z, -x, -ny, nz, -nx, uv[0]!, uv[1]!)
        radius = Math.max(radius, Math.hypot(x, y, z))
        low = Math.min(low, z)
        high = Math.max(high, z)
      }
      idx.push(i)
    }
    if (idx.length < 3) continue
    const tex = id ? texture(id) : null
    pieces.push({ piece: { points: local.size, indices: idx.length - (idx.length % 3), texture: tex ? id : 0, kind: tex?.kind ?? 'none', blend: u16(md, om + material * 4 + 2), flags: u16(md, om + material * 4), opacity: Number(opacity.toFixed(3)) }, data, idx: idx.slice(0, idx.length - (idx.length % 3)) })
  }
  if (!pieces.length) return null
  const head: PropHead = { radius: Math.ceil(radius), tree: radius >= TREE_RADIUS && pieces.some((p) => p.piece.blend === 1), low: Number(low.toFixed(2)), tall: Number((high - low).toFixed(2)), pieces: pieces.map((p) => p.piece) }
  const json = Buffer.from(JSON.stringify(head)), pad = (b: Buffer): Buffer => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)])
  const body = Buffer.concat([Buffer.from(new Uint32Array([json.length]).buffer), pad(json), ...pieces.flatMap((p) => [Buffer.from(new Float32Array(p.data).buffer), pad(Buffer.from(new Uint16Array(p.idx).buffer))])])
  return { head, body }
}

// A 3 x 4 matrix, column by column: the images of x, y and z, then where the origin goes.
type M = number[]
const mul = (a: M, b: M): M => {
  const r: M = []
  for (let c = 0; c < 4; c++) for (let i = 0; i < 3; i++) r.push(a[i]! * b[c * 3]! + a[3 + i]! * b[c * 3 + 1]! + a[6 + i]! * b[c * 3 + 2]! + (c === 3 ? a[9 + i]! : 0))
  return r
}
// From the axes of a file of the game to the view's, and back.
const TO_VIEW: M = [0, 0, -1, -1, 0, 0, 0, 1, 0, 0, 0, 0], FROM_VIEW: M = [0, -1, 0, 0, 0, 1, -1, 0, 0, 0, 0, 0]
/** Standing on the blocks as a building stands (buildings.ts): turned round y (radians, as three.js), scaled, moved. */
export const standingAt = (x: number, y: number, z: number, turn: number, s: number): M => {
  const c = Math.cos(turn) * s, n = Math.sin(turn) * s
  return [c, 0, -n, 0, s, 0, n, 0, c, x, y, z]
}
// A copy in a building's file: turned by its quaternion, scaled, moved, in the file's axes.
const inBuilding = (px: number, py: number, pz: number, x: number, y: number, z: number, w: number, s: number): M => [
  s * (1 - 2 * (y * y + z * z)), s * 2 * (x * y + z * w), s * 2 * (x * z - y * w),
  s * 2 * (x * y - z * w), s * (1 - 2 * (x * x + z * z)), s * 2 * (y * z + x * w),
  s * 2 * (x * z + y * w), s * 2 * (y * z - x * w), s * (1 - 2 * (x * x + y * y)),
  px, py, pz,
]

/** A copy: the model's file, its matrix into the view's yards, where its building stands when it is inside the ground (cut as it is), and whether a block places it, not a building. */
export interface Copy {
  file: number
  m: M
  under?: [number, number]
  block?: true
}

/** Yards a sheet reaches from where it stands from which it can be a lid (a carpet of grass reaches 45), and the yards a sheet is tall at most. */
const LID_REACH = 100
const SHEET = 1

/**
 * Whether a copy the blocks place is a lid over the rooms of a dungeon (M23-F28): a wide level sheet with a room of
 * the 2D map wholly under it. The game hides the sky of Deadmines with one, 1,400 yards wide, 160 yards over the
 * mine: from above it hides the mine. Measured on the 38 dungeons with a ground (design/dungeons3d/cover.ts): of
 * 188,422 copies it is the only one. model: the copy's (PropHead); rooms: the pieces of the dungeon's 2D map.
 */
export function isLid(c: Copy, model: { radius: number; low: number; tall: number }, rooms: Piece[]): boolean {
  const s = Math.hypot(c.m[0]!, c.m[1]!, c.m[2]!), reach = model.radius * s
  if (!c.block || model.tall * s > SHEET || reach < LID_REACH) return false
  return lidOver(rooms, [c.m[9]! - reach, c.m[11]! - reach, c.m[9]! + reach, c.m[11]! + reach], c.m[10]! + model.low * s)
}

/**
 * The copies a continent has. buried: its buildings inside the ground (caves.json), by buriedKey, or 'all' for a
 * dungeon: of these, the copies of every room; of the others, those of the rooms in the open.
 */
export function copiesOf(wdt: Buffer, read: (id: number) => Buffer | null, buried?: Set<string> | 'all'): Copy[] {
  const maid = chunk(wdt, 'DIAM'), out: Copy[] = []
  const blockSeen = new Set<number>(), buildingSeen = new Set<number>()
  // the doodads of a building's rooms, by building file: those of its sets, where they stand in the file, in a room in the open or not
  const outdoor = new Map<number, Map<number, { file: number; m: M; open: boolean }[]> | null>()
  const ofBuilding = (id: number): Map<number, { file: number; m: M; open: boolean }[]> | null => {
    if (outdoor.has(id)) return outdoor.get(id)!
    let sets: Map<number, { file: number; m: M; open: boolean }[]> | null = null
    const f = read(id), head = f && chunk(f, 'DHOM'), gfid = f && chunk(f, 'DIFG'), modd = f && chunk(f, 'DDOM'), mods = f && chunk(f, 'SDOM'), modi = f && chunk(f, 'IDOM')
    if (f && head && gfid && modd && mods && modi) {
      // a doodad is out in the open when every room that lists it is (MODR of each room)
      const open = new Map<number, boolean>()
      for (let i = 0; i < head.readUInt32LE(4) && i * 4 + 4 <= gfid.length; i++) {
        const g = gfid.readUInt32LE(i * 4), b = g ? read(g) : null, mogp = b && chunk(b, 'PGOM')
        if (!mogp) continue
        const room = (mogp.readUInt32LE(8) & 0x48) !== 0
        for (const c of chunks(mogp, 68)) if (c.tag === 'RDOM') for (let k = 0; k + 2 <= c.data.length; k += 2) open.set(c.data.readUInt16LE(k), (open.get(c.data.readUInt16LE(k)) ?? true) && room)
      }
      sets = new Map()
      for (let s = 0; s * 32 + 32 <= mods.length; s++) {
        const list: { file: number; m: M; open: boolean }[] = [], start = mods.readUInt32LE(s * 32 + 20), count = mods.readUInt32LE(s * 32 + 24)
        for (let d = start; d < start + count && d * 40 + 40 <= modd.length; d++) {
          const name = modd.readUInt32LE(d * 40) & 0xffffff, file = name * 4 + 4 <= modi.length ? modi.readUInt32LE(name * 4) : 0
          if (!file) continue
          const a = d * 40, q = (k: number): number => modd.readFloatLE(a + k)
          list.push({ file, open: !!open.get(d), m: mul(TO_VIEW, mul(inBuilding(q(4), q(8), q(12), q(16), q(20), q(24), q(28), q(32)), FROM_VIEW)) })
        }
        sets.set(s, list)
      }
    }
    outdoor.set(id, sets)
    return sets
  }
  // the copies of the buildings a "MODF" tells; middle: the yards to add to where each stands (buildings.ts, placements)
  const ofBuildings = (modf: Buffer, middle: number): void => {
    for (let at = 0; at + 64 <= modf.length; at += 64) {
      if (!(modf.readUInt16LE(at + 56) & 8) || buildingSeen.has(modf.readUInt32LE(at + 4))) continue
      buildingSeen.add(modf.readUInt32LE(at + 4))
      const sets = ofBuilding(modf.readUInt32LE(at))
      if (!sets) continue
      const x = modf.readFloatLE(at + 8) + middle, z = modf.readFloatLE(at + 16) + middle
      const place = standingAt(x, modf.readFloatLE(at + 12), z, ((modf.readFloatLE(at + 24) - 180) * Math.PI) / 180, modf.readUInt16LE(at + 62) / 1024 || 1)
      const under = buried === 'all' || buried?.has(buriedKey(modf.readUInt32LE(at), x, z))
      for (const s of new Set([0, modf.readUInt16LE(at + 58)])) for (const c of sets.get(s) ?? []) if (c.open || under) out.push({ file: c.file, m: mul(place, c.m), ...(under ? { under: [x, z] as [number, number] } : {}) })
    }
  }
  // a map that is one building and no ground has it in the world file itself, at the middle of the square
  const own = chunk(wdt, 'FDOM')
  if (own) ofBuildings(own, (BLOCKS / 2) * BLOCK_YARDS)
  for (let block = 0; maid && block < BLOCKS * BLOCKS; block++) {
    const id = maid.readUInt32LE(block * 32 + 4), objects = id ? read(id) : null
    if (!objects) continue
    const mddf = chunk(objects, 'FDDM'), modf = chunk(objects, 'FDOM')
    for (let at = 0; mddf && at + 36 <= mddf.length; at += 36) {
      // named, not numbered (flag 0x40): not seen in this game, as for buildings
      if (!(mddf.readUInt16LE(at + 34) & 0x40) || blockSeen.has(mddf.readUInt32LE(at + 4))) continue
      blockSeen.add(mddf.readUInt32LE(at + 4))
      // ponytail: the turn round the up of the world only, as the buildings; a copy leaning on a slope stands straight
      const turn = ((mddf.readFloatLE(at + 24) - 180) * Math.PI) / 180
      out.push({ file: mddf.readUInt32LE(at), m: standingAt(mddf.readFloatLE(at + 8), mddf.readFloatLE(at + 12), mddf.readFloatLE(at + 16), turn, mddf.readUInt16LE(at + 32) / 1024 || 1), block: true })
    }
    if (modf) ofBuildings(modf, 0)
  }
  return out
}

/**
 * Which trees are drawn at each density: a bit of KEPT_BITS each. trees: where each stands (x, z) and its crown, in
 * yards. In an order fixed by where they stand, a tree is kept when no tree kept before it is nearer than the density
 * times the two crowns together.
 */
export function thinned(trees: { x: number; z: number; crown: number }[]): Uint8Array {
  const bits = new Uint8Array(trees.length)
  const hash = (x: number, z: number): number => {
    let h = Math.imul(Math.round(x * 10) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(z * 10), 0xc2b2ae35)
    h ^= h >>> 13
    return Math.imul(h, 0x27d4eb2d) >>> 0
  }
  const order = trees.map((t, i) => ({ i, h: hash(t.x, t.z) })).sort((a, b) => a.h - b.h || a.i - b.i)
  for (const density of Object.keys(DENSITIES) as Density[]) {
    const f = DENSITIES[density], CELL = 80, grid = new Map<number, number[]>()
    for (const { i } of order) {
      const t = trees[i]!, cx = Math.floor(t.x / CELL), cz = Math.floor(t.z / CELL)
      let keepIt = true
      for (let a = cx - 1; a <= cx + 1 && keepIt; a++)
        for (let b = cz - 1; b <= cz + 1 && keepIt; b++)
          for (const o of grid.get(a * 100000 + b) ?? []) {
            const k = trees[o]!
            if (Math.hypot(k.x - t.x, k.z - t.z) < f * (k.crown + t.crown)) {
              keepIt = false
              break
            }
          }
      if (!keepIt) continue
      bits[i]! |= KEPT_BITS[density]
      const key = cx * 100000 + cz
      ;(grid.get(key) ?? grid.set(key, []).get(key)!).push(i)
    }
  }
  return bits
}

// The format the models of a folder were made in; 0 for none.
function formatOf(folder: string): number {
  try {
    return (JSON.parse(readFileSync(join(folder, BUILDINGS_FOLDER, M2, 'format.json'), 'utf8')) as { format?: number }).format ?? 0
  } catch {
    return 0
  }
}

/** Whether the trees and objects of these continents are all made, in this format. */
export function propsMade(folder: string, worlds: string[]): boolean {
  return formatOf(folder) === FORMAT && worlds.every((w) => existsSync(join(folder, w, PROPS_FILE)))
}

/**
 * Makes the trees and objects of the continents given, in the folder of the build: each model once, kept as it is made
 * (an interrupted run resumes), the copies of each continent by block, its list last. read: a game file by number, null
 * when there is none or the server has not sent its key. rooms: of a dungeon, the pieces of its 2D map: a lid over
 * them is left out. Gives what was made.
 */
export function makeProps(worlds: { name: string; wdt: Buffer; buried?: Set<string> | 'all'; rooms?: Piece[] }[], read: (id: number) => Buffer | null, folder: string): { models: number; copies: number } {
  const dir = join(folder, BUILDINGS_FOLDER), m2 = join(dir, M2)
  if (formatOf(folder) !== FORMAT) {
    rmSync(m2, { recursive: true, force: true })
    // every list made in the other format goes, not only the ones made now: a continent's, and those of the dungeons
    // opened so far, which are made again when next opened (dungeons.ts)
    for (const d of readdirSync(folder, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      rmSync(join(folder, d.name, PROPS_FILE), { force: true })
      rmSync(join(folder, d.name, 'props'), { recursive: true, force: true })
    }
    mkdirSync(m2, { recursive: true })
    writeFileSync(join(m2, 'format.json'), JSON.stringify({ format: FORMAT }))
  }
  const texture = textureKeeper(dir, read)
  // each model's radius, how it stands and whether it is a tree, or null for one with nothing to draw
  type Kept = Pick<PropHead, 'radius' | 'tree' | 'low' | 'tall'>
  const models = new Map<number, Kept | null>()
  const model = (file: number): Kept | null => {
    if (models.has(file)) return models.get(file)!
    const out = join(m2, `${file}.bin`), none = join(m2, `${file}.none`)
    let made: Kept | null = null
    if (existsSync(out)) made = JSON.parse(readFileSync(out + '.json', 'utf8')) as Kept
    else if (!existsSync(none)) {
      const f = read(file), b = f && makeModel(f, read, texture)
      if (!b) keep(none, () => Buffer.alloc(0))
      else {
        made = { radius: b.head.radius, tree: b.head.tree, low: b.head.low, tall: b.head.tall }
        // what it is beside it first, so a model kept is never without it
        writeFileSync(out + '.json', JSON.stringify(made))
        keep(out, () => deflateSync(b.body))
      }
    }
    models.set(file, made)
    return made
  }
  let copies = 0
  for (const w of worlds) {
    const all = copiesOf(w.wdt, read, w.buried).filter((c) => model(c.file))
    // giants (Darnassus' trees, wider than 100 yards) are never drawn: from above they are a roof over the city; nor is a lid over a dungeon's rooms
    const scale = (c: { m: M }): number => Math.hypot(c.m[0]!, c.m[1]!, c.m[2]!)
    const shown = all.filter((c) => !(models.get(c.file)!.tree && models.get(c.file)!.radius * scale(c) > 100) && !(w.rooms && isLid(c, models.get(c.file)!, w.rooms)))
    const trees = shown.filter((c) => models.get(c.file)!.tree)
    const bits = thinned(trees.map((c) => ({ x: c.m[9]!, z: c.m[11]!, crown: 0.6 * models.get(c.file)!.radius * scale(c) })))
    const kept = new Map<Copy, number>(trees.map((c, i) => [c, bits[i]!]))
    // by block, then by model
    const blocks = new Map<string, Map<number, number[]>>()
    for (const c of shown) {
      const column = Math.min(BLOCKS - 1, Math.max(0, Math.floor(c.m[9]! / BLOCK_YARDS))), row = Math.min(BLOCKS - 1, Math.max(0, Math.floor(c.m[11]! / BLOCK_YARDS)))
      const key = `${column}-${row}`, byModel = blocks.get(key) ?? blocks.set(key, new Map()).get(key)!
      const list = byModel.get(c.file) ?? byModel.set(c.file, []).get(c.file)!
      list.push(...c.m, kept.get(c) ?? KEPT_BITS.few | KEPT_BITS.some | KEPT_BITS.many, c.under?.[0] ?? NaN, c.under?.[1] ?? NaN)
    }
    const into = join(folder, w.name, 'props')
    mkdirSync(into, { recursive: true })
    for (const [key, byModel] of blocks) {
      const parts: Buffer[] = [Buffer.from(new Uint32Array([byModel.size]).buffer)]
      for (const [file, list] of byModel) parts.push(Buffer.from(new Uint32Array([file, list.length / COPY]).buffer), Buffer.from(new Float32Array(list).buffer))
      writeFileSync(join(into, `${key}.bin`), deflateSync(Buffer.concat(parts)))
    }
    const list: PropBlocks = { format: FORMAT, blocks: [...blocks.keys()] }
    const file = join(folder, w.name, PROPS_FILE)
    writeFileSync(file + '.part', JSON.stringify(list))
    renameSync(file + '.part', file)
    copies += shown.length
  }
  return { models: [...models.values()].filter(Boolean).length, copies }
}
