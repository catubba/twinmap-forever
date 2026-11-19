// A picture of the game on a screen in HDR. With Auto HDR on, Windows shows the game much lighter
// than the game drew it, and more so the lighter a thing is. Read off the screen at 8 bits (as
// capture.ts does) everything above a middle grey comes out white: the picture is burnt, and what
// was cut is not to be had back. Read in floating point (main/hdr-reader.ts) nothing is cut, and
// this file takes the light Windows added off again.
//
// ponytail: how much lighter is measured on one screen only (19 November 2026, design/hdr: plain
// white told by Windows as 3 times the standard's 80 nits, the game's white shown at about 1000
// nits). It is taken to grow with what Windows tells for plain white. On a screen where Auto HDR
// goes about it otherwise the picture comes out lighter or darker than the game, never burnt:
// measure there with design/hdr/float.cjs before changing these figures.

const BURNT = 0.05 // of the pixels, a channel at its most: 0.7% on a model read as the game drew it, 17% with Auto HDR on

/** Whether a picture read at 8 bits (three bytes a pixel) lost its lights: too many of its pixels are at the most a channel holds. */
export function burnt(rgb: Uint8Array): boolean {
  let most = 0
  for (let i = 0; i < rgb.length; i += 3) if (rgb[i] === 255 || rgb[i + 1] === 255 || rgb[i + 2] === 255) most++
  return most > (rgb.length / 3) * BURNT
}

// How many times lighter the screen showed a grey than the game drew it, by the level (0 to 255)
// the game drew: the same up to FIRST, then each STEP levels, and at white.
const FIRST = 72, STEP = 8
const TIMES = [3.79, 3.83, 3.86, 3.9, 3.95, 4.0, 4.08, 4.19, 4.32, 4.43, 4.64, 4.86, 5.13, 5.43, 5.81, 6.11, 6.44, 6.85, 7.45, 8.17, 8.96, 10.04, 11.34]
const AT_WHITE = 12.6
const MEASURED_AT = 3 // what Windows told for plain white on the screen these were measured on

const LIGHT = [0.2126, 0.7152, 0.0722] as const // how much of the light of a pixel each channel carries
const linear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const level = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)

/** How many times lighter the screen shows a pixel the game drew this light (0 to 1, linear). white: what Windows tells for plain white, in times the standard's 80 nits. */
export function timesLighter(light: number, white: number): number {
  const at = (level(Math.min(1, Math.max(0, light))) * 255 - FIRST) / STEP, last = TIMES.length - 1
  let times: number
  if (at <= 0) times = TIMES[0]!
  else if (at >= last) times = TIMES[last]! + ((AT_WHITE - TIMES[last]!) * Math.min(1, (at - last) / ((255 - FIRST) / STEP - last)))
  else times = TIMES[Math.floor(at)]! + (TIMES[Math.floor(at) + 1]! - TIMES[Math.floor(at)]!) * (at - Math.floor(at))
  return (times * white) / MEASURED_AT
}

/**
 * Whether the light of the screen is the game made lighter by Auto HDR, and not the game as it drew
 * itself on a screen in HDR, where the reading at 8 bits is right and a pixel at its most is a
 * white thing. seen: the same rectangle read at 8 bits a moment before. With Auto HDR on that
 * reading is the light of the screen itself, cut at 1; without, the screen is `white` times lighter
 * than it. Told by the pixels the reading at 8 bits did not cut.
 */
export function autoHdr(screen: Float32Array, seen: Uint8Array, white: number): boolean {
  if (white < 1.2) {
    // Plain white is no lighter than the reading at 8 bits holds: only light well past it tells.
    for (let p = 0; p < screen.length; p += 3) if (screen[p]! * LIGHT[0] + screen[p + 1]! * LIGHT[1] + screen[p + 2]! * LIGHT[2] > white * 1.2) return true
    return false
  }
  const times: number[] = []
  for (let i = 0; i < seen.length && i < screen.length; i++) if (seen[i]! >= 40 && seen[i]! <= 215) times.push(screen[i]! / linear(seen[i]! / 255))
  if (times.length < 30) return false
  return times.sort((a, b) => a - b)[times.length >> 1]! < Math.sqrt(white)
}

const GRID = 1024

/**
 * The picture as the game drew it, three bytes a pixel, from the light of the screen: three
 * numbers a pixel, linear, 1 for the standard's 80 nits. Each pixel is made as much darker as a
 * pixel of its light was made lighter; its colour stays.
 */
export function fromHdr(screen: Float32Array, white: number): Uint8Array {
  // The light of the screen for each light of the game, which grows with it: looked up backwards.
  const shown = new Float64Array(GRID + 1)
  for (let i = 0; i <= GRID; i++) shown[i] = (i / GRID) * timesLighter(i / GRID, white)
  const out = new Uint8Array(screen.length)
  for (let p = 0; p < screen.length; p += 3) {
    const light = screen[p]! * LIGHT[0] + screen[p + 1]! * LIGHT[1] + screen[p + 2]! * LIGHT[2]
    if (!(light > 0)) continue // nothing there, or no number: black
    let lo = 0, hi = GRID
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (shown[mid]! <= light) lo = mid
      else hi = mid
    }
    const drawn = light >= shown[GRID]! ? 1 : (lo + (light - shown[lo]!) / (shown[hi]! - shown[lo]!)) / GRID
    for (let c = 0; c < 3; c++) out[p + c] = Math.round(level(Math.min(1, Math.max(0, (screen[p + c]! * drawn) / light))) * 255)
  }
  return out
}
