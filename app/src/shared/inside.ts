// The insides of buildings as the window draws them: the list the converter leaves in
// interiors.json (main/interiors.ts) and what is worked out from it. No file is read here.
//
// Places are in the map's own yards: u east and v south from the top left of the square of
// 64 x 64 blocks, the same for a continent and for a dungeon.
import type { Instance } from './game'
import { UNITS_PER_BLOCK } from './geo'
import { BLOCK_YARDS, BLOCKS } from './world'

/** Yards in a unit of the map the window draws (a pixel of zoom 0). */
export const YARDS_PER_UNIT = BLOCK_YARDS / UNITS_PER_BLOCK
/** A room's picture has this many pixels a yard: its own detail is at zoom 8 of the map. */
export const ROOM_PIXELS_PER_YARD = 2
const MIDDLE = (BLOCKS / 2) * BLOCK_YARDS

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

export interface Yards { u: number; v: number }
/** u1, v1, u2, v2. */
export type Box = [number, number, number, number]

/** Where the character is inside an instance, or undefined when the game does not tell. The game counts x to the north and y to the west from the middle of the square. */
export function yardsInside(inst: Instance): Yards | undefined {
  return inst.x === undefined || inst.y === undefined ? undefined : { u: MIDDLE - inst.y, v: MIDDLE - inst.x }
}

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
