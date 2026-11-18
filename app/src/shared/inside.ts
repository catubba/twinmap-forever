// The insides of buildings as the window draws them: the list the converter leaves in
// interiors.json (main/interiors.ts) and what is worked out from it. No file is read here.
//
// Places are in the map's own yards: u east and v south from the top left of the square of
// 64 x 64 blocks, the same for a continent and for a dungeon.
import { ENCOUNTER_NAMES } from './encounter-names'
import type { Instance } from './game'
import { UNITS_PER_BLOCK } from './geo'
import { BLOCK_YARDS, BLOCKS } from './world'

/** Yards in a unit of the map the window draws (a pixel of zoom 0). */
export const YARDS_PER_UNIT = BLOCK_YARDS / UNITS_PER_BLOCK
/** A room's picture has this many pixels a yard: its own detail is at zoom 8 of the map. */
export const ROOM_PIXELS_PER_YARD = 2
/** Yards from a corner of the square to its middle, where the game counts from. */
export const MIDDLE_YARDS = (BLOCKS / 2) * BLOCK_YARDS
const MIDDLE = MIDDLE_YARDS

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
  /** Which of the buildings standing in the map it is a room of, counted from 0. */
  building: number
  /** How many rooms lie under it, one over the other: 0 for a room with nothing below. Only in dungeons and raids. */
  level: number
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

/** A boss's name as two sources may write it: the letters only, small. */
export const nameOfBoss = (name: string): string => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// The game tells a kill with the name of the fight, and a skull carries the name of the creature, the one
// over its head. Where the two differ: the fight, then the creatures it is the kill of. From the game's table
// of encounters against the names of the pins (design/interiors/names-fdj.ts).
const FIGHTS: Record<string, string[]> = {
  Infurnus: ['Magmatus'], // The Hall of Thanes
  Kirtonos: ['Kirtonos the Herald'], // Scholomance
  'Ras Frostwhisperer': ['Ras Frostwhisper'],
  Sneed: ["Sneed's Shredder"], // The Deadmines: one fight, the shredder first and Sneed out of it
  'The Butcher': ['The Baron'], // Ruins of Lordaeron
  Geilhast: ['Gelihast'], // Blackfathom Deeps: the game spells the fight so
  'The Lost Dwarves': ['Baelog', 'Eric "The Swift"', 'Olaf'], // Uldaman
  'The Seven': ["Doom'rel"], // Blackrock Depths
  "Jammal'an and Ogom": ["Jammal'an the Prophet", 'Ogom the Wretched'], // The Temple of Atal'Hakkar
  'Morphaz and Hazzas': ['Morphaz', 'Hazzas'],
}
// The bosses on the pins that are not there in every run, as AnoUI's dungeon maps mark them (rare: true);
// all but Lordaeron Captain, a boss of Forever, are rare spawns in the classic game as well.
export const RARE_BOSSES = new Set(['Miner Johnson', 'Ragglesnout', 'Pyromancer Loregrain', 'Skul', 'Stonespine', 'Hearthsinger Forresten', 'Lordaeron Captain'].map(nameOfBoss))

const KILL_OF = new Map(Object.entries(FIGHTS).map(([fight, creatures]) => [nameOfBoss(fight), creatures.map(nameOfBoss)]))

/**
 * The bosses killed in the instance of this map, from the "kills" section as it came off the strip:
 * their names in small letters, as nameOfBoss gives them, and with a fight the creatures it is the
 * kill of. The names come in the game's language, the numbers of the fights in every language the
 * same: a number gives the English name of the pins. None from anything else, or of another map.
 */
export function killedIn(section: unknown, map: number | undefined): Set<string> {
  const told = (typeof section === 'object' && section ? section : {}) as { map?: unknown; list?: unknown; ids?: unknown }
  if (map === undefined || told.map !== map || !Array.isArray(told.list)) return new Set()
  const byNumber = (Array.isArray(told.ids) ? told.ids : []).map((id) => (typeof id === 'number' ? ENCOUNTER_NAMES[id] : undefined))
  const names = [...told.list, ...byNumber].filter((name): name is string => typeof name === 'string').map(nameOfBoss)
  return new Set(names.flatMap((name) => [name, ...(KILL_OF.get(name) ?? [])]))
}

export interface Yards { u: number; v: number }
/** u1, v1, u2, v2. */
export type Box = [number, number, number, number]

/** Where the character is inside an instance, or undefined when the game does not tell. The game counts x to the north and y to the west from the middle of the square. */
export function yardsInside(inst: Instance): Yards | undefined {
  return inst.x === undefined || inst.y === undefined ? undefined : { u: MIDDLE - inst.y, v: MIDDLE - inst.x }
}

/** The other way: a place in the yards of the pieces as the game would tell it, x to the north and y to the west. */
export const worldOfYards = (at: Yards): { x: number; y: number } => ({ x: MIDDLE - at.v, y: MIDDLE - at.u })

// How far a piece reaches from its middle, however it is turned.
const reach = (p: Piece): number => Math.hypot(p.width, p.height) / 2

/** The pieces that may show inside a box of the map, lowest first as the list has them. upTo: leave out the rooms more than this many levels up. */
export function piecesIn(pieces: Piece[], [u1, v1, u2, v2]: Box, upTo = Infinity): Piece[] {
  return pieces.filter((p) => p.level <= upTo && p.u + reach(p) > u1 && p.u - reach(p) < u2 && p.v + reach(p) > v1 && p.v - reach(p) < v2)
}

/** From a place of the map to a place of a piece's picture, in yards from its top left; null outside the picture. */
export function inPiece(p: Piece, u: number, v: number): [number, number] | null {
  const cos = Math.cos(p.angle), sin = Math.sin(p.angle), du = u - p.u, dv = v - p.v
  const x = du * cos - dv * sin + p.width / 2, y = du * sin + dv * cos + p.height / 2
  return x < 0 || y < 0 || x >= p.width || y >= p.height ? null : [x, y]
}

/** The buildings with a room's picture over a place: where the character is when under a roof. */
export function buildingsAt(pieces: Piece[], u: number, v: number): Set<number> {
  const found = new Set<number>()
  for (const p of pieces) if (!found.has(p.building) && inPiece(p, u, v)) found.add(p.building)
  return found
}

/**
 * The buildings that lie under the ground: caves, mines, tunnels. One counts when the rooms whose
 * ceiling is under the terrain over their middle make at least half of its floor. A house stands on
 * the ground and has none; a mine dug into a hill has nearly all, less the rooms at its mouth, where
 * the terrain falls away. groundAt: the height of the terrain over a place, null where there is none.
 */
export function buriedBuildings(pieces: Piece[], groundAt: (u: number, v: number) => number | null): number[] {
  const floors = new Map<number, { all: number; under: number }>()
  for (const p of pieces) {
    const ground = groundAt(p.u, p.v)
    if (ground === null) continue
    const floor = floors.get(p.building) ?? { all: 0, under: 0 }
    floor.all += p.width * p.height
    if (p.top < ground - 1) floor.under += p.width * p.height
    floors.set(p.building, floor)
  }
  return [...floors].filter(([, f]) => f.under >= f.all / 2).map(([building]) => building).sort((a, b) => a - b)
}

/** A room inside the ground, for the 3D view: its place in the list of the continent's pieces, the height of its floor, the yards of ground over it. */
export type UnderRoom = [index: number, floor: number, roof: number]

// The places of a piece asked about: a grid over it, a point every few yards.
function* over(p: Piece, step: number): Generator<[number, number]> {
  const cos = Math.cos(p.angle), sin = Math.sin(p.angle)
  for (let i = -p.width / 2 + step / 2; i < p.width / 2; i += step) for (let j = -p.height / 2 + step / 2; j < p.height / 2; j += step) yield [p.u + i * cos + j * sin, p.v - i * sin + j * cos]
}

/**
 * The floors of the rooms of one building. A piece comes with the bottom of its box, which is the
 * bottom of the pit where it has one (the chasm of Ironforge: up to 136 yards under where one
 * walks). The walking grid knows where one stands: the floor is the height most stood at. The
 * pieces with one same box are the pictures of one hall, cut in squares: one floor for them all,
 * or a wall would run through the hall where two of them come out apart. A hall the grid tells
 * nothing of is as far over the bottom of its box as the halls of its building are, the middle one
 * of them; at its bottom in a building the grid knows nothing of (a dungeon behind its door).
 * heightsAt: every height one stands at on a place.
 */
export function floorsOf(rooms: Piece[], heightsAt: (u: number, v: number) => number[]): number[] {
  const halls = new Map<string, number[]>() // by box: the heights stood at in its pieces
  const hallOf = (p: Piece): string => `${p.bottom} ${p.top}`
  for (const p of rooms) {
    const stood = halls.get(hallOf(p)) ?? halls.set(hallOf(p), []).get(hallOf(p))!
    for (const [u, v] of over(p, 4)) for (const z of heightsAt(u, v)) if (z > p.bottom - 3 && z < p.top + 3) stood.push(z)
  }
  const middle = (list: number[]): number => list.sort((a, b) => a - b)[list.length >> 1]!
  const told = rooms.map((p) => (halls.get(hallOf(p))!.length ? middle(halls.get(hallOf(p))!) : null)),
    lifts = told.flatMap((f, i) => (f === null ? [] : [f - rooms[i]!.bottom])),
    lift = lifts.length ? middle(lifts) : 0
  return told.map((f, i) => f ?? rooms[i]!.bottom + lift)
}

/**
 * The yards of ground over a room's floor, at most; null for a room that is not inside the ground:
 * the ground is over its floor on less than a quarter of it (the mouth of a cave, a city in a
 * canyon: those are on the ground's own picture already).
 */
export function roofOf(p: Piece, floor: number, groundAt: (u: number, v: number) => number | null): number | null {
  let all = 0, under = 0, roof = 0
  for (const [u, v] of over(p, Math.max(2, Math.min(p.width, p.height) / 10))) {
    const ground = groundAt(u, v)
    all++
    if (ground === null) continue
    roof = Math.max(roof, ground - floor)
    if (ground > floor + 3) under++
  }
  return under >= all / 4 ? roof : null
}

/** What holds every piece, or null for none. */
export function boxOf(pieces: Piece[]): Box | null {
  if (!pieces.length) return null
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity]
  for (const p of pieces) {
    box[0] = Math.min(box[0], p.u - reach(p))
    box[1] = Math.min(box[1], p.v - reach(p))
    box[2] = Math.max(box[2], p.u + reach(p))
    box[3] = Math.max(box[3], p.v + reach(p))
  }
  return box
}

/**
 * The pixels of a room's picture from its DXT1 blocks: red, green, blue and whether it is solid.
 * In a block whose first color is not the greater, the fourth choice is see-through: that is how
 * the game cuts the shape of a room out of its square picture.
 */
export function roomPixels(dxt: Uint8Array, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const view = new DataView(dxt.buffer, dxt.byteOffset, dxt.byteLength), rgba = new Uint8ClampedArray(width * height * 4)
  const color = (c: number): number[] => [(((c >> 11) & 31) * 255) / 31, (((c >> 5) & 63) * 255) / 63, ((c & 31) * 255) / 31]
  for (let by = 0, p = 0; by < height; by += 4) {
    for (let bx = 0; bx < width; bx += 4, p += 8) {
      const c0 = view.getUint16(p, true), c1 = view.getUint16(p + 2, true), a = color(c0), b = color(c1), choice = view.getUint32(p + 4, true)
      const four = c0 > c1
        ? [a, b, a.map((x, i) => (2 * x + b[i]!) / 3), a.map((x, i) => (x + 2 * b[i]!) / 3)]
        : [a, b, a.map((x, i) => (x + b[i]!) / 2), null]
      for (let i = 0; i < 16; i++) {
        const c = four[(choice >>> (i * 2)) & 3]
        if (c) rgba.set([c[0]!, c[1]!, c[2]!, 255], ((by + (i >> 2)) * width + bx + (i & 3)) * 4)
      }
    }
  }
  return rgba
}
