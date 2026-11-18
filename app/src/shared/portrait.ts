// The picture of each character, taken off the game's window while its character window shows the
// model (Portrait.lua says where). One a character, kept with what the character wore when it was
// taken: the same things worn, and it is not taken again; one piece changed, and it is at the next
// time the window is open. Retake asks for a new one all the same.

/** Where the model is: pixels of the game's window from its top left, and whose it is. */
export interface ModelBox {
  key: string
  x: number
  y: number
  w: number
  h: number
}

/** A picture kept: when it was taken, and what was worn then (wornKey). */
export interface Portrait {
  at: number
  gear: string
}

/** By the character's full name, as the sheets are. */
export type Portraits = Record<string, Portrait>

/** What every screen is told: the pictures kept, and the character a new one is awaited for. */
export interface PortraitsTold {
  taken: Portraits
  retake: string | null
}

const STILL = 1000 // ms the model must have stood where it is, with nothing over it

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isSize = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 8192

/** The section "model" as the strip gives it, checked; null when no model is on show. */
export function modelFrom(v: unknown): ModelBox | null {
  if (!isObject(v)) return null
  const { key, x, y, w, h } = v
  if (typeof key !== 'string' || !key || !Number.isInteger(x) || !Number.isInteger(y) || (x as number) < 0 || (y as number) < 0 || !isSize(w) || !isSize(h)) return null
  return { key, x: x as number, y: y as number, w, h }
}

/** What is worn, from the piece "gear" of a sheet: each slot with its item, enchant and suffix. How worn out it is does not count. */
export function wornKey(gear: unknown): string {
  if (!Array.isArray(gear)) return ''
  return gear
    .filter((g): g is unknown[] => Array.isArray(g) && Number.isInteger(g[0]) && Number.isInteger(g[1]))
    .map((g) => `${g[0] as number}=${typeof g[4] === 'string' ? g[4] : (g[1] as number)}`)
    .sort()
    .join(' ')
}

/** The pictures as the file gives them, checked. */
export function portraitsFrom(read: unknown): Portraits {
  const out: Portraits = {}
  if (!isObject(read)) return out
  for (const [key, p] of Object.entries(read)) if (isObject(p) && typeof p.at === 'number' && typeof p.gear === 'string') out[key] = { at: p.at, gear: p.gear }
  return out
}

/**
 * Whether a picture is to be taken now. box: the model on show; stood: milliseconds since the addon
 * last said anything else of it; gear: what the sheet says the character wears, undefined when the
 * app has no sheet of it yet; have: the picture kept; retake: the character a new one is asked for.
 */
export function pictureDue(box: ModelBox | null, stood: number, gear: string | undefined, have: Portrait | undefined, retake: string | null): boolean {
  if (!box || stood < STILL || gear === undefined) return false
  return retake === box.key || have?.gear !== gear
}
