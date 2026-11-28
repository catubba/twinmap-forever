// The light of the game's day, from its own tables, for the 3D view (M23-F10). Light.db2 says where each light is and how
// far it reaches: the one with no reach is the whole map's, the others lie over it near their place. LightData.db2 gives each
// light's colours at a dozen times of the day; between two, a straight line. Read in the window's worker once for each build.
//
// The view keeps its light of today at noon and makes every other hour from it: the colour of the hour divided by the
// colour of noon, channel by channel (design/daynight, decided in M23-F9). The sun's path is not in the game's tables (the
// game keeps it in its program): it is ours.
import { readTable, type Table } from './wdc5'

/** In the folder of the build. */
export const LIGHT_FILE = 'light.json'
/** A file of another format was made by another app: made again. */
export const LIGHT_FORMAT = 1

const LIGHT = 1375579, LIGHT_DATA = 1375580
/** The tables count the day in half minutes. */
const DAY = 2880

/** A light: its map, where it is (yards, x to the north, y to the west), where it starts to fade and where it is gone, its colours (a key of days). */
export type Light = [map: number, x: number, y: number, start: number, end: number, day: number]
/** A time of the day in half minutes, and the colours then: direct light, ambient light, the fog of the sky (0xRRGGBB). */
export type Key = [time: number, direct: number, ambient: number, fog: number]

export interface LightFacts {
  format: number
  lights: Light[]
  days: Record<number, Key[]>
}

interface Files {
  read(id: number, skipHidden?: boolean): Buffer | null
  opens(keyName: string): boolean
}

/** The lights of every map and their days in clear weather, or null when the build has not the tables. */
export function lightFacts(files: Files): LightFacts | null {
  const table = (id: number): Table | null => {
    const b = files.read(id, true)
    return b && readTable(b, (keyName) => files.opens(keyName))
  }
  const lights = table(LIGHT), data = table(LIGHT_DATA)
  if (!lights || !data) return null
  // Light: 0 where (x, y, z), 1 where it starts to fade, 2 where it is gone, 3 the map, 4 its parameters by weather (the first: clear)
  const all: Light[] = lights.rows.map((r) => [r.int(3), round(r.float(0, 0)), round(r.float(0, 1)), round(r.float(1)), round(r.float(2)), r.int(4, 0)])
  const wanted = new Set(all.map((l) => l[5]))
  // LightData: 1 the parameters, 2 the time (its low 16 bits), 3 direct, 4 ambient, 10 the fog of the sky
  const days: Record<number, Key[]> = {}
  for (const r of data.rows) {
    const p = r.int(1)
    if (wanted.has(p)) (days[p] ??= []).push([r.int(2) & 0xffff, r.int(3) >>> 0, r.int(4) >>> 0, r.int(10) >>> 0])
  }
  for (const d of Object.values(days)) d.sort((a, b) => a[0] - b[0])
  return { format: LIGHT_FORMAT, lights: all.filter((l) => days[l[5]]), days }
}
const round = (n: number): number => Math.round(n * 10) / 10

/** The colours of a day at a time (minutes since midnight): direct, ambient and fog, each [r, g, b] from 0 to 1. */
export type Colours = [direct: number[], ambient: number[], fog: number[]]

function dayAt(day: Key[], minutes: number): Colours {
  const time = (((minutes * 2) % DAY) + DAY) % DAY
  let i = day.length - 1
  for (let k = 0; k < day.length; k++) if (day[k]![0] <= time) i = k
  const a = day[i]!, b = day[(i + 1) % day.length]!, span = (b[0] - a[0] + DAY) % DAY || DAY, f = ((time - a[0] + DAY) % DAY) / span
  return [1, 2, 3].map((c) => rgb(a[c]!).map((v, k) => v + (rgb(b[c]!)[k]! - v) * f)) as Colours
}
const rgb = (c: number): number[] => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]

/**
 * The colours at a place of a map at a time: the map's own light, and over it each light whose reach the place is in,
 * from the widest in, as far in as the place is. Null for a map with no light of its own.
 */
export function coloursAt(facts: LightFacts, map: number, x: number, y: number, minutes: number): Colours | null {
  const here = facts.lights.filter((l) => l[0] === map), whole = here.find((l) => l[4] === 0)
  if (!whole) return null
  let c = dayAt(facts.days[whole[5]]!, minutes)
  const near = here.filter((l) => l[4] > 0 && Math.hypot(l[1] - x, l[2] - y) < l[4]).sort((a, b) => b[4] - a[4])
  for (const l of near) {
    const w = Math.min(1, (l[4] - Math.hypot(l[1] - x, l[2] - y)) / Math.max(1, l[4] - l[3])), o = dayAt(facts.days[l[5]]!, minutes)
    c = c.map((part, n) => part.map((v, k) => v + (o[n]![k]! - v) * w)) as Colours
  }
  return c
}

/**
 * The light of an hour against the light of noon at the same place, channel by channel: what the view's light of today is
 * multiplied by, 1 at noon. light: what lights level ground, the ambient light and the direct light of a sun 45 degrees
 * up, as the game adds them; one number a channel for both, so the view's light keeps today's balance between them
 * (each against its own noon, the moon's blue against the sun's orange came out far too blue). fog: the sky's.
 * Null for a map with no light of its own.
 */
export function lightAt(facts: LightFacts, map: number, x: number, y: number, minutes: number): { light: number[]; fog: number[] } | null {
  const now = coloursAt(facts, map, x, y, minutes), noon = coloursAt(facts, map, x, y, NOON)
  if (!now || !noon) return null
  const level = (c: Colours): number[] => c[1].map((a, k) => a + c[0][k]! * Math.SQRT1_2)
  const a = level(now), b = level(noon)
  return { light: a.map((v, k) => v / Math.max(0.02, b[k]!)), fog: now[2].map((v, k) => v / Math.max(0.02, noon[2][k]!)) }
}
export const NOON = 12 * 60

/** The hour the addon sends (its section "time"), in minutes since midnight; null for anything else. */
export function minutesFrom(time: unknown): number | null {
  const m = (time as { m?: unknown } | null | undefined)?.m
  return typeof m === 'number' && m >= 0 && m < 1440 ? m : null
}

/** Where the sun comes from, or the moon at night: east (x), up (y), south (z), of length 1. */
export function sunAt(minutes: number): [number, number, number] {
  const hour = ((((minutes / 60) % 24) + 24) % 24), day = hour >= SUNRISE && hour < SUNSET
  // the part of its way gone, from rising to setting: the sun from 5 to 21, the moon from 21 to 5
  const f = day ? (hour - SUNRISE) / (SUNSET - SUNRISE) : (hour - SUNSET + (hour < SUNRISE ? 24 : 0)) / (24 - SUNSET + SUNRISE)
  // up to 45 degrees in the middle of its way, never under 8; it rises in the north-east, is in the north-west halfway
  // (where the view's sun is today, the side the minimap's shadows are drawn from) and sets in the south-west
  const up = (Math.max(8, Math.sin(f * Math.PI) * (day ? 45 : 35)) * Math.PI) / 180, round = f * Math.PI + Math.PI / 4
  return [Math.cos(round) * Math.cos(up), Math.sin(up), -Math.sin(round) * Math.cos(up)]
}
const SUNRISE = 5, SUNSET = 21

/** How lit the windows are: 1 from 21:30 to 4:30, coming on and going off over half an hour each side. */
export function nightAt(minutes: number): number {
  const h = (((minutes / 60 - SUNSET) % 24) + 24) % 24, length = 24 - SUNSET + SUNRISE
  return h < length ? Math.min(1, h / 0.5, (length - h) / 0.5) : 0
}
