// The pins of the map and the glyphs of the interface, drawn by us: no icon of the game is used.
// A pin tells its layer by its shape and its meaning by its colour, with a black outline of 1.5 px
// so it reads on grass, sand and snow alike. Colours are the ones of ui.css.

const GOLD = '#ffd100', TEXT = '#f3ead9'
const EDGE = 'stroke="#000" stroke-width="1.5" stroke-linejoin="round"'
const DRAWN = 'fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round"' // the ! and the ? on a quest disc
// A sword, on a square of 22: for who deals damage in a group, and for a creature to slay.
const SWORD = '<path d="M17 5 16.200 8.600 10 14.800 8.200 13Z"/><path d="M6.400 11.200 10.800 15.600M8 14l-2.600 2.600" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>'
const task = `<circle cx="9" cy="9" r="8.25" fill="#ff5a4d" ${EDGE}/>` // the disc of an objective
const inTask = (drawn: string): string => `${task}<g transform="scale(1.125)">${drawn}</g>` // its sign is drawn on a square of 16
const disc = `<circle cx="10" cy="10" r="9.25" fill="${GOLD}" ${EDGE}/>`

/** Each pin: its size on the map in px, and what is inside its svg (a square of that size). */
const DRAWINGS = {
  // A quest to pick up.
  quest: [20, `${disc}<path d="M10 4.9v6.4" ${DRAWN} stroke-width="2.5"/><circle cx="10" cy="15" r="1.45"/>`],
  // A quest to hand in.
  turnin: [20, `${disc}<path d="M7.2 8a2.8 2.8 0 1 1 4.3 2.4c-1 .6-1.5 1.1-1.5 2.1" ${DRAWN} stroke-width="2.2"/><circle cx="10" cy="15.5" r="1.35"/>`],
  // Where an objective still open is found, when what it asks for is not known.
  objective: [9, `<circle cx="4.5" cy="4.5" r="3.75" fill="#ff5a4d" ${EDGE}/>`],
  // The same, by what it asks for: a sword to slay, a pouch to loot, a cog for an object to
  // use, a speech bubble to talk, a star for something to see happen.
  slay: [18, inTask(`<g transform="translate(-1.2 -1) scale(.84)">${SWORD}</g>`)],
  loot: [18, inTask(`<path d="M6 3.2h4l-1 2.3c2.9 1.4 3.6 7.3-1 7.3s-3.9-5.9-1-7.3Z"/>`)],
  object: [18, inTask(`<circle cx="8" cy="8" r="3.900" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="1.530 1.530"/><circle cx="8" cy="8" r="2.200" fill="none" stroke="#000" stroke-width="1.500"/>`)],
  talk: [18, inTask(`<path d="M4.200 4.600h7.600v5h-3.500L6 12v-2.400H4.200Z"/>`)],
  event: [18, inTask(`<path d="M8 3.300 9.200 6.800 12.700 8 9.200 9.200 8 12.700 6.800 9.200 3.300 8 6.800 6.800Z"/>`)],
  // Flight, inn, vendor, trainer, bank: the word beside it says which.
  service: [14, `<rect x=".75" y=".75" width="12.5" height="12.5" fill="#7fc8ff" ${EDGE}/>`],
  // Ore and herbs.
  resource: [12, `<path d="M6 .9 11.1 6 6 11.1.9 6Z" fill="#d9a066" ${EDGE}/>`],
  // A boss of a dungeon: a skull on a dark red disc.
  boss: [22, `<circle cx="11" cy="11" r="10.25" fill="#a3201a" ${EDGE}/><path d="M11 4.3c-3.5 0-5.9 2.3-5.9 5.4 0 1.8.8 3.1 2 4v2.300c0 .6.5 1 1 1h5.800c.5 0 1-.4 1-1v-2.300c1.200-.9 2-2.200 2-4 0-3.100-2.400-5.400-5.900-5.400Z" fill="${TEXT}" stroke="#000" stroke-width="1.1" stroke-linejoin="round"/><circle cx="8.700" cy="10.100" r="1.600"/><circle cx="13.300" cy="10.100" r="1.600"/><path d="M11 12.100l-.9 1.700h1.800Z"/><path d="M9.700 15.300v1.700M11 15.300v1.700M12.300 15.300v1.700" fill="none" stroke="#000" stroke-width=".9"/>`],
  // The door of a dungeon.
  dungeon: [16, `<path d="M2 15.25V7.5a6 6 0 0 1 12 0v7.75Z" fill="${TEXT}" ${EDGE}/><path d="M5.6 15.25V8.2a2.4 2.4 0 0 1 4.8 0v7.05Z"/>`],
  // A rare creature or a treasure.
  rare: [16, `<path d="M8 .9 10.3 5.7 15.1 8 10.3 10.3 8 15.1 5.7 10.3.9 8 5.7 5.7Z" fill="#fff6c2" ${EDGE}/>`],
  // Someone of the group, in a colour of their own: set the colour of the text around it. What they do in the group is drawn on it (companionPin).
  companion: [22, `<circle cx="11" cy="11" r="10.25" fill="currentColor" ${EDGE}/>`],
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

// What a companion does in the group, drawn on their disc: a shield, a cross, a sword.
const ROLES: Record<string, string> = {
  T: '<path d="M11 4.6 16.4 6.6v4c0 3.3-2.2 5.4-5.400 6.800-3.200-1.400-5.400-3.500-5.400-6.800v-4Z"/>',
  H: '<path d="M9.2 5h3.6v4.200H17v3.600h-4.200V17H9.200v-4.200H5V9.200h4.200Z"/>',
  D: SWORD,
}
/** A companion's disc with their role on it, or the first letter of their name where the group gave no role. */
export function companionPin(role: string | undefined, name: string): string {
  const [size, disc] = DRAWINGS.companion
  const letter = /^[\p{L}\p{N}]/u.exec(name)?.[0].toUpperCase() ?? ''
  const inside = (role && ROLES[role]) ?? `<text x="11" y="15.300" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700">${letter}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${disc}${inside}</svg>`
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
