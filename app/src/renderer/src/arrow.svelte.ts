// The character's arrow as the player chose it in Settings > Appearance (M21-F1): its colour and its size, of the one
// drawn first (look.ts), on the 2D map and on the 3D view alike. Kept by this window, as the side of the map is: a
// phone chooses its own.
import { ARROW, ARROW_SIZES } from './look'

const keptColour = localStorage.getItem('arrow-colour'),
  keptSize = Number(localStorage.getItem('arrow-size'))
export const arrow = $state({
  colour: keptColour && /^#[0-9a-f]{6}$/i.test(keptColour) ? keptColour : ARROW.colour,
  size: ARROW_SIZES.includes(keptSize) ? keptSize : ARROW.size,
})

export function setArrow(to: Partial<typeof ARROW>): void {
  Object.assign(arrow, to)
  localStorage.setItem('arrow-colour', arrow.colour)
  localStorage.setItem('arrow-size', String(arrow.size))
}
