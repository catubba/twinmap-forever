// Where the map stands in this window and how wide the panel beside it is. Kept by this window
// alone, as the open or closed panel is: a phone has its own layout and takes neither.
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
