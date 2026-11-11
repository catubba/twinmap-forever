// Where the character is inside a dungeon or a raid, where the game tells addons nothing: the
// picture of the minimap on the screen is looked for among the pictures of the rooms the app
// already has. Used inside instances only; in the open world the game gives the place itself.
//
// Tried on a recorded run of 42 minutes in The Hall of Thanes (design/minimap, 11 November 2026):
// at the widest zoom the minimap shows 300 yards, and its picture is found in the rooms with a
// likeness of 0.92 out of 1; outside the dungeon the likeness stays under 0.6.

/** A square cut from the screen: the minimap and nothing around it. Three bytes a pixel, rows from the top. */
export interface Box {
  size: number
  rgb: Uint8Array
}

/** The rooms of a map on one picture, one pixel a yard, grey; 0 where there is nothing. u0, v0: the yards of its top left corner. */
export interface Mosaic {
  u0: number
  v0: number
  width: number
  height: number
  grey: Float32Array
}

/**
 * How many yards the minimap shows across at each of its zooms, under a roof.
 */
// ponytail: only the first is measured (300, in The Hall of Thanes); the rest are the figures known
// for the game's minimap indoors. Measure each with a recorded run before trusting it.
export const INDOOR_YARDS = [300, 240, 180, 120, 80, 50]

const KEEP = 0.8 // of the radius: the rim has buttons over it
const ARROW = 0.1 // of the radius, around the middle: the arrow of the character and the dots of the party
export const SURE = 0.75 // a likeness under this is not a place: the arrow goes, it does not guess
const STEPS = [6, 2, 1] // yards a pixel, from the look at the whole dungeon to the last yard
const NEAR = 12 // yards around the last place where the next is looked for: more than a second of running

const grey = (rgb: Uint8Array, i: number): number => rgb[i]! * 0.299 + rgb[i + 1]! * 0.587 + rgb[i + 2]! * 0.114

/** A picture at fewer pixels: each the mean of a square of `step`. */
function shrunk(from: { width: number; height: number; grey: Float32Array }, step: number): { width: number; height: number; grey: Float32Array } {
  if (step === 1) return from
  const width = Math.floor(from.width / step), height = Math.floor(from.height / step), out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) sum += from.grey[(y * step + dy) * from.width + x * step + dx]!
      out[y * width + x] = sum / (step * step)
    }
  }
  return { width, height, grey: out }
}

/** The rooms at each of the steps, made once for a dungeon. */
export interface Levels {
  mosaic: Mosaic
  at: { step: number; width: number; height: number; grey: Float32Array }[]
}
export const levelsOf = (mosaic: Mosaic): Levels => ({ mosaic, at: STEPS.map((step) => ({ step, ...shrunk(mosaic, step) })) })

/** The round middle of the minimap at `step` yards a pixel: where each pixel that counts is, and how far its grey is from their mean. */
interface Template {
  size: number
  dx: Int32Array
  dy: Int32Array
  value: Float32Array
  /** The sum of the squares of `value`. */
  power: number
}

function templateOf(box: Box, across: number, step: number, thin: number): Template {
  const size = Math.round(across / step), per = box.size / size
  const dx: number[] = [], dy: number[] = [], value: number[] = []
  let sum = 0
  for (let y = 0; y < size; y += thin) {
    for (let x = 0; x < size; x += thin) {
      const far = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      if (far >= KEEP || far <= ARROW) continue
      // The mean of the pixels of the screen under this one.
      const x0 = Math.floor(x * per), x1 = Math.max(x0 + 1, Math.floor((x + 1) * per)), y0 = Math.floor(y * per), y1 = Math.max(y0 + 1, Math.floor((y + 1) * per))
      let g = 0
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) g += grey(box.rgb, (sy * box.size + sx) * 3)
      g /= (x1 - x0) * (y1 - y0)
      dx.push(x)
      dy.push(y)
      value.push(g)
      sum += g
    }
  }
  const mean = sum / value.length
  let power = 0
  for (let i = 0; i < value.length; i++) {
    value[i]! -= mean
    power += value[i]! * value[i]!
  }
  return { size, dx: Int32Array.from(dx), dy: Int32Array.from(dy), value: Float32Array.from(value), power }
}

/** How alike the template and the rooms are with the template's corner on (x, y): 1 the same picture, 0 nothing in common. */
function likeness(level: { width: number; height: number; grey: Float32Array }, t: Template, x: number, y: number): number {
  let cross = 0, sum = 0, squares = 0
  const n = t.value.length, g = level.grey, w = level.width
  for (let i = 0; i < n; i++) {
    const v = g[(y + t.dy[i]!) * w + x + t.dx[i]!]!
    cross += v * t.value[i]!
    sum += v
    squares += v * v
  }
  const spread = squares - (sum * sum) / n
  return spread <= 1e-6 || t.power <= 1e-6 ? 0 : cross / Math.sqrt(spread * t.power)
}

/** The best corner for the template in a rectangle of corners, both ends counted. */
function best(level: { width: number; height: number; grey: Float32Array }, t: Template, x0: number, y0: number, x1: number, y1: number): { x: number; y: number; score: number } {
  let found = { x: -1, y: -1, score: -1 }
  for (let y = Math.max(0, y0); y <= Math.min(level.height - t.size, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(level.width - t.size, x1); x++) {
      const score = likeness(level, t, x, y)
      if (score > found.score) found = { x, y, score }
    }
  }
  return found
}

/** A place in a dungeon, in the yards of its pieces (inside.ts), and how sure it is: the likeness, 0 to 1. */
export interface Found {
  u: number
  v: number
  score: number
}

/**
 * Where the middle of the minimap is among the rooms. zoom: the minimap's own (0 the widest).
 * near: the place found a moment ago, to look only around it; without it the whole dungeon is
 * looked through, which costs a hundred times more. Null when the zoom is not known.
 */
export function locate(levels: Levels, box: Box, zoom: number, near?: { u: number; v: number }): Found | null {
  const across = INDOOR_YARDS[zoom]
  if (!across || box.size < 32) return null
  const { u0, v0 } = levels.mosaic
  let at: { x: number; y: number; score: number } | null = null, yards = 0
  for (const level of levels.at) {
    const first = at === null
    if (first && near && level.step === STEPS[0]) continue // the last place is a better start than the coarse look
    // One pixel in four of the template is enough: eleven thousand of them still tell a room from the next.
    const t = templateOf(box, across, level.step, level.step === STEPS[0] ? 1 : 2)
    let x: number, y: number, reach: number
    if (at) {
      // Around the place found at the step before, by as much as that step could be wrong.
      x = Math.round((at.x * yards) / level.step)
      y = Math.round((at.y * yards) / level.step)
      reach = Math.ceil(yards / level.step) + 1
    } else if (near) {
      x = Math.round((near.u - u0 - across / 2) / level.step)
      y = Math.round((near.v - v0 - across / 2) / level.step)
      reach = Math.ceil(NEAR / level.step)
    } else {
      x = y = 0
      reach = Infinity
    }
    at = reach === Infinity ? best(level, t, 0, 0, level.width, level.height) : best(level, t, x - reach, y - reach, x + reach, y + reach)
    yards = level.step
    if (at.x < 0) return null
  }
  if (!at) return null
  return { u: u0 + at.x + across / 2, v: v0 + at.y + across / 2, score: at.score }
}

/**
 * Which way the character faces, in degrees clockwise from north, read from the arrow in the
 * middle of the minimap; null when no arrow is seen there. The arrow turns around the middle of
 * its picture: its eye (a dark blue dot in a light ring) is at the back, its point at the front.
 * The line of its light pixels gives the angle, the eye says which end is the back.
 */
export function facingOf(box: Box): number | null {
  // Measured on a minimap of 238 pixels: the arrow fits in 13 pixels around the middle, its eye in 9.
  const scale = box.size / 238, reach = Math.round(13 * scale), middle = box.size / 2
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, eyes = 0, ex = 0, ey = 0
  for (let py = Math.floor(middle) - reach; py <= Math.floor(middle) + reach; py++) {
    for (let px = Math.floor(middle) - reach; px <= Math.floor(middle) + reach; px++) {
      if (px < 0 || py < 0 || px >= box.size || py >= box.size) continue
      const x = px + 0.5 - middle, y = py + 0.5 - middle, far = Math.hypot(x, y)
      if (far > reach) continue
      const i = (py * box.size + px) * 3, r = box.rgb[i]!, g = box.rgb[i + 1]!, b = box.rgb[i + 2]!
      const most = Math.max(r, g, b), least = Math.min(r, g, b)
      if (most > 150 && most - least < 38) {
        n++
        sx += x
        sy += y
        sxx += x * x
        syy += y * y
        sxy += x * y
      }
      if (b > r + 40 && b > g + 30 && b < 190 && far <= 9 * scale) {
        eyes++
        ex += x
        ey += y
      }
    }
  }
  if (n < 12 * scale * scale || eyes < 3) return null
  // The long way of the light pixels: the direction in which they are spread the most.
  const cxx = sxx / n - (sx / n) ** 2, cyy = syy / n - (sy / n) ** 2, cxy = sxy / n - (sx / n) * (sy / n)
  const turn = Math.atan2(2 * cxy, cxx - cyy) / 2
  let ax = Math.cos(turn), ay = Math.sin(turn)
  if (ax * (ex / eyes) + ay * (ey / eyes) > 0) [ax, ay] = [-ax, -ay] // the point is away from the eye
  return ((Math.atan2(ax, -ay) * 180) / Math.PI + 360) % 360
}

/** Where the minimap is on the game's window, as the addon tells it: the pixels of its middle from the top left, and its width. */
export interface MinimapPlace {
  x: number
  y: number
  size: number
  /** The minimap's own zoom, 0 the widest. */
  zoom: number
  /** True when the minimap turns with the character: its picture cannot be looked for as it is. */
  turns?: boolean
}

/**
 * Whether the minimap is to be read at all: only inside a dungeon or a raid, only when the addon
 * says where it is, and not while it turns with the character. Everywhere else the screen is left alone.
 */
export function readsMinimap(pos: { inst?: { kind?: string; mini?: MinimapPlace } } | undefined): MinimapPlace | null {
  const inst = pos?.inst, mini = inst?.mini
  if (!inst || !mini || (inst.kind !== 'party' && inst.kind !== 'raid')) return null
  if (mini.turns || !(mini.size >= 32 && mini.size <= 1024) || !Number.isFinite(mini.x) || !Number.isFinite(mini.y) || INDOOR_YARDS[mini.zoom] === undefined) return null
  return mini
}
