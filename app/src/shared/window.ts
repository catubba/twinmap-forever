// Window sizes, in one place for the main process and for the tests.
export const WINDOW = {
  width: 1280,
  height: 800,
  minWidth: 720,
  minHeight: 480,
  background: '#17110c',
  top: 40, // the top row, which is also the title bar: the window is dragged by it
  symbols: '#f3ead9', // minimize, maximize and close, drawn by Windows over our ground
} as const

export type Rect = { x: number; y: number; width: number; height: number }

// How much of the top row has to be on a monitor for the window to count as still there: enough to grab it.
const GRIP = 100

// Where the window opens: where it was left, if a monitor is still there; otherwise centred on the main one.
// `saved` comes from a file and may be anything. `areas` are the monitors without their taskbars.
export function placeWindow(saved: unknown, areas: Rect[], primary: Rect): Rect {
  const s = (typeof saved === 'object' && saved ? saved : {}) as Partial<Rect>
  const known = [s.x, s.y, s.width, s.height].every((n) => typeof n === 'number' && Number.isFinite(n))
  const width = Math.max(WINDOW.minWidth, Math.round(known ? s.width! : WINDOW.width))
  const height = Math.max(WINDOW.minHeight, Math.round(known ? s.height! : WINDOW.height))
  if (known) {
    const x = Math.round(s.x!), y = Math.round(s.y!)
    const there = areas.some(
      (a) => Math.min(x + width, a.x + a.width) - Math.max(x, a.x) >= GRIP && y >= a.y && y + WINDOW.top <= a.y + a.height,
    )
    if (there) return { x, y, width, height }
  }
  const w = Math.min(width, primary.width), h = Math.min(height, primary.height)
  return { x: primary.x + Math.round((primary.width - w) / 2), y: primary.y + Math.round((primary.height - h) / 2), width: w, height: h }
}
