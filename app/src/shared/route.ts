// The route: stops the player chose on the map, in the order to walk them, and what the band of the
// next stop says about the one ahead.
import { UNITS_PER_BLOCK, unitsOfRect, type Point } from './geo'
import type { Continent, GameMap } from './maps'
import { wayOf } from './now'
import { wayTo } from './point-label'
import { BLOCK_YARDS } from './world'

export interface Stop {
  name: string
  continent: Continent
  /** Where it is, in map units (geo.ts). */
  at: Point
  /** The same point as the game names it, a zone map and a percent of it; null where no zone is. */
  pin: { m: number; x: number; y: number } | null
}

export interface Route {
  stops: Stop[]
  /** The stop to walk to now: those before it are done. As many as the stops: the route is complete. */
  next: number
  /** The game has this very route. Any change makes it false again. */
  sent: boolean
  /** When it was sent: the game tells its place on the route under this number. */
  t?: number
}

export const MAX_STOPS = 30
const ARRIVE = 15 // yards from a stop at which the character is there
const RUN = 7 // yards a second on foot, as on the label of a point

export const noRoute = (): Route => ({ stops: [], next: 0, sent: false })

const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
/** A stop as it was saved, checked. */
export function stopFrom(saved: unknown): Stop | null {
  if (typeof saved !== 'object' || !saved) return null
  const { name, continent, at, pin } = saved as Record<string, unknown>
  const p = at as Partial<Point> | null, g = pin as Partial<NonNullable<Stop['pin']>> | null
  if (typeof name !== 'string' || (continent !== 0 && continent !== 1) || typeof p !== 'object' || !p || !number(p.x) || !number(p.y)) return null
  return { name, continent, at: { x: p.x, y: p.y }, pin: typeof g === 'object' && g && number(g.m) && number(g.x) && number(g.y) ? { m: g.m, x: g.x, y: g.y } : null }
}

/** The route as it was saved; none where nothing readable is there. */
export function routeFrom(saved: string | null): Route {
  try {
    const read = JSON.parse(saved ?? '') as Partial<Route> | null
    if (!read || !Array.isArray(read.stops)) return noRoute()
    const stops = read.stops.map(stopFrom).filter((s): s is Stop => s !== null).slice(0, MAX_STOPS)
    const next = number(read.next) ? Math.max(0, Math.min(Math.floor(read.next), stops.length)) : 0
    const sent = read.sent === true && number(read.t)
    return stops.length ? { stops, next, sent, ...(sent ? { t: read.t } : {}) } : noRoute()
  } catch {
    return noRoute()
  }
}

const same = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6
/** Whether a point is already a stop still to walk. */
export const inRoute = (route: Route, continent: Continent, at: Point): boolean => route.stops.some((s, i) => i >= route.next && s.continent === continent && same(s.at, at))

/** A stop more, at the end. A route already walked to its end starts anew with it. */
export function addStop(route: Route, stop: Stop): Route {
  if (route.next >= route.stops.length) return { stops: [stop], next: 0, sent: false }
  if (route.stops.length >= MAX_STOPS || inRoute(route, stop.continent, stop.at)) return route
  return { stops: [...route.stops, stop], next: route.next, sent: false }
}

/** Without one stop. The last one taken away leaves no route. */
export function removeStop(route: Route, index: number): Route {
  if (!route.stops[index]) return route
  const stops = route.stops.filter((_, i) => i !== index)
  return stops.length ? { stops, next: index < route.next ? route.next - 1 : route.next, sent: false } : noRoute()
}

/** A stop still to walk, moved among the others still to walk. */
export function moveStop(route: Route, from: number, to: number): Route {
  if (from === to || Math.min(from, to) < route.next || Math.max(from, to) >= route.stops.length) return route
  const stops = [...route.stops]
  stops.splice(to, 0, ...stops.splice(from, 1))
  return { stops, next: route.next, sent: false }
}

/** On to the stop after: the one ahead is skipped, or was reached. The game still has the same route. */
export const advance = (route: Route): Route => (route.next < route.stops.length ? { ...route, next: route.next + 1 } : route)

/** A route as it goes to the game: every stop on a zone map, with how near counts as there, in percent of that map. */
export interface RouteNews {
  t: number
  /** The stop to start from, counted from 1. */
  at: number
  stops: { m: number; x: number; y: number; rx: number; ry: number; name: string }[]
}

const round = (v: number, places: number): number => Math.round(v * 10 ** places) / 10 ** places

/** The route for the game, or null when it has nothing left to walk or a stop lies in no zone the game can mark. */
export function routeNews(route: Route, maps: GameMap[], t: number): RouteNews | null {
  if (route.next >= route.stops.length) return null
  const stops: RouteNews['stops'] = []
  for (const stop of route.stops) {
    const zone = stop.pin && maps.find((m) => m.id === stop.pin!.m)
    if (!stop.pin || !zone?.rect) return null
    const [a, b] = unitsOfRect(zone.rect), near = (ARRIVE / BLOCK_YARDS) * UNITS_PER_BLOCK // the arriving distance, in map units
    stops.push({ m: stop.pin.m, x: round(stop.pin.x, 2), y: round(stop.pin.y, 2), rx: round((near / Math.abs(b.x - a.x)) * 100, 3), ry: round((near / Math.abs(b.y - a.y)) * 100, 3), name: stop.name.slice(0, 40) })
  }
  return { t, at: route.next + 1, stops }
}

/** Where the game is on a route, as the addon tells it on the strip, checked. at: the stop it walks to, from 1; past the last, the route is done. */
export function gameRouteFrom(section: unknown): { t: number; at: number; of: number } | null {
  if (typeof section !== 'object' || !section) return null
  const { t, at, of } = section as Record<string, unknown>
  return number(t) && number(at) && number(of) ? { t, at, of } : null
}

/** The route moved on to where the game is on it. Only forwards, and only when the game has this very route. */
export function followed(route: Route, game: { t: number; at: number } | null): Route {
  const there = game && route.sent && game.t === route.t ? Math.min(game.at - 1, route.stops.length) : 0
  return there > route.next ? { ...route, next: there } : route
}

/** What the band of the next stop shows. */
export type Band =
  | { state: 'none' }
  | { state: 'complete' }
  // The name and number of the stop alone: the game is closed, or the character is where no way can be told (another continent, a dungeon).
  | { state: 'closed' | 'elsewhere'; name: string; n: number; of: number }
  // far: "410 yd south-west". turn: degrees clockwise from north, which is up on the map. minutes: on foot.
  | { state: 'going' | 'arrived'; name: string; n: number; of: number; far: string; turn: number; minutes: number }

/**
 * me: where the character is on the continents, or null (in a dungeon, or not known). live: the
 * strip is being read. walked: the yards of the way on foot to the next stop, where one is known:
 * the band tells those, and the minutes they take. Being there is still told as the crow flies.
 */
export function bandOf(route: Route, me: { continent: Continent; at: Point } | null, live: boolean, walked?: number): Band {
  if (!route.stops.length) return { state: 'none' }
  const stop = route.stops[route.next]
  if (!stop) return { state: 'complete' }
  const said = { name: stop.name, n: route.next + 1, of: route.stops.length }
  if (!live) return { state: 'closed', ...said }
  if (!me || me.continent !== stop.continent) return { state: 'elsewhere', ...said }
  const { yards, turn } = wayOf(me.at, stop.at)
  return { state: yards <= ARRIVE ? 'arrived' : 'going', ...said, far: wayTo(me.at, stop.at, walked).far, turn, minutes: Math.max(1, Math.round((walked ?? yards) / RUN / 60)) }
}
