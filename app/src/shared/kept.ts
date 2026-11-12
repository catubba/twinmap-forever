// What the app keeps for every screen that shows it, its own window and a phone on the home
// network alike: the route and My pins. One copy, held by the main process and written to a file;
// a screen that changes one tells the app, and the app tells every screen.
import { routeFrom, type Route } from './route'
import { savedFrom, type SavedPin } from './saved'

export interface Kept {
  /** null: never kept yet. The app's own window then hands over what it kept by itself before this was shared. */
  route: Route | null
  pins: SavedPin[] | null
}

export type KeptKey = keyof Kept

/** What was kept, as a file or a screen gives it, checked. Whatever is not readable was never kept. */
export function keptFrom(read: unknown): Kept {
  const { route, pins } = (typeof read === 'object' && read ? read : {}) as Record<string, unknown>
  return {
    route: typeof route === 'object' && route ? routeFrom(JSON.stringify(route)) : null,
    pins: Array.isArray(pins) ? savedFrom(JSON.stringify(pins)) : null,
  }
}

/** The same with one of the two changed by a screen. Something that is neither changes nothing. */
export function keep(kept: Kept, key: unknown, value: unknown): Kept {
  if (key === 'route') return { ...kept, route: routeFrom(JSON.stringify(value ?? null)) }
  if (key === 'pins') return { ...kept, pins: savedFrom(JSON.stringify(value ?? null)) }
  return kept
}
