import { expect, test } from 'vitest'
import { coloursAt, lightAt, nightAt, NOON, sunAt, type LightFacts } from './light'

// A map with its own light (grey at midnight, white at noon) and, near (100, 0), a red one fading from 10 to 30 yards.
const FACTS: LightFacts = {
  format: 1,
  lights: [
    [0, 0, 0, 0, 0, 1],
    [0, 100, 0, 10, 30, 2],
  ],
  days: {
    1: [
      [0, 0x404040, 0x202020, 0x000000],
      [1440, 0xffffff, 0x808080, 0x8080ff],
    ],
    2: [
      [0, 0xff0000, 0xff0000, 0xff0000],
      [1440, 0xff0000, 0xff0000, 0xff0000],
    ],
  },
}

test('between two times of the day, a straight line; after the last, back towards the first', () => {
  const at6 = coloursAt(FACTS, 0, 1000, 1000, 6 * 60)!
  expect(at6[0][0]).toBeCloseTo((0x40 + (0xff - 0x40) / 2) / 255)
  expect(coloursAt(FACTS, 0, 1000, 1000, 18 * 60)![0][0]).toBeCloseTo(at6[0][0])
  expect(coloursAt(FACTS, 0, 1000, 1000, 24 * 60)![0][0]).toBeCloseTo(0x40 / 255)
})

test("a light near its place lies over the map's, all of it inside where it starts to fade", () => {
  expect(coloursAt(FACTS, 0, 105, 0, NOON)![0]).toEqual([1, 0, 0])
  const half = coloursAt(FACTS, 0, 120, 0, NOON)![0]
  expect(half[0]).toBeCloseTo(1)
  expect(half[1]).toBeCloseTo(0.5)
  expect(coloursAt(FACTS, 0, 140, 0, NOON)![0]).toEqual([1, 1, 1])
})

test('the light of an hour is told against noon: 1 at noon, a map with no light of its own has none', () => {
  expect(lightAt(FACTS, 0, 1000, 1000, NOON)).toEqual({ light: [1, 1, 1], fog: [1, 1, 1] })
  // level ground at midnight: ambient and direct together, against noon's
  expect(lightAt(FACTS, 0, 1000, 1000, 0)!.light[0]).toBeCloseTo((0x20 + 0x40 * Math.SQRT1_2) / (0x80 + 0xff * Math.SQRT1_2))
  expect(lightAt(FACTS, 0, 1000, 1000, 0)!.fog[2]).toBe(0)
  expect(lightAt(FACTS, 5, 0, 0, NOON)).toBeNull()
})

test('the sun rises in the north-east, is in the north-west halfway and highest, sets in the south-west; the moon at night', () => {
  const [ex, , ez] = sunAt(5 * 60)
  expect(ex).toBeGreaterThan(0)
  expect(ez).toBeLessThan(0)
  const [mx, my, mz] = sunAt(13 * 60)
  expect(mx).toBeCloseTo(-Math.SQRT1_2 * Math.cos(Math.PI / 4))
  expect(mz).toBeCloseTo(-Math.SQRT1_2 * Math.cos(Math.PI / 4))
  expect(my).toBeCloseTo(Math.SQRT1_2)
  const [wx, , wz] = sunAt(20.9 * 60)
  expect(wx).toBeLessThan(0)
  expect(wz).toBeGreaterThan(0)
  expect(sunAt(1 * 60)[1]).toBeCloseTo(Math.sin((35 * Math.PI) / 180))
})

test('the windows are lit at night, coming on after 21:00 and off by 5:00', () => {
  expect(nightAt(NOON)).toBe(0)
  expect(nightAt(21 * 60 + 15)).toBeCloseTo(0.5)
  expect(nightAt(0)).toBe(1)
  expect(nightAt(4 * 60 + 45)).toBeCloseTo(0.5)
  expect(nightAt(5 * 60 + 1)).toBe(0)
})
