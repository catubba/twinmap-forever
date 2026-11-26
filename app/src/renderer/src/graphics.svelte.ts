// What the 3D view draws, as the player chose it in Settings > Graphics (M23-F1, design/ui.md section 6): each a switch,
// kept by this window as the arrow is (arrow.svelte.ts), so a phone chooses its own. Where the view is drawn by the
// processor (no graphics card) they start off: the 3D view of before. Trees and objects (M23-F7): on a computer some
// trees, on a phone or tablet few (the starting values of M23-F6, to be measured in F5).
import type { Density } from '../../shared/props'
import { inApp } from './web'

// The test of terrain3d.ts: the browser refuses a context that needs the graphics card.
const software = (): boolean => !document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true })

const DENSITY_NAMES: readonly Density[] = ['few', 'some', 'many']
export { DENSITY_NAMES }

const on = (key: string, start: () => boolean): boolean => {
  const kept = localStorage.getItem(key)
  return kept ? kept === 'on' : start()
}
const kept = localStorage.getItem('density') as Density | null
export const graphics = $state({
  buildings: on('buildings', () => !software()),
  trees: on('trees', () => !software()),
  density: kept && DENSITY_NAMES.includes(kept) ? kept : inApp ? 'some' : ('few' as Density),
  objects: on('objects', () => !software()),
})

export function setGraphics(to: Partial<typeof graphics>): void {
  Object.assign(graphics, to)
  for (const key of ['buildings', 'trees', 'objects'] as const) localStorage.setItem(key, graphics[key] ? 'on' : 'off')
  localStorage.setItem('density', graphics.density)
}
