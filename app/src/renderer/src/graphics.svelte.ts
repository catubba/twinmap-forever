// What the 3D view draws, as the player chose it in Settings > Graphics (M23-F1, design/ui.md section 6): each a switch,
// kept by this window as the arrow is (arrow.svelte.ts), so a phone chooses its own. They start on in the app with a
// graphics card, whichever it is, and off where the view is drawn by the processor and on a phone or tablet: the 3D view
// of before. Measured in M23-F5: a phone's card reads no DXT, and with the buildings on the view falls to 12-25 frames a
// second with next to none of them shown; trees and objects alone halve its frames when the view moves.
import type { Density } from '../../shared/props'
import { inApp } from './web'

// The test of terrain3d.ts: the browser refuses a context that needs the graphics card.
const software = (): boolean => !document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true })
const starts = (): boolean => inApp && !software()

const DENSITY_NAMES: readonly Density[] = ['few', 'some', 'many']
export { DENSITY_NAMES }

const on = (key: string, start: () => boolean): boolean => {
  const kept = localStorage.getItem(key)
  return kept ? kept === 'on' : start()
}
const kept = localStorage.getItem('density') as Density | null
export const graphics = $state({
  buildings: on('buildings', starts),
  trees: on('trees', starts),
  density: kept && DENSITY_NAMES.includes(kept) ? kept : inApp ? 'some' : ('few' as Density),
  objects: on('objects', starts),
  /** The ground's own textures up close (M23-F8). */
  ground: on('ground', starts),
  /** Dungeons and raids in the 3D view (M23-F23): "3D Dungeon (Experimental)", off until the player turns it on. */
  dungeons: on('dungeons', () => false),
  /** The light of the game's hour of the day (M23-F10): colours only, nothing to load, on everywhere. */
  daynight: on('daynight', () => true),
})

/**
 * How much of the graphics card's memory the 3D view takes, in MB, as measured switch by switch (M23-F20,
 * design/graphics/vram-trial.js: Windows' count of the card's own memory the app's graphics process holds, the most of
 * Stormwind, Ironforge and Goldshire): a part that is always there, a part that grows with the pixels of the window, and
 * what each switch adds. Day and night and the dungeons add nothing.
 */
export const COSTS = { base: 150, megapixel: 125, buildings: 90, trees: 15, objects: 50, ground: 15 } as const

/** The memory of the card the view takes with these switches, in a window of so many pixels of the card (rounded to 10 MB). */
export function cardMemory(g: Pick<typeof graphics, 'buildings' | 'trees' | 'objects' | 'ground'>, pixels: number): number {
  const mb = COSTS.base + (COSTS.megapixel * pixels) / 1e6 + (g.buildings ? COSTS.buildings : 0) + (g.trees ? COSTS.trees : 0) + (g.objects ? COSTS.objects : 0) + (g.ground ? COSTS.ground : 0)
  return Math.round(mb / 10) * 10
}

export function setGraphics(to: Partial<typeof graphics>): void {
  Object.assign(graphics, to)
  for (const key of ['buildings', 'trees', 'objects', 'ground', 'dungeons', 'daynight'] as const) localStorage.setItem(key, graphics[key] ? 'on' : 'off')
  localStorage.setItem('density', graphics.density)
}
