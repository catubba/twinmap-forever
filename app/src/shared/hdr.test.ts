import { expect, test } from 'vitest'
import { autoHdr, burnt, fromHdr, timesLighter } from './hdr'

const linear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

test('a picture with a sixth of its pixels at the most is burnt, one with a hundredth is not', () => {
  const picture = (most: number): Uint8Array => {
    const rgb = new Uint8Array(600 * 3).fill(90)
    for (let i = 0; i < most; i++) rgb[i * 3 + 1] = 255
    return rgb
  }
  expect(burnt(picture(100))).toBe(true)
  expect(burnt(picture(6))).toBe(false)
  expect(burnt(new Uint8Array(0))).toBe(false)
})

// Pixels of the game's own bars, read as the game drew them (HDR on, Auto HDR off) and then off the
// screen in floating point with Auto HDR on: the same screen, the same place, 19 November 2026.
const SEEN: [number[], number[]][] = [
  [[76, 60, 57], [0.273, 0.172, 0.156]],
  [[2, 73, 26], [0.008, 0.252, 0.04]],
  [[105, 100, 101], [0.553, 0.498, 0.513]],
  [[118, 71, 29], [0.692, 0.243, 0.048]],
  [[130, 121, 108], [0.912, 0.778, 0.611]],
  [[110, 22, 136], [0.588, 0.034, 0.965]],
  [[174, 135, 57], [1.962, 1.034, 0.151]],
  [[185, 188, 203], [2.818, 2.986, 3.641]],
  [[209, 170, 82], [3.865, 2.068, 0.299]],
  [[242, 193, 135], [7.109, 3.25, 1.207]],
  [[255, 235, 255], [11.273, 8.078, 10.789]],
]

test('what the screen showed with Auto HDR on comes back as the game drew it', () => {
  for (const [drawn, shown] of SEEN) {
    const back = fromHdr(Float32Array.from(shown), 3)
    // Windows also makes the colours stronger, which is not taken off: a strong colour is up to some fifteen levels out.
    for (let c = 0; c < 3; c++) expect(Math.abs(back[c]! - drawn[c]!), `${drawn.join(' ')} came back ${back.join(' ')}`).toBeLessThanOrEqual(16)
  }
})

test('a pixel made lighter by the same figures comes back the same, whatever Windows tells for plain white', () => {
  for (const white of [1, 2.5, 3, 6]) {
    for (const drawn of [[0, 0, 0], [10, 20, 30], [128, 128, 128], [200, 40, 90], [255, 255, 255], [250, 250, 0]]) {
      const lit = drawn.map((v) => linear(v / 255)), light = lit[0]! * 0.2126 + lit[1]! * 0.7152 + lit[2]! * 0.0722
      const back = fromHdr(Float32Array.from(lit.map((v) => v * timesLighter(light, white))), white)
      for (let c = 0; c < 3; c++) expect(Math.abs(back[c]! - drawn[c]!)).toBeLessThanOrEqual(1)
    }
  }
})

test('Auto HDR is told from a game that drew itself on a screen in HDR', () => {
  const seen = new Uint8Array(300), drawn = new Float32Array(300)
  for (let i = 0; i < 300; i++) drawn[i] = linear((seen[i] = 30 + (i % 200)) / 255)
  // With Auto HDR on the reading at 8 bits is the light of the screen itself; without, the screen is as much lighter as plain white is.
  expect(autoHdr(drawn, seen, 3)).toBe(true)
  expect(autoHdr(drawn.map((v) => v * 3), seen, 3)).toBe(false)
  // Too few pixels the reading at 8 bits did not cut: not told.
  expect(autoHdr(drawn.subarray(0, 12), new Uint8Array(12).fill(255), 3)).toBe(false)
  // Plain white at the standard's own light: only light past it tells.
  expect(autoHdr(Float32Array.from([4, 4, 4]), Uint8Array.from([255, 255, 255]), 1)).toBe(true)
  expect(autoHdr(Float32Array.from([1, 1, 1]), Uint8Array.from([255, 255, 255]), 1)).toBe(false)
})

test('more light than white, less than none and no number at all give white and black', () => {
  expect([...fromHdr(Float32Array.from([40, 40, 40, -1, -1, -1, NaN, 1, 1, 0, 0, 0]), 3)]).toEqual([255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0])
})
