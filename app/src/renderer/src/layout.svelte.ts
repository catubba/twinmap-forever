// Where the map stands in this window, how wide the panel beside it is, and the character's arrow as the player
// chose it (M21-F1). Kept by this window alone, as the open or closed panel is: a phone has its own and takes none.
import { ARROW, ARROW_SIZES } from './look'

export const PANEL = { least: 260, start: 340 }

export const layout = $state({
  mapRight: localStorage.getItem('map-side') === 'right',
  width: Number(localStorage.getItem('panel-width')) || PANEL.start,
})

export function setMapRight(right: boolean): void {
  layout.mapRight = right
  localStorage.setItem('map-side', right ? 'right' : 'left')
}

/** The panel at most half the window wide: a window made narrower later is held by the CSS too. */
export function setWidth(width: number, keep = true): void {
  layout.width = Math.round(Math.min(Math.max(width, PANEL.least), innerWidth / 2))
  if (keep) localStorage.setItem('panel-width', String(layout.width))
}

const keptColour = localStorage.getItem('arrow-colour'),
  keptSize = Number(localStorage.getItem('arrow-size'))
/** The arrow on the 2D map and on the 3D view: its colour and its size, of the one drawn first (look.ts). */
export const arrow = $state({
  colour: keptColour && /^#[0-9a-f]{6}$/i.test(keptColour) ? keptColour : ARROW.colour,
  size: ARROW_SIZES.includes(keptSize) ? keptSize : ARROW.size,
})

export function setArrow(to: Partial<typeof ARROW>): void {
  Object.assign(arrow, to)
  localStorage.setItem('arrow-colour', arrow.colour)
  localStorage.setItem('arrow-size', String(arrow.size))
}
