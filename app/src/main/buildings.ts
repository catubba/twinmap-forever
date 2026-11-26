// The buildings of the continents in 3D (M23-F2; the prototype and its measures: design/ROADMAP.md, M16-F8), made from
// the game's own files once per build of the game, after the map.
//
// What the game has: a building is a file (.wmo) standing on the blocks of a continent ("MODF" of each block's "obj0",
// listed by every block it lies on). Its rooms are files of their own ("GFID": for each level of detail, a file a
// room); a room has its triangles ("MOVT", "MOVI"), texture coordinates and normals ("MOTV", "MONR"), and its runs of
// triangles of one material ("MOBA"); the building lists the materials ("MOMT": texture, blending, lit or not).
//
// What is kept: every room at full detail, outdoors and indoors (the user's choice of 26 November 2026), only the
// triangles the sky sees (skySeen), each building file once; its materials gathered by what can share a texture array
// (same kind, size, levels, blending, light), as the prototype's 31 draws for Stormwind instead of 357.
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
import type { BuildingHead, Draw, Placed, TexKind } from '../shared/buildings'
import { BLOCKS } from '../shared/world'
import { encodePng } from './png'
import { keep } from './tiles'

export const BUILDINGS_FOLDER = 'buildings'
export const PLACED_FILE = 'buildings.json'
const FORMAT = 1
/** Pixels of a texture's widest level kept. */
const TEX = 512
/** The directions the sky looks from (M16-F8): 16 round, at these heights over the horizon, in degrees. */
const AZIMUTHS = 16
const ELEVATIONS = [15, 20, 25, 30, 40, 55, 70, 85]
/** Pixels a yard of the pictures the sky takes, and their widest side. */
const SKY_DETAIL = 3
const SKY_SIDE = 4096

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

/** The buildings standing on a continent, each once, in the view's yards. wdt: its world file; read: a game file by number. */
export function standing(wdt: Buffer, read: (id: number) => Buffer | null): { file: number; x: number; y: number; z: number; turn: number; scale: number }[] {
  const maid = chunk(wdt, 'DIAM')
  const placed = new Map<number, { file: number; x: number; y: number; z: number; turn: number; scale: number }>()
  for (let block = 0; maid && block < BLOCKS * BLOCKS; block++) {
    const id = maid.readUInt32LE(block * 32 + 4), objects = id ? read(id) : null, modf = objects && chunk(objects, 'FDOM')
    for (let at = 0; modf && at + 64 <= modf.length; at += 64) {
      if (!(modf.readUInt16LE(at + 56) & 8)) continue // named, not numbered: not seen in this game (interiors.ts)
      // as interiors.ts lays a building: u east and v south of the world's corner, the turn round the up of the world
      placed.set(modf.readUInt32LE(at + 4), {
        file: modf.readUInt32LE(at),
        x: modf.readFloatLE(at + 8),
        y: modf.readFloatLE(at + 12),
        z: modf.readFloatLE(at + 16),
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
}
/** A room of a building from its file: its points turned into the view's axes (x east = -y of the file, y up = z, z south = -x). */
export function roomOf(f: Buffer): Room | null {
  const g = chunk(f, 'PGOM')
  if (!g) return null
  let verts: Float32Array | undefined, uvs: Float32Array | undefined, normals: Float32Array | undefined, tris: Uint16Array | undefined
  const batches: Room['batches'] = []
  for (const c of chunks(g, 68)) {
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
  return { pos, uv: uvs && uvs.length >= n * 2 ? uvs.subarray(0, n * 2) : new Float32Array(n * 2), normal, tris, batches }
}

/**
 * Which triangles the sky sees, one byte each: the building drawn from many directions (AZIMUTHS x ELEVATIONS) with
 * no perspective, nearest triangle at each pixel; a triangle is seen when it has a pixel, or when no pixel's centre
 * falls in it (thin, or seen aslant: the sides of window frames) and its middle is not behind what is drawn there.
 * pos: x y z a point, y up; tris: three points a triangle.
 */
export function skySeen(pos: Float32Array, tris: Uint32Array, detail = SKY_DETAIL, widest = SKY_SIDE): Uint8Array {
  const n = tris.length / 3, seen = new Uint8Array(n)
  if (!n) return seen
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i++) ((lo[i % 3] = Math.min(lo[i % 3]!, pos[i]!)), (hi[i % 3] = Math.max(hi[i % 3]!, pos[i]!)))
  const c = lo.map((l, k) => (l + hi[k]!) / 2)
  let radius = 0.5
  for (let i = 0; i < pos.length; i += 3) radius = Math.max(radius, Math.hypot(pos[i]! - c[0]!, pos[i + 1]! - c[1]!, pos[i + 2]! - c[2]!))
  const scale = Math.min(detail, (widest - 2) / (2 * radius)), side = Math.ceil(2 * radius * scale) + 2
  const depth = new Float32Array(side * side), id = new Int32Array(side * side)
  const points = pos.length / 3, sx = new Float32Array(points), sy = new Float32Array(points), sz = new Float32Array(points)
  const near = 0.25 // yards a middle may lie behind what is drawn and still count as seen
  for (const elevation of ELEVATIONS) {
    for (let a = 0; a < AZIMUTHS; a++) {
      const e = (elevation * Math.PI) / 180, az = (a / AZIMUTHS) * Math.PI * 2
      // the look, from the sky down; across and up the picture
      const d = [-Math.cos(e) * Math.sin(az), -Math.sin(e), -Math.cos(e) * Math.cos(az)], r = [Math.cos(az), 0, -Math.sin(az)]
      const u = [r[1]! * d[2]! - r[2]! * d[1]!, r[2]! * d[0]! - r[0]! * d[2]!, r[0]! * d[1]! - r[1]! * d[0]!]
      for (let i = 0; i < points; i++) {
        const x = pos[i * 3]! - c[0]!, y = pos[i * 3 + 1]! - c[1]!, z = pos[i * 3 + 2]! - c[2]!
        sx[i] = (x * r[0]! + z * r[2]! + radius) * scale + 1
        sy[i] = (x * u[0]! + y * u[1]! + z * u[2]! + radius) * scale + 1
        sz[i] = x * d[0]! + y * d[1]! + z * d[2]!
      }
      depth.fill(Infinity)
      id.fill(0)
      for (let t = 0; t < n; t++) {
        const p0 = tris[t * 3]!, p1 = tris[t * 3 + 1]!, p2 = tris[t * 3 + 2]!
        const x0 = sx[p0]!, y0 = sy[p0]!, x1 = sx[p1]!, y1 = sy[p1]!, x2 = sx[p2]!, y2 = sy[p2]!
        const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
        if (Math.abs(area) < 1e-9) continue
        const z0 = sz[p0]! / area, z1 = sz[p1]! / area, z2 = sz[p2]! / area
        const minX = Math.max(0, Math.ceil(Math.min(x0, x1, x2) - 0.5)), maxX = Math.min(side - 1, Math.floor(Math.max(x0, x1, x2) - 0.5))
        const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2) - 0.5)), maxY = Math.min(side - 1, Math.floor(Math.max(y0, y1, y2) - 0.5))
        for (let py = minY; py <= maxY; py++) {
          const cy = py + 0.5
          for (let px = minX; px <= maxX; px++) {
            const cx = px + 0.5
            // the weights of the three corners at the pixel's centre, all of the sign of the area inside
            const w0 = (x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1)
            const w1 = (x0 - x2) * (cy - y2) - (y0 - y2) * (cx - x2)
            const w2 = (x1 - x0) * (cy - y0) - (y1 - y0) * (cx - x0)
            if (area > 0 ? w0 < 0 || w1 < 0 || w2 < 0 : w0 > 0 || w1 > 0 || w2 > 0) continue
            const k = py * side + px, zz = w0 * z0 + w1 * z1 + w2 * z2
            if (zz < depth[k]!) ((depth[k] = zz), (id[k] = t + 1))
          }
        }
      }
      for (let k = 0; k < id.length; k++) if (id[k]) seen[id[k]! - 1] = 1
      for (let t = 0; t < n; t++) {
        if (seen[t]) continue
        const p0 = tris[t * 3]!, p1 = tris[t * 3 + 1]!, p2 = tris[t * 3 + 2]!
        const px = Math.floor((sx[p0]! + sx[p1]! + sx[p2]!) / 3), py = Math.floor((sy[p0]! + sy[p1]! + sy[p2]!) / 3)
        if (px >= 0 && py >= 0 && px < side && py < side && (sz[p0]! + sz[p1]! + sz[p2]!) / 3 <= depth[py * side + px]! + near) seen[t] = 1
      }
    }
  }
  return seen
}

interface Material { texture: number; blend: number; unlit: boolean }
interface Texture { kind: TexKind; width: number; height: number; levels: number }

/**
 * A building's file made from the game's: its rooms at full detail, the triangles the sky does not see left out, the
 * draws gathered by what can share a texture array. read: a game file by number; texture: what a texture is (written
 * once by makeTexture). Null for a file that is not a building or has nothing to draw.
 */
export function makeBuilding(file: Buffer, read: (id: number) => Buffer | null, texture: (id: number) => Texture | null): { head: BuildingHead; body: Buffer } | null {
  const head = chunk(file, 'DHOM'), gfid = chunk(file, 'DIFG'), momt = chunk(file, 'TMOM')
  if (!head || !gfid) return null
  const rooms = head.readUInt32LE(4)
  const materials: Material[] = []
  for (let at = 0; momt && at + 64 <= momt.length; at += 64) materials.push({ unlit: (momt.readUInt32LE(at) & 1) === 1, blend: momt.readUInt32LE(at + 8), texture: momt.readUInt32LE(at + 12) })
  // every room's points one after the other; the triangles by material
  const pos: number[] = [], uv: number[] = [], normal: number[] = [], byMaterial = new Map<number, number[]>()
  for (let i = 0; i < rooms && i * 4 < gfid.length; i++) {
    const id = gfid.readUInt32LE(i * 4), b = id ? read(id) : null, room = b && roomOf(b)
    if (!room) continue
    const first = pos.length / 3
    for (const v of room.pos) pos.push(v)
    for (const v of room.uv) uv.push(v)
    for (const v of room.normal) normal.push(v)
    for (const batch of room.batches) {
      const list = byMaterial.get(batch.material) ?? byMaterial.set(batch.material, []).get(batch.material)!
      for (let t = batch.start; t < batch.start + batch.count && t < room.tris.length; t++) list.push(first + room.tris[t]!)
    }
  }
  const all = new Uint32Array([...byMaterial.values()].flat())
  if (!all.length) return null
  const seen = skySeen(new Float32Array(pos), all)
  // the draws: materials of one look, their textures as layers
  const looks = new Map<string, { kind: TexKind; blend: number; unlit: boolean; textures: number[]; tris: number[] }>()
  let t = 0
  for (const [m, list] of byMaterial) {
    const mat = materials[m] ?? { texture: 0, blend: 0, unlit: false }, tex = mat.texture ? texture(mat.texture) : null
    const blend = mat.blend === 1 ? 1 : mat.blend >= 2 ? 2 : 0, kind: TexKind = tex?.kind ?? 'none'
    // a PNG is a draw of its own; DXT ones of one kind, size and number of levels share an array
    const key = kind === 'png' ? `png ${mat.texture} ${blend} ${mat.unlit}` : `${kind} ${tex?.width}x${tex?.height} ${tex?.levels} ${blend} ${mat.unlit}`
    const look = looks.get(key) ?? looks.set(key, { kind, blend, unlit: mat.unlit, textures: [], tris: [] }).get(key)!
    let layer = look.textures.indexOf(mat.texture)
    if (layer < 0 && kind !== 'none') layer = look.textures.push(mat.texture) - 1
    for (let k = 0; k < list.length; k += 3, t++) if (seen[t]) look.tris.push(list[k]!, list[k + 1]!, list[k + 2]!, Math.max(0, layer))
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
    draws.push({ start, count: index.length - start, kind: look.kind, textures: look.textures, blend: look.blend, unlit: look.unlit })
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
  const out: BuildingHead = { vertices: n, indices: index.length, radius: Math.ceil(radius), draws }
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
 * or the server has not sent its key. Gives what was made.
 */
export function makeBuildings(
  worlds: { name: string; wdt: Buffer }[],
  read: (id: number) => Buffer | null,
  folder: string,
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
  const textures = new Map<number, Texture | null>()
  const texture = (id: number): Texture | null => {
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
  const all = worlds.map((w) => standing(w.wdt, read))
  const files = [...new Set(all.flat().map((p) => p.file))]
  // each file's radius, or 0 for one with nothing to draw
  const radius = new Map<number, number>()
  let made = 0
  files.forEach((id, i) => {
    onProgress?.(i, files.length)
    const out = join(dir, `${id}.bin`), none = join(dir, `${id}.none`)
    if (existsSync(none)) return void radius.set(id, 0)
    if (existsSync(out)) {
      radius.set(id, (JSON.parse(readFileSync(out + '.json', 'utf8')) as { radius: number }).radius)
      return
    }
    const f = read(id), b = f && makeBuilding(f, read, texture)
    if (!b) return void keep(none, () => Buffer.alloc(0))
    // the radius beside it first, so a building kept is never without one
    writeFileSync(out + '.json', JSON.stringify({ radius: b.head.radius }))
    keep(out, () => deflateSync(b.body))
    radius.set(id, b.head.radius)
    made++
  })
  onProgress?.(files.length, files.length)
  let placed = 0
  worlds.forEach((w, k) => {
    const list = all[k]!.filter((p) => radius.get(p.file))
    const round = (v: number, digits: number): number => Number(v.toFixed(digits))
    const out: Placed = {
      format: FORMAT,
      placed: list.map((p) => [p.file, round(p.x, 2), round(p.y, 2), round(p.z, 2), round(p.turn, 5), round(p.scale, 4)]),
      radius: Object.fromEntries([...new Set(list.map((p) => p.file))].map((f) => [f, radius.get(f)!])),
    }
    mkdirSync(join(folder, w.name), { recursive: true })
    writeFileSync(lists[k]! + '.part', JSON.stringify(out))
    renameSync(lists[k]! + '.part', lists[k]!)
    placed += list.length
  })
  return { files: made, placed, converted: true }
}
