// How things move, in one place. Three speeds and one curve: what opens comes from where it
// belongs, quickly, and leaves faster than it came. With "reduce motion" on in Windows nothing
// slides or grows: things only fade. (Svelte runs these itself, so the rule in ui.css does not reach
// them.) The system is asked each time, so the choice holds as soon as it is made.
import { cubicOut } from 'svelte/easing'
import type { FlyParams, ScaleParams, FadeParams } from 'svelte/transition'

const OPEN = 180 // menus, labels, notes
const PAGE = 340 // a page of the first run sliding in
/** The player asked Windows for less movement. */
export const still = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** A menu dropping from its button, a note rising from the foot of the map. */
export const drop = (y = -8): FlyParams => ({ y: still() ? 0 : y, duration: OPEN, easing: cubicOut })
/** A label growing out of its point. */
export const pop = (): ScaleParams => ({ start: still() ? 1 : 0.94, duration: OPEN, easing: cubicOut })
/** Anything leaving, and a whole screen changing for another. */
export const gone: FadeParams = { duration: 120 }
export const screen: FadeParams = { duration: 220, easing: cubicOut }
/** The opening screen giving way to the first one. */
export const opened: FadeParams = { duration: 600 }
/** A page coming in from the side the player is going to: 1 from the right, -1 from the left. */
export const pageIn = (dir: number): FlyParams => ({ x: still() ? 0 : 56 * dir, duration: PAGE, easing: cubicOut })
export const pageOut = (dir: number): FlyParams => ({ x: still() ? 0 : -56 * dir, duration: 200, easing: cubicOut })
