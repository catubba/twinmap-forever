// What the 3D view draws, as the player chose it in Settings > Graphics (M23-F1, design/ui.md section 6): each a switch,
// kept by this window as the arrow is (arrow.svelte.ts), so a phone chooses its own. Where the view is drawn by the
// processor (no graphics card) they start off: the 3D view of before.

// The test of terrain3d.ts: the browser refuses a context that needs the graphics card.
const software = (): boolean => !document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true })

const kept = localStorage.getItem('buildings')
export const graphics = $state({ buildings: kept ? kept === 'on' : !software() })

export function setGraphics(to: Partial<typeof graphics>): void {
  Object.assign(graphics, to)
  localStorage.setItem('buildings', graphics.buildings ? 'on' : 'off')
}
