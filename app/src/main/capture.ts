// The Windows and Mac readers bind different system libraries. Only load the one for this process.
export type WindowHandle = number | bigint
type Reading = { width: number; height: number; rgb: Uint8Array; at: { x: number; y: number } }

interface Capture {
  findWindow(title: string): WindowHandle | null
  programOf(window: WindowHandle): string | null
  findWindowOf(program: RegExp): WindowHandle | null
  findGameWindow(): WindowHandle | null
  windowState(window: WindowHandle): 'gone' | 'minimized' | 'open'
  readRect(window: WindowHandle, x: number, y: number, width: number, height: number, own?: boolean): Reading | null
  readBox(window: WindowHandle, x: number, y: number, size: number): { size: number; rgb: Uint8Array } | null
  showsOnly(window: WindowHandle, x: number, y: number, size: number): boolean
  readRow(window: WindowHandle, edge?: 'top' | 'bottom'): Buffer | null
  captureAllowed?(): boolean
  stopCapture?(): void
}

let capture: Capture | undefined
let loading: Promise<void> | undefined
export function loadCapture(): Promise<void> {
  return loading ??= (async () => {
    if (process.platform === 'win32') capture = await import('./capture-win32')
    if (process.platform === 'darwin') capture = await import('./capture-darwin')
  })()
}

export const findWindow: Capture['findWindow'] = (title) => capture?.findWindow(title) ?? null
export const programOf: Capture['programOf'] = (window) => capture?.programOf(window) ?? null
export const findWindowOf: Capture['findWindowOf'] = (program) => capture?.findWindowOf(program) ?? null
export const findGameWindow: Capture['findGameWindow'] = () => capture?.findGameWindow() ?? null
export const windowState: Capture['windowState'] = (window) => capture?.windowState(window) ?? 'gone'
export const readRect: Capture['readRect'] = (...args) => capture?.readRect(...args) ?? null
export const readBox: Capture['readBox'] = (...args) => capture?.readBox(...args) ?? null
export const showsOnly: Capture['showsOnly'] = (...args) => capture?.showsOnly(...args) ?? false
export const readRow: Capture['readRow'] = (...args) => capture?.readRow(...args) ?? null
export const captureAllowed = (): boolean => capture?.captureAllowed?.() ?? true
export const stopCapture = (): void => capture?.stopCapture?.()
