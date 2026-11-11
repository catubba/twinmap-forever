import { expect, test } from 'vitest'
import type { Piece } from '../shared/inside'
import { mosaicOfPieces, startInside } from './minimap'

test('outside dungeons and raids the screen is never read', () => {
  const inside = startInside(() => 'C:\nowhere')
  let cuts = 0
  const cut = (): null => (cuts++, null)
  const mini = { x: 2408, y: 187, size: 238, zoom: 0 }
  // The open world, a city, under a roof, a battleground, no word from the game at all.
  for (const pos of [undefined, {}, { zone: 'Elwynn Forest', map: 1429, x: 42, y: 65 }, { zone: 'Ironforge', indoors: true }, { inst: { id: 489, kind: 'pvp', mini } }]) {
    for (let now = 0; now < 10000; now += 500) expect(inside.look(pos, cut, now)).toBeNull()
  }
  expect(cuts).toBe(0)
  // Inside a dungeon whose rooms the app has not: still nothing to look for, so nothing is read.
  for (let now = 20000; now < 30000; now += 500) expect(inside.look({ inst: { id: 36, kind: 'party', mini } }, cut, now)).toBeNull()
  expect(cuts).toBe(0)
})

test('the rooms of a dungeon are laid on one picture, each where its piece says', () => {
  // One room of 8 x 4 yards (16 x 8 pixels), all of one colour, not turned.
  const dxt = new Uint8Array((16 / 4) * (8 / 4) * 8)
  for (let block = 0; block < 8; block++) dxt.set([0xff, 0xff, 0x00, 0x00, 0, 0, 0, 0], block * 8) // white, every pixel the first colour
  const piece: Piece = { file: 1, u: 500, v: 300, width: 8, height: 4, angle: 0, bottom: 0, top: 5, building: 0, level: 0 }
  const mosaic = mosaicOfPieces([piece], () => dxt)!
  const at = (u: number, v: number): number => mosaic.grey[(v - mosaic.v0) * mosaic.width + (u - mosaic.u0)]!
  expect(at(500, 300)).toBeCloseTo(255, 0)
  expect(at(497, 299)).toBeCloseTo(255, 0)
  expect(at(505, 300)).toBe(0) // past its wall
  expect(at(500, 303)).toBe(0)
  expect(mosaicOfPieces([], () => dxt)).toBeNull()
})
