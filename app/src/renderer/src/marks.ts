// The pins of the map and the glyphs of the interface, drawn by us: no icon of the game is used.
// A pin tells its layer by its shape and its meaning by its colour, with a black outline of 1.5 px
// so it reads on grass, sand and snow alike. Colours are the ones of ui.css.

const GOLD = '#ffd100', TEXT = '#f3ead9'
const EDGE = 'stroke="#000" stroke-width="1.5" stroke-linejoin="round"'
const DRAWN = 'fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round"' // the ! and the ? on a quest disc
const disc = `<circle cx="10" cy="10" r="9.25" fill="${GOLD}" ${EDGE}/>`

/** Each pin: its size on the map in px, and what is inside its svg (a square of that size). */
const DRAWINGS = {
  // A quest to pick up.
  quest: [20, `${disc}<path d="M10 4.9v6.4" ${DRAWN} stroke-width="2.5"/><circle cx="10" cy="15" r="1.45"/>`],
  // A quest to hand in.
  turnin: [20, `${disc}<path d="M7.2 8a2.8 2.8 0 1 1 4.3 2.4c-1 .6-1.5 1.1-1.5 2.1" ${DRAWN} stroke-width="2.2"/><circle cx="10" cy="15.5" r="1.35"/>`],
  // Where an objective still open is found.
  objective: [9, `<circle cx="4.5" cy="4.5" r="3.75" fill="#ff5a4d" ${EDGE}/>`],
  // Flight, inn, vendor, trainer, bank: the word beside it says which.
  service: [14, `<rect x=".75" y=".75" width="12.5" height="12.5" fill="#7fc8ff" ${EDGE}/>`],
  // Ore and herbs.
  resource: [12, `<path d="M6 .9 11.1 6 6 11.1.9 6Z" fill="#d9a066" ${EDGE}/>`],
  // The door of a dungeon.
  dungeon: [16, `<path d="M2 15.25V7.5a6 6 0 0 1 12 0v7.75Z" fill="${TEXT}" ${EDGE}/><path d="M5.6 15.25V8.2a2.4 2.4 0 0 1 4.8 0v7.05Z"/>`],
  // A rare creature or a treasure.
  rare: [16, `<path d="M8 .9 10.3 5.7 15.1 8 10.3 10.3 8 15.1 5.7 10.3.9 8 5.7 5.7Z" fill="#fff6c2" ${EDGE}/>`],
  // Someone of the group, in the colour of their class: set the colour of the text around it.
  companion: [12, `<circle cx="6" cy="6" r="5.25" fill="currentColor" ${EDGE}/>`],
  // A pin the player put down.
  flag: [16, `<path d="M3.5 1.6v13" stroke="#000" stroke-width="3.6" stroke-linecap="round"/><path d="M3.5 1.75h10l-2.7 3.3 2.7 3.3h-10Z" fill="${TEXT}" ${EDGE}/><path d="M3.5 1.6v13" stroke="${TEXT}" stroke-width="1.6" stroke-linecap="round"/>`],
  // Where the character died.
  corpse: [14, `<path d="M5.25.9h3.5v3.4h3.4v3.4h-3.4v5.4h-3.5V7.7h-3.4V4.3h3.4Z" fill="#b9a88c" ${EDGE}/>`],
  // The character: it is turned to where it faces.
  player: [28, `<path d="M14 1.2 23.3 24.5 14 18.7 4.7 24.5Z" fill="${GOLD}" ${EDGE} stroke-width="1.9"/>`],
} as const satisfies Record<string, readonly [number, string]>

export type PinName = keyof typeof DRAWINGS
export const PIN_NAMES = Object.keys(DRAWINGS) as PinName[]
export const pinSize = (name: PinName): number => DRAWINGS[name][0]
/** The pin as markup, for Leaflet and for the page alike. */
export function pin(name: PinName): string {
  const [size, inside] = DRAWINGS[name]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${inside}</svg>`
}

/**
 * Glyphs of the interface, on a grid of 16 px: a line of 1.75 px with round ends, in the colour
 * of the text. `direction` alone is filled: the player's arrow, small, turned towards a place.
 */
export const GLYPHS = {
  search: 'M11.25 7a4.25 4.25 0 1 1-8.500 0 4.25 4.25 0 0 1 8.500 0ZM10.200 10.200 14 14',
  close: 'M4 4l8 8M12 4l-8 8',
  menu: 'M4 6.500 8 10.500 12 6.500',
  check: 'M3.500 8.500 6.500 11.500 12.500 4.500',
  grip: 'M6 4.250h.01M10 4.250h.01M6 8h.01M10 8h.01M6 11.750h.01M10 11.750h.01',
  plus: 'M8 3.500v9M3.500 8h9',
  minus: 'M3.500 8h9',
  direction: 'M8 1 14 15 8 11 2 15Z',
} as const
export type GlyphName = keyof typeof GLYPHS
