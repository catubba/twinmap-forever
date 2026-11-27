// The buildings of the continents in 3D (M23-F2; the prototype and its measures: design/ROADMAP.md, M16-F8), made from
// the game's own files once per build of the game, after the map.
//
// What the game has: a building is a file (.wmo) standing on the blocks of a continent ("MODF" of each block's "obj0",
// listed by every block it lies on). Its rooms are files of their own ("GFID": for each level of detail, a file a
// room); a room has its triangles ("MOVT", "MOVI"), texture coordinates and normals ("MOTV", "MONR"), and its runs of
// triangles of one material ("MOBA"); the building lists the materials ("MOMT": texture, blending, lit or not). A room
// may hold a liquid of its own ("MLIQ": the canals of Stormwind, the lava of Ironforge), which is not the ground's.
//
// What is kept: every room at full detail, outdoors and indoors (the user's choice of 26 November 2026), each building
// file once; its materials gathered by what can share a texture array (same kind, size, levels, blending, light), as the
// prototype's 31 draws for Stormwind instead of 357. Not cut to what the sky sees, as the prototype was: that cut took
// ten minutes of a processor for the whole world, the triangles it saved (four in ten) the graphics card throws away
// behind the walls anyway (the user's choice of 26 November 2026, design/ROADMAP.md, M23-F2).
//   buildings/format.json         the format the folder was made in: another one is made again from nothing
//   buildings/<file>.bin          a building, deflated (Building below)
//   buildings/tex/<id>.bin        a texture as the game keeps it (DXT blocks), its levels from the first at most 512
//                                  wide, deflated: Uint32 count, then for each Uint32 width, height, byte count, blocks
//   buildings/tex/<id>.png        a texture the game keeps some other way, halved to at most 512
//   <continent>/buildings.json    where they stand (Placed), written last: the view takes no building before it
//
// Coordinates of a building's file: yards, x east, y up, z south, as the 3D view (terrain3d.ts) has them for a
// building not turned; standing, it is turned by its turn round y, scaled, and moved to x, y, z.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { decodeBlpCutout } from '../shared/blp'
import { DUNGEON, type BuildingHead, type Draw, type Placed, type TexKind } from '../shared/buildings'
import { FEL, LAVA, WATER } from '../shared/water'
import { BLOCK_YARDS, BLOCKS } from '../shared/world'
import { encodePng } from './png'
import { keep } from './tiles'

export const BUILDINGS_FOLDER = 'buildings'
export const PLACED_FILE = 'buildings.json'
const FORMAT = 5 // 1 was cut to what the sky sees; 2 kept of a city inside a mountain only its rooms in the open; 3 had no ceilings apart; 4 had no liquids
/** Pixels of a texture's widest level kept. */
const TEX = 512

// A file of the game is a run of chunks: a four letter tag written backwards, a size, the data.
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
const floats = (d: Buffer): Float32Array => new Float32Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.length))

/**
 * Where a map's buildings are told ("MODF", 64 bytes each): in each block's "obj0", and in the world file itself for a
 * map that is one building and no ground (a dungeon), which stands at the middle of the square whatever its entry says
 * (interiors.ts). middle: the yards to add to its x and z.
 */
export function* placements(wdt: Buffer, read: (id: number) => Buffer | null): Generator<{ modf: Buffer; middle: number }> {
  const own = chunk(wdt, 'FDOM'), maid = chunk(wdt, 'DIAM')
  if (own) yield { modf: own, middle: (BLOCKS / 2) * BLOCK_YARDS }
  for (let block = 0; maid && block < BLOCKS * BLOCKS; block++) {
    const id = maid.readUInt32LE(block * 32 + 4), objects = id ? read(id) : null, modf = objects && chunk(objects, 'FDOM')
    if (modf) yield { modf, middle: 0 }
  }
}

/** The buildings standing on a continent or in a dungeon, each once, in the view's yards. wdt: its world file; read: a game file by number. */
export function standing(wdt: Buffer, read: (id: number) => Buffer | null): { file: number; x: number; y: number; z: number; turn: number; scale: number }[] {
  const placed = new Map<number, { file: number; x: number; y: number; z: number; turn: number; scale: number }>()
  for (const { modf, middle } of placements(wdt, read)) {
    for (let at = 0; at + 64 <= modf.length; at += 64) {
      if (!(modf.readUInt16LE(at + 56) & 8)) continue // named, not numbered: not seen in this game (interiors.ts)
      // as interiors.ts lays a building: u east and v south of the world's corner, the turn round the up of the world
      placed.set(modf.readUInt32LE(at + 4), {
        file: modf.readUInt32LE(at),
        x: modf.readFloatLE(at + 8) + middle,
        y: modf.readFloatLE(at + 12),
        z: modf.readFloatLE(at + 16) + middle,
        turn: ((modf.readFloatLE(at + 24) - 180) * Math.PI) / 180,
        scale: modf.readUInt16LE(at + 62) / 1024 || 1,
      })
    }
  }
  return [...placed.values()]
}

interface Room {
  pos: Float32Array
  uv: Float32Array
  normal: Float32Array
  tris: Uint16Array
  batches: { start: number; count: number; material: number }[]
  /** Marked outdoors, or lit as outdoors (the streets of Stormwind's districts): what stands out of a mountain. */
  outdoor: boolean
  /** Its own liquid: which (a row of the game's table of liquids), its points in the view's axes, its triangles. */
  liquid?: { type: number; pos: Float32Array; tris: number[] }
}

/** Yards a side of a square of a room's liquid, as of the ground's. */
const LIQUID_SQUARE = 25 / 6
// A room's liquid from its "MLIQ": 30 bytes of head (points each way, squares each way, the corner it starts from, a
// material), 8 bytes a point, a byte a square: no liquid there when its low four bits are all set. Laid flat at the
// height of the corner: the heights of the points are 0 wherever the game does not use them. Undefined when it has none.
function liquidOf(d: Buffer, type: number): Room['liquid'] {
  const xv = d.readUInt32LE(0), yv = d.readUInt32LE(4), xt = d.readUInt32LE(8), yt = d.readUInt32LE(12)
  if (xt !== xv - 1 || yt !== yv - 1 || d.length < 30 + xv * yv * 8 + xt * yt) return undefined
  const x0 = d.readFloatLE(16), y0 = d.readFloatLE(20), z = d.readFloatLE(24), squares = d.subarray(30 + xv * yv * 8)
  const pos: number[] = [], tris: number[] = [], made = new Map<number, number>()
  const point = (i: number, j: number): number => {
    const k = j * xv + i
    if (!made.has(k)) (made.set(k, pos.length / 3), pos.push(-(y0 + j * LIQUID_SQUARE), z, -(x0 + i * LIQUID_SQUARE)))
    return made.get(k)!
  }
  for (let j = 0; j < yt; j++)
    for (let i = 0; i < xt; i++) {
      if ((squares[j * xt + i]! & 15) === 15) continue
      const a = point(i, j), b = point(i + 1, j), c = point(i, j + 1), e = point(i + 1, j + 1)
      tris.push(a, b, c, b, e, c)
    }
  return tris.length ? { type, pos: new Float32Array(pos), tris } : undefined
}
/** A room of a building from its file: its points turned into the view's axes (x east = -y of the file, y up = z, z south = -x). */
export function roomOf(f: Buffer): Room | null {
  const g = chunk(f, 'PGOM')
  if (!g) return null
  let verts: Float32Array | undefined, uvs: Float32Array | undefined, normals: Float32Array | undefined, tris: Uint16Array | undefined, liquid: Room['liquid']
  const batches: Room['batches'] = []
  for (const c of chunks(g, 68)) {
    // the liquid is told at byte 52 of the room's head
    if (c.tag === 'QILM' && c.data.length >= 30) liquid = liquidOf(c.data, g.readUInt32LE(52))
    if (c.tag === 'TVOM') verts = floats(c.data)
    if (c.tag === 'IVOM') tris = new Uint16Array(c.data.buffer.slice(c.data.byteOffset, c.data.byteOffset + c.data.length))
    if (c.tag === 'VTOM' && !uvs) uvs = floats(c.data)
    if (c.tag === 'RNOM') normals = floats(c.data)
    // MOBA, 24 bytes a batch: first index at 12, count at 16, flags at 22, material at 23 (at 10 with flag 2)
    if (c.tag === 'ABOM')
      for (let at = 0; at + 24 <= c.data.length; at += 24) {
        const flags = c.data[at + 22]!
        batches.push({ start: c.data.readUInt32LE(at + 12), count: c.data.readUInt16LE(at + 16), material: flags & 2 ? c.data.readUInt16LE(at + 10) : c.data[at + 23]! })
      }
  }
  if (!verts || !tris) return null
  const n = verts.length / 3, pos = new Float32Array(n * 3), normal = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    pos.set([-verts[i * 3 + 1]!, verts[i * 3 + 2]!, -verts[i * 3]!], i * 3)
    normal.set(normals ? [-normals[i * 3 + 1]!, normals[i * 3 + 2]!, -normals[i * 3]!] : [0, 1, 0], i * 3)
  }
  return { pos, uv: uvs && uvs.length >= n * 2 ? uvs.subarray(0, n * 2) : new Float32Array(n * 2), normal, tris, batches, outdoor: (g.readUInt32LE(8) & 0x48) !== 0, ...(liquid ? { liquid } : {}) }
}

interface Material { texture: number; blend: number; unlit: boolean }
export interface Texture { kind: TexKind; width: number; height: number; levels: number }

/**
 * A building's file made from the game's: its rooms at full detail, the draws gathered by what can share a texture
 * array, the ceilings of its rooms under a roof in draws of their own (a building inside the ground is drawn without
 * them, buildings3d.ts), and the height of its main floor. read: a game file by number; texture: what a texture is (written once by
 * makeTexture); liquid: what a liquid of the game's table is (shared/water.ts). The liquids of its rooms are draws of
 * their own, one a kind, with no texture. Null for a file that is not a building or has nothing to draw.
 */
export function makeBuilding(file: Buffer, read: (id: number) => Buffer | null, texture: (id: number) => Texture | null, liquid: (type: number) => number = () => WATER): { head: BuildingHead; body: Buffer } | null {
  const head = chunk(file, 'DHOM'), gfid = chunk(file, 'DIFG'), momt = chunk(file, 'TMOM')
  if (!head || !gfid) return null
  const rooms = head.readUInt32LE(4)
  const materials: Material[] = []
  for (let at = 0; momt && at + 64 <= momt.length; at += 64) materials.push({ unlit: (momt.readUInt32LE(at) & 1) === 1, blend: momt.readUInt32LE(at + 8), texture: momt.readUInt32LE(at + 12) })
  // every room's points one after the other; the triangles by material
  // the triangles by material, and apart those of the ceilings (as negative materials, -1 - material)
  const pos: number[] = [], uv: number[] = [], normal: number[] = [], byMaterial = new Map<number, number[]>()
  // the heights of the points of floors under a roof: those whose normal looks up, in the rooms not in the open
  const floors: number[] = []
  // the triangles of the liquids, by kind
  const liquids = new Map<number, number[]>()
  for (let i = 0; i < rooms && i * 4 < gfid.length; i++) {
    const id = gfid.readUInt32LE(i * 4), b = id ? read(id) : null, room = b && roomOf(b)
    if (!room) continue
    const first = pos.length / 3
    if (!room.outdoor) for (let k = 1; k < room.pos.length; k += 3) if (room.normal[k]! > 0.5) floors.push(room.pos[k]!)
    for (const v of room.pos) pos.push(v)
    for (const v of room.uv) uv.push(v)
    for (const v of room.normal) normal.push(v)
    for (const batch of room.batches) {
      for (let t = batch.start; t + 2 < batch.start + batch.count && t + 2 < room.tris.length; t += 3) {
        // a ceiling: under a roof, its points' normals looking down, even a little (domes, slopes); the room's normals look inwards
        const a = room.tris[t]!, b = room.tris[t + 1]!, c = room.tris[t + 2]!
        const ceiling = !room.outdoor && (room.normal[a * 3 + 1]! + room.normal[b * 3 + 1]! + room.normal[c * 3 + 1]!) / 3 < -0.25
        const key = ceiling ? -1 - batch.material : batch.material
        ;(byMaterial.get(key) ?? byMaterial.set(key, []).get(key)!).push(first + a, first + b, first + c)
      }
    }
    if (room.liquid) {
      // its points after the room's, level and with no picture
      const from = pos.length / 3, kind = liquid(room.liquid.type), list = liquids.get(kind) ?? liquids.set(kind, []).get(kind)!
      for (const v of room.liquid.pos) pos.push(v)
      for (let k = 0; k < room.liquid.pos.length / 3; k++) (uv.push(0, 0), normal.push(0, 1, 0))
      for (const v of room.liquid.tris) list.push(from + v)
    }
  }
  // the draws: materials of one look, their textures as layers
  const looks = new Map<string, { kind: TexKind; blend: number; unlit: boolean; ceiling: boolean; textures: number[]; tris: number[]; liquid?: number }>()
  for (const [key0, list] of byMaterial) {
    const ceiling = key0 < 0, m = ceiling ? -1 - key0 : key0
    const mat = materials[m] ?? { texture: 0, blend: 0, unlit: false }, tex = mat.texture ? texture(mat.texture) : null
    const blend = mat.blend === 1 ? 1 : mat.blend >= 2 ? 2 : 0, kind: TexKind = tex?.kind ?? 'none'
    // a PNG is a draw of its own; DXT ones of one kind, size and number of levels share an array
    const key = (kind === 'png' ? `png ${mat.texture} ${blend} ${mat.unlit}` : `${kind} ${tex?.width}x${tex?.height} ${tex?.levels} ${blend} ${mat.unlit}`) + (ceiling ? ' ceiling' : '')
    const look = looks.get(key) ?? looks.set(key, { kind, blend, unlit: mat.unlit, ceiling, textures: [], tris: [] }).get(key)!
    let layer = look.textures.indexOf(mat.texture)
    if (layer < 0 && kind !== 'none') layer = look.textures.push(mat.texture) - 1
    for (let k = 0; k < list.length; k += 3) look.tris.push(list[k]!, list[k + 1]!, list[k + 2]!, Math.max(0, layer))
  }
  // the liquids last: see-through, lava and fel lit by themselves
  for (const [kind, list] of liquids) {
    const tris: number[] = []
    for (let k = 0; k < list.length; k += 3) tris.push(list[k]!, list[k + 1]!, list[k + 2]!, 0)
    looks.set(`liquid ${kind}`, { kind: 'none', blend: 2, unlit: kind === LAVA || kind === FEL, ceiling: false, textures: [], tris, liquid: kind })
  }
  // only the points still used, each with the layer of its texture (a point is in one room, so of one material)
  const remap = new Int32Array(pos.length / 3).fill(-1), used: number[] = [], layers: number[] = [], index: number[] = [], draws: Draw[] = []
  for (const look of looks.values()) {
    if (!look.tris.length) continue
    const start = index.length
    for (let k = 0; k < look.tris.length; k += 4) {
      for (let j = 0; j < 3; j++) {
        let v = look.tris[k + j]!
        if (remap[v]! < 0 || layers[remap[v]!] !== look.tris[k + 3]) {
          // a point of two layers (a seam of two textures) is made twice
          remap[v] = used.length
          used.push(v)
          layers.push(look.tris[k + 3]!)
        }
        v = remap[v]!
        index.push(v)
      }
    }
    draws.push({ start, count: index.length - start, kind: look.kind, textures: look.textures, blend: look.blend, unlit: look.unlit, ...(look.ceiling ? { ceiling: true } : {}), ...(look.liquid ? { liquid: look.liquid } : {}) })
  }
  if (!index.length) return null
  const n = used.length, p = new Float32Array(n * 3), q = new Float32Array(n * 2), r = new Float32Array(n * 3)
  let radius = 0
  used.forEach((v, i) => {
    p.set(pos.slice(v * 3, v * 3 + 3), i * 3)
    q.set(uv.slice(v * 2, v * 2 + 2), i * 2)
    r.set(normal.slice(v * 3, v * 3 + 3), i * 3)
    radius = Math.max(radius, Math.hypot(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!))
  })
  // the main floor: the height most of the floors under a roof are at (the median), or the lowest point where it has none
  floors.sort((a, b) => a - b)
  const floor = floors.length ? floors[Math.floor(floors.length / 2)]! : Math.min(...used.map((v) => pos[v * 3 + 1]!))
  const out: BuildingHead = { vertices: n, indices: index.length, radius: Math.ceil(radius), floor: Number(floor.toFixed(1)), draws }
  const json = Buffer.from(JSON.stringify(out)), pad = (b: Buffer): Buffer => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)])
  const indices = n < 65536 ? new Uint16Array(index) : new Uint32Array(index)
  const body = Buffer.concat([Buffer.from(new Uint32Array([json.length]).buffer), pad(json), Buffer.from(p.buffer), Buffer.from(q.buffer), Buffer.from(r.buffer), pad(Buffer.from(new Uint8Array(layers))), Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength)])
  return { head: out, body }
}

/** A texture of the game for the view: what it is, and its bytes as kept (see the head of this file); null if none. */
export function makeTexture(f: Buffer): { texture: Texture; bytes: Buffer; png: boolean } | null {
  if (f.toString('latin1', 0, 4) !== 'BLP2') return null
  const kind = f[8] === 2 ? ({ 0: f[9] ? 'dxt1a' : 'dxt1', 1: 'dxt3', 7: 'dxt5' } as Record<number, TexKind>)[f[10]!] : undefined
  if (kind) {
    const parts: Buffer[] = []
    let width = 0, height = 0
    for (let m = 0, w = f.readUInt32LE(12), h = f.readUInt32LE(16); m < 16 && f.readUInt32LE(84 + m * 4); m++, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) {
      if (w > TEX || h > TEX) continue
      if (!parts.length) ((width = w), (height = h))
      const at = f.readUInt32LE(20 + m * 4), size = f.readUInt32LE(84 + m * 4)
      if (at + size > f.length) break
      parts.push(Buffer.from(new Uint32Array([w, h, size]).buffer), f.subarray(at, at + size))
    }
    // a picture whose levels are all wider than TEX goes as a PNG, as one stored some other way
    if (parts.length) return { texture: { kind, width, height, levels: parts.length / 2 }, bytes: Buffer.concat([Buffer.from(new Uint32Array([parts.length / 2]).buffer), ...parts]), png: false }
  }
  let { width, height, rgba } = decodeBlpCutout(f)
  // halved while wider than TEX: the mean of each 2 x 2
  while (width > TEX || height > TEX) {
    const w = Math.max(1, width >> 1), h = Math.max(1, height >> 1), half = new Uint8Array(w * h * 4)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        for (let c = 0; c < 4; c++) {
          const at = (yy: number, xx: number): number => rgba[(Math.min(yy, height - 1) * width + Math.min(xx, width - 1)) * 4 + c]!
          half[(y * w + x) * 4 + c] = (at(2 * y, 2 * x) + at(2 * y, 2 * x + 1) + at(2 * y + 1, 2 * x) + at(2 * y + 1, 2 * x + 1)) >> 2
        }
    ;((width = w), (height = h), (rgba = half))
  }
  return { texture: { kind: 'png', width, height, levels: 1 }, bytes: encodePng(rgba, width, height, 4), png: true }
}

/**
 * The textures of the folder dir (buildings/tex), each made once from the game's and kept, also for the M2 models
 * (props.ts): what a texture is, by its number, or null when there is none. read: a game file by number.
 */
export function textureKeeper(dir: string, read: (id: number) => Buffer | null): (id: number) => Texture | null {
  const textures = new Map<number, Texture | null>()
  return (id) => {
    if (!textures.has(id)) {
      let made: Texture | null = null
      const info = join(dir, 'tex', `${id}.json`)
      if (existsSync(info)) made = JSON.parse(readFileSync(info, 'utf8')) as Texture
      else {
        const f = read(id), t = f && makeTexture(f)
        if (t) {
          keep(join(dir, 'tex', `${id}.${t.png ? 'png' : 'bin'}`), () => (t.png ? t.bytes : deflateSync(t.bytes)))
          keep(info, () => Buffer.from(JSON.stringify(t.texture)))
          made = t.texture
        }
      }
      textures.set(id, made)
    }
    return textures.get(id)!
  }
}

/** How a building inside the ground is told: its file and where it stands, to the yard (u east and v south, as interiors.ts and caves.json have it). */
export const buriedKey = (file: number, u: number, v: number): string => `${file} ${Math.round(u)} ${Math.round(v)}`

// The format the buildings of a folder were made in; 0 for none.
function formatOf(folder: string): number {
  try {
    return (JSON.parse(readFileSync(join(folder, BUILDINGS_FOLDER, 'format.json'), 'utf8')) as { format?: number }).format ?? 0
  } catch {
    return 0
  }
}

/** Whether the buildings of these continents are all made, in this format. */
export function buildingsMade(folder: string, worlds: string[]): boolean {
  return formatOf(folder) === FORMAT && worlds.every((w) => existsSync(join(folder, w, PLACED_FILE)))
}

/**
 * Makes the buildings of the continents given, in the folder of the build: each file and texture once, kept as it is
 * made (an interrupted run resumes), each continent's list last. read: a game file by number, null when there is none
 * or the server has not sent its key. buried: of each continent, the buildings inside the ground (caves.json) by
 * buriedKey: the view cuts them at a height (buildings3d.ts). dungeon: a dungeon or a raid, made when it is first
 * opened in 3D (dungeons.ts): all its buildings are drawn open, without their ceilings (M23-F23). liquid: what a liquid
 * of the game's table is, water when not told. Gives what was made.
 */
export function makeBuildings(
  worlds: { name: string; wdt: Buffer; buried?: Set<string>; dungeon?: boolean }[],
  read: (id: number) => Buffer | null,
  folder: string,
  liquid?: (type: number) => number,
  onProgress?: (done: number, total: number) => void,
): { files: number; placed: number; converted: boolean } {
  const dir = join(folder, BUILDINGS_FOLDER), formatFile = join(dir, 'format.json')
  const lists = worlds.map((w) => join(folder, w.name, PLACED_FILE))
  if (formatOf(folder) !== FORMAT) {
    rmSync(dir, { recursive: true, force: true })
    for (const l of lists) rmSync(l, { force: true })
    mkdirSync(dir, { recursive: true })
    writeFileSync(formatFile, JSON.stringify({ format: FORMAT }))
  }
  const texture = textureKeeper(dir, read)
  // each standing building with the name of its file, and whether it is inside the ground
  const all = worlds.map((w) => standing(w.wdt, read).map((p) => ({ ...p, name: String(p.file), buried: w.dungeon ? DUNGEON : w.buried?.has(buriedKey(p.file, p.x, p.z)) ? 1 : 0 })))
  const files = [...new Set(all.flat().map((p) => p.name))]
  // each file's radius, or 0 for one with nothing to draw
  const radius = new Map<string, number>()
  let made = 0
  files.forEach((name, i) => {
    onProgress?.(i, files.length)
    const out = join(dir, `${name}.bin`), none = join(dir, `${name}.none`)
    if (existsSync(none)) return void radius.set(name, 0)
    if (existsSync(out)) {
      radius.set(name, (JSON.parse(readFileSync(out + '.json', 'utf8')) as { radius: number }).radius)
      return
    }
    const f = read(parseInt(name)), b = f && makeBuilding(f, read, texture, liquid)
    if (!b) return void keep(none, () => Buffer.alloc(0))
    // the radius beside it first, so a building kept is never without one
    writeFileSync(out + '.json', JSON.stringify({ radius: b.head.radius }))
    keep(out, () => deflateSync(b.body))
    radius.set(name, b.head.radius)
    made++
  })
  onProgress?.(files.length, files.length)
  let placed = 0
  worlds.forEach((w, k) => {
    const list = all[k]!.filter((p) => radius.get(p.name))
    const round = (v: number, digits: number): number => Number(v.toFixed(digits))
    const out: Placed = {
      format: FORMAT,
      placed: list.map((p) => [p.name, round(p.x, 2), round(p.y, 2), round(p.z, 2), round(p.turn, 5), round(p.scale, 4), p.buried]),
      radius: Object.fromEntries([...new Set(list.map((p) => p.name))].map((f) => [f, radius.get(f)!])),
    }
    mkdirSync(join(folder, w.name), { recursive: true })
    writeFileSync(lists[k]! + '.part', JSON.stringify(out))
    renameSync(lists[k]! + '.part', lists[k]!)
    placed += list.length
  })
  return { files: made, placed, converted: true }
}
