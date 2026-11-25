// What the app keeps for every screen that shows it, its own window and a phone on the home
// network alike: the route, My pins and the shopping lists (M10-F4). One copy, held by the main process and written to a file;
// a screen that changes one tells the app, and the app tells every screen.
import { routeFrom, type Route } from './route'
import { savedFrom, type SavedPin } from './saved'
import { shoppingFrom, type ShoppingLists } from './shopping'

export interface Kept {
  /** null: never kept yet. The app's own window then hands over what it kept by itself before this was shared. */
  route: Route | null
  pins: SavedPin[] | null
  shopping: ShoppingLists | null
}

export type KeptKey = keyof Kept

/** What was kept, as a file or a screen gives it, checked. Whatever is not readable was never kept. */
export function keptFrom(read: unknown): Kept {
  const { route, pins, shopping } = (typeof read === 'object' && read ? read : {}) as Record<string, unknown>
  return {
    route: typeof route === 'object' && route ? routeFrom(JSON.stringify(route)) : null,
    pins: Array.isArray(pins) ? savedFrom(JSON.stringify(pins)) : null,
    shopping: typeof shopping === 'object' && shopping ? shoppingFrom(JSON.stringify(shopping)) : null,
  }
}

/** The same with one of them changed by a screen. Something that is neither changes nothing. */
export function keep(kept: Kept, key: unknown, value: unknown): Kept {
  if (key === 'route') return { ...kept, route: routeFrom(JSON.stringify(value ?? null)) }
  if (key === 'pins') return { ...kept, pins: savedFrom(JSON.stringify(value ?? null)) }
  if (key === 'shopping') return { ...kept, shopping: shoppingFrom(JSON.stringify(value ?? null)) }
  return kept
}
