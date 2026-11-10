// How things move, in one place. Three speeds and one curve: what opens comes from where it
// belongs, quickly, and leaves faster than it came. With "reduce motion" on in Windows none of
// this runs (ui.css stops every animation) and things simply appear.
import { cubicOut } from 'svelte/easing'
import type { FlyParams, ScaleParams, FadeParams } from 'svelte/transition'

const OPEN = 180 // menus, labels, notes
const PAGE = 340 // a page of the first run sliding in

/** A menu dropping from its button, a note rising from the foot of the map. */
export const drop = (y = -8): FlyParams => ({ y, duration: OPEN, easing: cubicOut })
/** A label growing out of its point. */
export const pop: ScaleParams = { start: 0.94, duration: OPEN, easing: cubicOut }
/** Anything leaving, and a whole screen changing for another. */
export const gone: FadeParams = { duration: 120 }
export const screen: FadeParams = { duration: 220, easing: cubicOut }
/** A page coming in from the side the player is going to: 1 from the right, -1 from the left. */
export const pageIn = (dir: number): FlyParams => ({ x: 56 * dir, duration: PAGE, easing: cubicOut })
export const pageOut = (dir: number): FlyParams => ({ x: -56 * dir, duration: PAGE * 0.6, easing: cubicOut })
