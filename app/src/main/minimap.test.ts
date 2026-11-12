import { expect, test } from 'vitest'
import type { Piece } from '../shared/inside'
import type { Box, Mosaic } from '../shared/minimap'
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

// Two levels of a dungeon: the lower one, and the same with a room laid over its middle.
function twoLevels(): Mosaic[] {
  const width = 600, height = 600
  const blocks = (seed: number): Float32Array => {
    const grey = new Float32Array(width * height), kept = new Map<string, number>()
    const next = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${Math.floor(x / 9)}:${Math.floor(y / 9)}`
        if (!kept.has(key)) kept.set(key, next() < 0.33 ? 0 : 40 + next() * 200)
        grey[y * width + x] = kept.get(key)!
      }
    }
    return grey
  }
  const lower = blocks(7), over = blocks(99), upper = lower.slice()
  for (let y = 200; y < 400; y++) for (let x = 200; x < 400; x++) upper[y * width + x] = over[y * width + x]!
  return [lower, upper].map((grey) => ({ u0: 1000, v0: 2000, width, height, grey }))
}
// The minimap as the screen shows it with the character at (u, v) on a level: 300 yards on 238 pixels.
function shown(m: Mosaic, u: number, v: number): Box {
  const size = 238, rgb = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mu = Math.floor(u - m.u0 - 150 + ((x + 0.5) * 300) / size), mv = Math.floor(v - m.v0 - 150 + ((y + 0.5) * 300) / size)
      rgb.fill(mu >= 0 && mv >= 0 && mu < m.width && mv < m.height ? m.grey[mv * m.width + mu]! : 0, (y * size + x) * 3, (y * size + x) * 3 + 3)
    }
  }
  return { size, rgb }
}

test('in a dungeon with rooms over rooms the minimap tells the level the character is on', () => {
  const levels = twoLevels(), inside = startInside(() => 'anywhere', () => levels)
  const pos = { inst: { id: 36, kind: 'party', mini: { x: 2408, y: 187, size: 238, zoom: 0 } } }
  let now = 3000
  const look = (level: number, u: number, v: number): ReturnType<typeof inside.look> => inside.look(pos, () => shown(levels[level]!, u, v), (now += 600))
  // Under the upper room, then up on it, at the same place of the map.
  // The first look through the whole dungeon is on the picture with every room, which is not what shows down here: the next one finds it.
  expect(look(0, 1300, 2300)).toBeNull()
  now += 2000
  expect(look(0, 1300, 2300)).toMatchObject({ level: 0 })
  expect(look(0, 1302, 2300)).toMatchObject({ level: 0 })
  expect(look(1, 1302, 2301)).toMatchObject({ level: 1 })
  expect(Math.abs(look(1, 1304, 2301)!.u - 1304)).toBeLessThanOrEqual(1.5)
  expect(look(0, 1304, 2302)).toMatchObject({ level: 0 })
})

test('a dungeon with one level tells none', () => {
  const [only] = twoLevels(), inside = startInside(() => 'anywhere', () => [only!])
  const pos = { inst: { id: 36, kind: 'party', mini: { x: 2408, y: 187, size: 238, zoom: 0 } } }
  const found = inside.look(pos, () => shown(only!, 1300, 2300), 3000)!
  expect(found.level).toBeUndefined()
  expect(Math.abs(found.u - 1300)).toBeLessThanOrEqual(1.5)
})

test('why the arrow is not there is told: no minimap, a zoom not known, nothing like enough', () => {
  const levels = twoLevels(), inside = startInside(() => 'anywhere', () => levels)
  const mini = { x: 2408, y: 187, size: 238, zoom: 0 }
  inside.look({ inst: { id: 36, kind: 'party' } }, () => null, 3000)
  expect(inside.report()!.report).toMatchObject({ dungeon: 36, why: 'no minimap told' })
  inside.look({ inst: { id: 36, kind: 'party', mini: { ...mini, turns: true } } }, () => null, 4000)
  expect(inside.report()!.report.why).toBe('minimap turns')
  inside.look({ inst: { id: 36, kind: 'party', mini: { ...mini, zoom: 7 } } }, () => null, 5000)
  expect(inside.report()!.report).toMatchObject({ why: 'zoom not known', zoom: 7 })
  // A square of the screen that is no minimap of this dungeon: every level tried, none sure.
  const noise = { size: 238, rgb: Uint8Array.from({ length: 238 * 238 * 3 }, (_, i) => (Math.floor(i / 3) * 37) % 256) }
  expect(inside.look({ inst: { id: 36, kind: 'party', mini } }, () => noise, 9000)).toBeNull()
  const said = inside.report()!
  expect(said.report).toMatchObject({ why: 'not sure', levels: 2, zoom: 0, size: 238 })
  expect(said.report.scores).toHaveLength(2)
  expect(said.seen).toBe(noise)
  // Found: no reason, the level and how sure. Outside again: nothing to tell.
  inside.look({ inst: { id: 36, kind: 'party', mini } }, () => shown(levels[1]!, 1300, 2300), 12000)
  expect(inside.report()!.report).toMatchObject({ level: 1, lostFor: 0 })
  expect(inside.report()!.report.why).toBeUndefined()
  inside.look({ zone: 'Elwynn Forest' }, () => null, 13000)
  expect(inside.report()).toBeNull()
})
