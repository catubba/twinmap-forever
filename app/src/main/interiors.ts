// The insides of buildings (dungeons, raids, caves, houses), laid on the map from the game's own
// files. Done once per build of the game, after the tiles of the continents.
//
// What the game has (found on build 1.60.1.70862):
// - The table of its maps says, for a dungeon or a raid, which world file (.wdt) it is.
// - A world file lists the files of each block of 533.33 yards; the second of them ("obj0") holds
//   a "MODF" chunk: the buildings standing on the block, each with its file, position and turn. A
//   map that is one building and no ground has a single MODF in the world file itself.
// - A building (.wmo) says its number ("MOHD") and the box of each of its rooms ("MOGI").
// - The table of room pictures gives, for a building's number, the minimap pictures of its rooms:
//   room, piece across, piece up, file. Only rooms under a roof have one.
// - A picture is 2 pixels a yard (twice the detail of the ground), x of the building to the right
//   and y up, starting from the lowest corner of the room's box; a room over 128 yards is cut in
//   pieces of 256 pixels. Every picture is DXT1 blocks with one bit of transparency.
//
// What is kept, in the folder of the build:
//   rooms/<file>.dxt   a picture's DXT1 blocks as the game has them, deflated
//   i<map>/...         the ground of a dungeon or raid that has one, as tiles.ts keeps a continent
//   interiors.json     for each map its pieces (which picture, where, how large, how turned, how
//                      high) and the names of its bosses, as the game's table of encounters has them
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { dxt1Picture } from '../shared/blp'
import type { Table } from '../shared/wdc5'
import { BLOCK_YARDS, BLOCKS, minimapTiles, WORLDS } from '../shared/world'
import { EncryptedFileError } from './client-files'
import { convertWorld, keep } from './tiles'

/** The file numbers of the three tables in the game's archive. They have parts the game keeps encrypted: read around them. */
export const MAP_FILE = 1349477
export const ROOM_PICTURES_FILE = 1323241
export const ENCOUNTERS_FILE = 1347279
export const INTERIORS_FILE = 'interiors.json'
const FORMAT = 2 // 1 had no bosses

// Which column is what, found by reading the real tables.
const NAME = 1, KIND = 8, WORLD_FILE = 21
const ROOM = 0, ACROSS = 1, UP = 2, PICTURE = 3
const BOSS = 0, BOSS_MAP = 2, DIFFICULTY = 3, ORDER = 4
const KINDS: Record<number, 'dungeon' | 'raid'> = { 1: 'dungeon', 2: 'raid' }

const PIXELS_PER_YARD = 2
const PIECE_YARDS = 128 // what a piece of a large room covers

// The table numbers the rooms as a building had them when its pictures were made. One building has
// lost rooms since: its pictures would land on the wrong rooms. Seen in the files alone: of the 62
// rooms of one picture, 34 have a picture of the size their box asks as numbered, 62 as renumbered.
const RENUMBERED: Record<number, (room: number) => number | undefined> = {
  21107: (room) => (room >= 39 ? room - 7 : room >= 32 ? undefined : room), // Stratholme: seven rooms gone
}

export interface MapEntry { id: number; name: string; kind: 'world' | 'dungeon' | 'raid'; worldFile: number; bosses: string[] }
export interface RoomPicture { room: number; across: number; up: number; file: number }
/** A building standing in a map. u, v: yards from the top left of the square of 64 x 64 blocks (u east, v south). */
export interface Placed { file: number; u: number; v: number; height: number; turn: number; scale: number }
export interface Building { number: number; rooms: { min: number[]; max: number[] }[] }

/** A picture of a room, laid on the map. */
export interface Piece {
  /** The picture: rooms/<file>.dxt. */
  file: number
  /** Its middle, in yards from the top left of the map's square (u east, v south). */
  u: number
  v: number
  /** Its size in yards; the picture has twice as many pixels. */
  width: number
  height: number
  /** Its turn in radians, anticlockwise. */
  angle: number
  /** How high the room's floor and ceiling are, in yards: lower rooms are drawn first. */
  bottom: number
  top: number
}

export interface InteriorMap {
  id: number
  name: string
  kind: 'world' | 'dungeon' | 'raid'
  /** The folder of the tiles of its ground, or null for a map that is all rooms. */
  ground: string | null
  /** The names of its bosses, in the game's order. */
  bosses: string[]
  pieces: Piece[]
}

export interface Interiors {
  format: number
  maps: InteriorMap[]
  /** Pieces the table lists that could not be laid: no such room, outside the room, no picture. */
  dropped: number
}

/** The continents, dungeons and raids of the game's table of maps, each with the bosses the table of encounters gives it. */
export function mapEntries(maps: Table, encounters: Table): MapEntry[] {
  // A map may list its bosses again for other ways of playing it (leftovers of other versions of
  // the game among them): where the plain way has any, only those count.
  const fights = new Map<number, { name: string; plain: boolean }[]>()
  for (const row of [...encounters.rows].sort((a, b) => a.int(ORDER) - b.int(ORDER) || a.id - b.id)) {
    const list = fights.get(row.int(BOSS_MAP)) ?? []
    list.push({ name: row.text(BOSS), plain: row.int(DIFFICULTY) <= 1 })
    fights.set(row.int(BOSS_MAP), list)
  }
  const out: MapEntry[] = []
  for (const row of maps.rows) {
    const world = WORLDS.some((w) => w.continent === row.id), kind = world ? 'world' : KINDS[row.int(KIND)]
    if (!kind) continue
    const all = world ? [] : (fights.get(row.id) ?? []), plain = all.filter((f) => f.plain)
    out.push({ id: row.id, name: row.text(NAME), kind, worldFile: row.int(WORLD_FILE), bosses: [...new Set((plain.length ? plain : all).map((f) => f.name))] })
  }
  return out
}

/** The pictures of the rooms of every building: building number -> its pictures. */
export function roomPictures(table: Table): Map<number, RoomPicture[]> {
  const all = new Map<number, RoomPicture[]>()
  for (const r of table.rows) {
    if (r.parent === undefined) continue
    const list = all.get(r.parent) ?? []
    list.push({ room: r.int(ROOM), across: r.int(ACROSS), up: r.int(UP) & 255, file: r.int(PICTURE) }) // the high byte of "up" is always 1
    all.set(r.parent, list)
  }
  return all
}

// A game file is a run of chunks: a four letter tag written backwards, a size, the data.
function* chunks(b: Buffer): Generator<{ tag: string; data: Buffer }> {
  for (let at = 0; at + 8 <= b.length; ) {
    const size = b.readUInt32LE(at + 4)
    yield { tag: b.toString('latin1', at, at + 4), data: b.subarray(at + 8, at + 8 + size) }
    at += 8 + size
  }
}

/** The buildings standing in a map, from its world file. read: a game file by number. */
export function placedIn(wdt: Buffer, read: (id: number) => Buffer | null): Placed[] {
  const placed = new Map<number, Placed>() // by the number the game gives each standing building: one may lie on several blocks
  const buildings = (d: Buffer, whole: boolean): void => {
    for (let at = 0; at + 64 <= d.length; at += 64) {
      if (!(d.readUInt16LE(at + 56) & 8)) continue // named, not numbered: not seen in this game
      // A map that is one building has it at the middle of the square, not where its entry says (0, 0).
      const middle = whole ? (BLOCKS / 2) * BLOCK_YARDS : 0
      placed.set(d.readUInt32LE(at + 4), {
        file: d.readUInt32LE(at),
        u: d.readFloatLE(at + 8) + middle,
        height: d.readFloatLE(at + 12),
        v: d.readFloatLE(at + 16) + middle,
        turn: d.readFloatLE(at + 24),
        scale: d.readUInt16LE(at + 62) / 1024 || 1,
      })
    }
  }
  for (const c of chunks(wdt)) {
    if (c.tag === 'FDOM') buildings(c.data, true)
    if (c.tag !== 'DIAM') continue
    for (let block = 0; block < BLOCKS * BLOCKS; block++) {
      const objects = c.data.readUInt32LE(block * 32 + 4)
      const file = objects ? read(objects) : null
      if (file) for (const o of chunks(file)) if (o.tag === 'FDOM') buildings(o.data, false)
    }
  }
  return [...placed.values()]
}

/** A building's number and the boxes of its rooms, or null for a file that is not a building. */
export function buildingOf(file: Buffer): Building | null {
  let head: Buffer | undefined, boxes: Buffer | undefined
  for (const c of chunks(file)) {
    if (c.tag === 'DHOM') head = c.data
    if (c.tag === 'IGOM') boxes = c.data
  }
  if (!head || !boxes) return null
  const rooms = Array.from({ length: Math.floor(boxes.length / 32) }, (_, i) => {
    const f = (k: number): number => boxes.readFloatLE(i * 32 + 4 + k * 4)
    return { min: [f(0), f(1), f(2)], max: [f(3), f(4), f(5)] }
  })
  return { number: head.readUInt32LE(32), rooms }
}

/**
 * Lays the pictures of a building's rooms on the map. sizeOf: the pixels of a picture, or null when
 * there is none. Gives the pieces and how many pictures could not be laid.
 */
export function layOut(p: Placed, b: Building, pictures: RoomPicture[], sizeOf: (file: number) => [number, number] | null): { pieces: Piece[]; dropped: number } {
  // The building's x and y turned into the map: x of the world is north, y is west.
  const turn = ((p.turn - 180) * Math.PI) / 180, cos = Math.cos(turn), sin = Math.sin(turn)
  let angle = ((p.turn - 90) * Math.PI) / 180
  while (angle > Math.PI) angle -= 2 * Math.PI
  const round = (n: number, digits: number): number => Number(n.toFixed(digits))
  const pieces: Piece[] = []
  let dropped = 0
  for (const pic of pictures) {
    const number = RENUMBERED[b.number] ? RENUMBERED[b.number]!(pic.room) : pic.room
    const room = number === undefined ? undefined : b.rooms[number]
    const x = room ? room.min[0]! + pic.across * PIECE_YARDS : 0, y = room ? room.min[1]! + pic.up * PIECE_YARDS : 0
    // A piece that starts past its room's box is of some other room: the table is behind the building.
    const size = room && x < room.max[0]! && y < room.max[1]! ? sizeOf(pic.file) : null
    if (!room || !size) {
      dropped++
      continue
    }
    const width = size[0] / PIXELS_PER_YARD, height = size[1] / PIXELS_PER_YARD
    const mx = x + width / 2, my = y + height / 2 // the middle of the picture, in the building
    const north = (mx * cos - my * sin) * p.scale, west = (mx * sin + my * cos) * p.scale
    pieces.push({
      file: pic.file,
      u: round(p.u - west, 2),
      v: round(p.v - north, 2),
      width: width * p.scale,
      height: height * p.scale,
      angle: round(angle, 4),
      bottom: round(room.min[2]! * p.scale + p.height, 1),
      top: round(room.max[2]! * p.scale + p.height, 1),
    })
  }
  return { pieces, dropped }
}

/** What a finished folder holds, or null when the interiors are not converted, or in an older layout. */
export function finishedInteriors(folder: string): Interiors | null {
  const file = join(folder, INTERIORS_FILE)
  if (!existsSync(file)) return null
  const interiors = JSON.parse(readFileSync(file, 'utf8')) as Interiors
  return interiors.format === FORMAT ? interiors : null
}

/**
 * Converts the insides of every map given. read: a game file by number. folder: of the build.
 * Pictures already there are kept, so an interrupted run resumes; the list is written last.
 */
export function convertInteriors(
  maps: MapEntry[],
  pictures: Map<number, RoomPicture[]>,
  read: (id: number) => Buffer | null,
  folder: string,
  onProgress?: (done: number, total: number) => void,
): Interiors {
  // A file the game keeps encrypted is a file the map does without.
  const get = (id: number): Buffer | null => {
    try {
      return read(id)
    } catch (e) {
      if (e instanceof EncryptedFileError) return null
      throw e
    }
  }
  const buildings = new Map<number, Building | null>()
  const building = (file: number): Building | null => {
    if (!buildings.has(file)) {
      const b = get(file)
      buildings.set(file, b && buildingOf(b))
    }
    return buildings.get(file)!
  }
  const sizes = new Map<number, [number, number] | null>()
  const stored = (file: number): [number, number] | null => {
    if (!sizes.has(file)) {
      const b = get(file), dxt = b && dxt1Picture(b)
      // ponytail: a picture stored some other way is left out (none is, of 5,512). Keep it as a PNG if one ever is.
      if (dxt) keep(join(folder, 'rooms', `${file}.dxt`), () => deflateSync(dxt.data, { level: 9 }))
      sizes.set(file, dxt ? [dxt.width, dxt.height] : null)
    }
    return sizes.get(file)!
  }

  const out: Interiors = { format: FORMAT, maps: [], dropped: 0 }
  maps.forEach((map, i) => {
    onProgress?.(i, maps.length)
    const wdt = get(map.worldFile)
    if (!wdt) return
    // A continent's ground is already there, under its own name.
    let ground: string | null = WORLDS.find((w) => w.continent === map.id && map.kind === 'world')?.name ?? null
    if (map.kind !== 'world' && minimapTiles(wdt).size) {
      ground = `i${map.id}`
      convertWorld(wdt, get, join(folder, ground))
    }
    const pieces: Piece[] = []
    for (const p of placedIn(wdt, get)) {
      const b = building(p.file), list = b && pictures.get(b.number)
      if (!b || !list) continue
      const laid = layOut(p, b, list, stored)
      pieces.push(...laid.pieces)
      out.dropped += laid.dropped
    }
    if (pieces.length || ground) out.maps.push({ id: map.id, name: map.name, kind: map.kind, ground, bosses: map.bosses, pieces: pieces.sort((a, b) => a.bottom - b.bottom) })
  })
  onProgress?.(maps.length, maps.length)
  // Under another name first: the list is either whole or not there.
  const file = join(folder, INTERIORS_FILE)
  mkdirSync(folder, { recursive: true })
  writeFileSync(file + '.part', JSON.stringify(out))
  renameSync(file + '.part', file)
  return out
}
