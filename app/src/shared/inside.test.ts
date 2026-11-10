import { expect, test } from 'vitest'
import { boxOf, buildingsAt, inPiece, piecesIn, roomPixels, yardsInside, YARDS_PER_UNIT, type Piece } from './inside'

const piece = (over: Partial<Piece>): Piece => ({ file: 1, u: 100, v: 100, width: 32, height: 16, angle: 0, bottom: 0, top: 5, building: 0, level: 0, ...over })

test('a unit of the map is a 256th of the square of 64 blocks', () => {
  expect(YARDS_PER_UNIT * 256).toBeCloseTo((64 * 1600) / 3, 6)
})

test('a place inside an instance is counted from the middle of the square: north is up, west is left', () => {
  const middle = (32 * 1600) / 3
  expect(yardsInside({ id: 36, x: 0, y: 0 })).toEqual({ u: middle, v: middle })
  // The entrance of the Deadmines: 16 yards south and 383 east of the middle.
  expect(yardsInside({ id: 36, x: -16, y: -383 })).toEqual({ u: middle + 383, v: middle + 16 })
  expect(yardsInside({ id: 36 })).toBeUndefined()
})

test('a place of the map falls on the picture of a piece, turned as the piece is', () => {
  // Not turned: the picture's top left is 16 yards west and 8 north of its middle.
  expect(inPiece(piece({}), 84, 92)).toEqual([0, 0])
  expect(inPiece(piece({}), 110, 104)).toEqual([26, 12])
  expect(inPiece(piece({}), 117, 100)).toBeNull()
  // Turned a quarter anticlockwise the picture stands 16 wide and 32 tall, and its top left is at the bottom left.
  const turned = piece({ angle: Math.PI / 2 })
  expect(inPiece(turned, 100, 117)).toBeNull()
  expect(inPiece(turned, 107, 100)).not.toBeNull()
  expect(inPiece(turned, 100, 115)!.map(Math.round)).toEqual([1, 8])
  expect(inPiece(piece({}), 100, 115)).toBeNull()
})

test('the pieces of a part of the map, up to a level', () => {
  const pieces = [piece({ file: 1 }), piece({ file: 2, u: 500 }), piece({ file: 3, level: 1 }), piece({ file: 4, level: 2 })]
  expect(piecesIn(pieces, [0, 0, 200, 200]).map((p) => p.file)).toEqual([1, 3, 4])
  expect(piecesIn(pieces, [0, 0, 200, 200], 1).map((p) => p.file)).toEqual([1, 3])
  expect(piecesIn(pieces, [0, 0, 200, 200], 0).map((p) => p.file)).toEqual([1])
  expect(piecesIn(pieces, [300, 0, 600, 200]).map((p) => p.file)).toEqual([2])
  // A piece just past the edge still counts if its corner may reach in.
  expect(piecesIn(pieces, [117, 0, 200, 200]).length).toBe(3)
})

test('the building under a place, and what holds every piece', () => {
  const pieces = [piece({ building: 3 }), piece({ building: 3, u: 130 }), piece({ building: 7, u: 400 })]
  expect([...buildingsAt(pieces, 100, 100)]).toEqual([3])
  expect([...buildingsAt(pieces, 400, 100)]).toEqual([7])
  expect(buildingsAt(pieces, 250, 100).size).toBe(0)
  const box = boxOf(pieces)!
  expect(box[0]).toBeLessThan(84)
  expect(box[2]).toBeGreaterThan(416)
  expect(boxOf([])).toBeNull()
})

test('a room picture decodes with its shape cut out', () => {
  // Two blocks side by side: the left all of one color, the right see-through but for its first pixel.
  const dxt = new Uint8Array(16)
  dxt.set([0x00, 0xf8, 0x00, 0x00, 0, 0, 0, 0], 0) // first color red and the greater: every pixel red
  dxt.set([0x00, 0x00, 0xe0, 0x07, 0xfd, 0xff, 0xff, 0xff], 8) // first color black, second green: pixel 0 the second color, the rest the fourth choice
  const rgba = roomPixels(dxt, 8, 4)
  expect([...rgba.slice(0, 4)]).toEqual([255, 0, 0, 255])
  expect([...rgba.slice(16, 20)]).toEqual([0, 255, 0, 255])
  expect([...rgba.slice(20, 24)]).toEqual([0, 0, 0, 0])
  expect(rgba.filter((_, i) => i % 4 === 3 && rgba[i] === 255).length).toBe(17)
})
