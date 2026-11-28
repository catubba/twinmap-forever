// The steps of Quality in Settings > Graphics (M23-F34): what each turns on in the 3D view, and which one a mix of switches is.
import type { Density } from './props'

/** The switches of the 3D view that Quality sets (renderer/src/graphics.svelte.ts has them all). */
export interface Switches {
  buildings: boolean
  trees: boolean
  density: Density
  objects: boolean
  ground: boolean
  daynight: boolean
}

/**
 * The three steps of Quality in Settings > Graphics (M23-F34, design/ui.md section 6): each sets every switch of the 3D
 * view but the dungeons. Day and night costs nothing (M23-F20) and is on in all three. Any other mix is Custom. The app
 * starts on High with a graphics card, Low on a phone, a tablet or without a card (renderer/src/graphics.svelte.ts).
 */
export const QUALITIES = {
  low: { buildings: false, trees: false, objects: false, ground: false, daynight: true },
  medium: { buildings: true, trees: false, objects: false, ground: false, daynight: true },
  high: { buildings: true, trees: true, density: 'some', objects: true, ground: true, daynight: true },
} as const satisfies Record<string, Partial<Switches>>
export type Quality = keyof typeof QUALITIES
export const QUALITY_NAMES = Object.keys(QUALITIES) as Quality[]

/** The step the switches are on, or custom. How many trees counts only where the step has trees. */
export function qualityOf(g: Switches): Quality | 'custom' {
  return QUALITY_NAMES.find((q) => Object.entries(QUALITIES[q]).every(([k, v]) => g[k as keyof Switches] === v)) ?? 'custom'
}

/** The step under this one, for a view too slow (Map.svelte): from Custom, the step under what it has on. None under Low. */
export function lower(g: Switches): Quality | null {
  const q = qualityOf(g)
  if (q !== 'custom') return QUALITY_NAMES[QUALITY_NAMES.indexOf(q) - 1] ?? null
  return g.trees || g.objects || g.ground ? 'medium' : g.buildings ? 'low' : null
}
