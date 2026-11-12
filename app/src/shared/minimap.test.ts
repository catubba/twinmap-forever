import { expect, test } from 'vitest'
import { facingOf, levelsOf, locate, readsMinimap, SURE, type Box, type Mosaic } from './minimap'

// Rooms that are nowhere alike: a grey value for every yard, from a fixed recipe.
function rooms(width: number, height: number): Mosaic {
  const grey = new Float32Array(width * height)
  let seed = 7
  const next = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  // Blocks of 9 yards, each its own grey, a third of them empty: as rooms and the dark between them.
  const blocks = new Map<string, number>()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${Math.floor(x / 9)}:${Math.floor(y / 9)}`
      if (!blocks.has(key)) blocks.set(key, next() < 0.33 ? 0 : 40 + next() * 200)
      grey[y * width + x] = blocks.get(key)!
    }
  }
  return { u0: 1000, v0: 2000, width, height, grey }
}

// The minimap as the screen would show it with the character at (u, v): 300 yards on `size` pixels.
function shown(m: Mosaic, u: number, v: number, size: number): Box {
  const rgb = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mu = Math.floor(u - m.u0 - 150 + ((x + 0.5) * 300) / size), mv = Math.floor(v - m.v0 - 150 + ((y + 0.5) * 300) / size)
      const g = mu >= 0 && mv >= 0 && mu < m.width && mv < m.height ? m.grey[mv * m.width + mu]! : 0
      rgb.fill(g, (y * size + x) * 3, (y * size + x) * 3 + 3)
    }
  }
  return { size, rgb }
}

test('the picture of the minimap is found among the rooms, to the yard', () => {
  const mosaic = rooms(700, 640), levels = levelsOf(mosaic)
  // Anywhere in the dungeon, with nothing known before.
  const first = locate(levels, shown(mosaic, 1320, 2290, 238), 0)!
  expect(first.score).toBeGreaterThan(0.9)
  expect(Math.abs(first.u - 1320)).toBeLessThanOrEqual(1.5)
  expect(Math.abs(first.v - 2290)).toBeLessThanOrEqual(1.5)
  // A few yards on, looked for around the last place only.
  const next = locate(levels, shown(mosaic, 1326, 2287, 238), 0, first)!
  expect(next.score).toBeGreaterThan(0.9)
  expect(Math.abs(next.u - 1326)).toBeLessThanOrEqual(1.5)
  expect(Math.abs(next.v - 2287)).toBeLessThanOrEqual(1.5)
})

test('a picture that is not of these rooms is not a place', () => {
  const levels = levelsOf(rooms(700, 640))
  const other = shown(rooms(900, 900), 1700, 2700, 238) // the same recipe further on: other rooms
  const found = locate(levels, other, 0)
  expect(found === null || found.score < SURE).toBe(true)
  expect(locate(levels, other, 9)).toBeNull() // a zoom the minimap has not
})

test('the arrow in the middle of the minimap says which way the character faces', () => {
  // A light arrow on a brown floor: its eye (dark blue) at the back, its point at the front.
  const arrow = (degrees: number): Box => {
    const size = 238, rgb = new Uint8Array(size * size * 3)
    for (let i = 0; i < size * size; i++) rgb.set([120, 90, 60], i * 3)
    const turn = (degrees * Math.PI) / 180, fx = Math.sin(turn), fy = -Math.cos(turn)
    for (let y = -14; y <= 14; y++) {
      for (let x = -14; x <= 14; x++) {
        const along = x * fx + y * fy, across = -x * fy + y * fx, i = ((119 + y) * size + 119 + x) * 3
        // From 6 pixels behind the middle to 10 ahead, narrowing to the point.
        if (along >= -6 && along <= 10 && Math.abs(across) <= (10 - along) / 4 + 0.5) rgb.set([225, 222, 215], i)
        if (Math.hypot(along + 4, across) <= 1.6) rgb.set([35, 40, 130], i)
      }
    }
    return { size, rgb }
  }
  for (const degrees of [0, 45, 90, 200, 315]) {
    const read = facingOf(arrow(degrees))!
    expect(Math.abs(((read - degrees + 540) % 360) - 180), `facing ${degrees}`).toBeLessThan(8)
  }
  // No arrow in the middle: nothing is said.
  expect(facingOf({ size: 238, rgb: new Uint8Array(238 * 238 * 3).fill(90) })).toBeNull()
})

test('the minimap is read inside dungeons and raids only', () => {
  const mini = { x: 2408, y: 187, size: 238, zoom: 0 }
  expect(readsMinimap({ inst: { kind: 'party', mini } })).toEqual(mini)
  expect(readsMinimap({ inst: { kind: 'raid', mini } })).toEqual(mini)
  // In the open world, in a city, under a roof: the addon names no instance, and nothing is read.
  expect(readsMinimap(undefined)).toBeNull()
  expect(readsMinimap({})).toBeNull()
  // A battleground, where the game tells the place; an instance with no word of the minimap.
  expect(readsMinimap({ inst: { kind: 'pvp', mini } })).toBeNull()
  expect(readsMinimap({ inst: { kind: 'party' } })).toBeNull()
  // A minimap that turns, a zoom not known, numbers that are not a place on a window.
  expect(readsMinimap({ inst: { kind: 'party', mini: { ...mini, turns: true } } })).toBeNull()
  expect(readsMinimap({ inst: { kind: 'party', mini: { ...mini, zoom: 7 } } })).toBeNull()
  expect(readsMinimap({ inst: { kind: 'party', mini: { ...mini, x: NaN } } })).toBeNull()
  expect(readsMinimap({ inst: { kind: 'party', mini: { ...mini, size: 5000 } } })).toBeNull()
})

// A game stretched to fill a wider monitor: the square of the minimap is bigger on screen, each pixel a blend of its neighbours.
function stretchedBox(box: Box, size: number): Box {
  const rgb = new Uint8Array(size * size * 3), at = (x: number, y: number): number => box.rgb[(y * box.size + x) * 3]!
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = Math.max(0, Math.min(box.size - 1, ((x + 0.5) * box.size) / size - 0.5)), v = Math.max(0, Math.min(box.size - 1, ((y + 0.5) * box.size) / size - 0.5))
      const a = Math.floor(u), b = Math.floor(v), a1 = Math.min(box.size - 1, a + 1), b1 = Math.min(box.size - 1, b + 1), s = u - a, t = v - b
      const g = at(a, b) * (1 - s) * (1 - t) + at(a1, b) * s * (1 - t) + at(a, b1) * (1 - s) * t + at(a1, b1) * s * t
      rgb.fill(Math.round(g), (y * size + x) * 3, (y * size + x) * 3 + 3)
    }
  }
  return { size, rgb }
}

test('the minimap of a game at 1920 stretched over 2560 pixels is found as well', () => {
  const mosaic = rooms(700, 640), levels = levelsOf(mosaic)
  const found = locate(levels, stretchedBox(shown(mosaic, 1320, 2290, 238), Math.round((238 * 2560) / 1920)), 0)!
  expect(found.score).toBeGreaterThan(SURE)
  expect(Math.abs(found.u - 1320)).toBeLessThanOrEqual(1.5)
  expect(Math.abs(found.v - 2290)).toBeLessThanOrEqual(1.5)
})
