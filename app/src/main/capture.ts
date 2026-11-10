// Reads one row of pixels off a window, as it is on screen, with the Windows graphics calls (GDI).
// This is how the app reads the strip the addon draws. It only reads the screen: nothing is sent
// to the window. Windows only.
import koffi from 'koffi'

const user32 = koffi.load('user32.dll')
const gdi32 = koffi.load('gdi32.dll')
const kernel32 = koffi.load('kernel32.dll')

koffi.struct('POINT', { x: 'long', y: 'long' })
koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })

const SetProcessDPIAware = user32.func('int __stdcall SetProcessDPIAware()')
const FindWindowW = user32.func('void * __stdcall FindWindowW(str16 cls, str16 title)')
const FindWindowExW = user32.func('void * __stdcall FindWindowExW(void *parent, void *after, str16 cls, str16 title)')
const IsWindow = user32.func('int __stdcall IsWindow(void *hwnd)')
const IsWindowVisible = user32.func('int __stdcall IsWindowVisible(void *hwnd)')
const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *pid)')
const OpenProcess = kernel32.func('void * __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)')
const QueryFullProcessImageNameW = kernel32.func(
  'int __stdcall QueryFullProcessImageNameW(void *process, uint32_t flags, void *name, _Inout_ uint32_t *size)',
)
const CloseHandle = kernel32.func('int __stdcall CloseHandle(void *handle)')
const IsIconic = user32.func('int __stdcall IsIconic(void *hwnd)')
const GetClientRect = user32.func('int __stdcall GetClientRect(void *hwnd, _Out_ RECT *rect)')
const ClientToScreen = user32.func('int __stdcall ClientToScreen(void *hwnd, _Inout_ POINT *point)')
const GetDC = user32.func('void * __stdcall GetDC(void *hwnd)')
const CreateCompatibleDC = gdi32.func('void * __stdcall CreateCompatibleDC(void *dc)')
const CreateCompatibleBitmap = gdi32.func('void * __stdcall CreateCompatibleBitmap(void *dc, int width, int height)')
const SelectObject = gdi32.func('void * __stdcall SelectObject(void *dc, void *object)')
const DeleteObject = gdi32.func('int __stdcall DeleteObject(void *object)')
const BitBlt = gdi32.func(
  'int __stdcall BitBlt(void *dst, int x, int y, int width, int height, void *src, int srcX, int srcY, uint32_t rop)',
)
const GetDIBits = gdi32.func(
  'int __stdcall GetDIBits(void *dc, void *bitmap, uint32_t start, uint32_t lines, void *bits, void *info, uint32_t usage)',
)

const SRCCOPY = 0x00cc0020

// Physical pixels, whatever the display scaling. Does nothing where the process already is, as in Electron.
SetProcessDPIAware()

/** A window, as Windows names it. */
export type WindowHandle = bigint

/** The first top-level window with exactly this title, or null. */
export function findWindow(title: string): WindowHandle | null {
  return (FindWindowW(null, title) as WindowHandle | null) || null
}

/** The full path of the program that owns a window, or null when Windows will not say. */
export function programOf(hwnd: WindowHandle): string | null {
  const pid = [0]
  GetWindowThreadProcessId(hwnd, pid)
  const process = OpenProcess(0x1000, 0, pid[0]!) as bigint | null // PROCESS_QUERY_LIMITED_INFORMATION
  if (!process) return null
  const name = Buffer.alloc(2 * 1024), size = [1024]
  const ok = QueryFullProcessImageNameW(process, 0, name, size)
  CloseHandle(process)
  return ok ? name.toString('utf16le', 0, size[0]! * 2) : null
}

/**
 * The window of World of Warcraft: Forever, or null when the game is not open. Other clients of
 * the game have the same window title: Forever is the one that runs from the _forever_ folder.
 */
export function findGameWindow(): WindowHandle | null {
  let hwnd: WindowHandle | null = null
  while ((hwnd = (FindWindowExW(null, hwnd, null, 'World of Warcraft') as WindowHandle | null) || null)) {
    if (IsWindowVisible(hwnd) && /\\_forever_\\Wow\.exe$/i.test(programOf(hwnd) ?? '')) return hwnd
  }
  return null
}

/** Whether a window is still there, and whether there is anything of it on screen. */
export function windowState(hwnd: WindowHandle): 'gone' | 'minimized' | 'open' {
  if (!IsWindow(hwnd)) return 'gone'
  return IsIconic(hwnd) ? 'minimized' : 'open'
}

// Kept between calls: the row is read many times a second.
let screenDC: bigint | undefined, memoryDC: bigint, bitmap: bigint | undefined, bitmapWidth = 0
const info = Buffer.alloc(40) // BITMAPINFOHEADER: 32 bits per pixel, uncompressed
info.writeInt32LE(40, 0)
info.writeInt32LE(1, 8) // height
info.writeUInt16LE(1, 12) // planes
info.writeUInt16LE(32, 14) // bits per pixel

/**
 * The top or bottom row of the window's client area, as shown on screen: 4 bytes per pixel, in the
 * order blue, green, red, unused. Null when there is nothing to read: the window is gone, minimized
 * or empty. A window covered by another one gives the pixels of what covers it.
 */
export function readRow(hwnd: WindowHandle, edge: 'top' | 'bottom' = 'top'): Buffer | null {
  if (IsIconic(hwnd)) return null
  const rect = { left: 0, top: 0, right: 0, bottom: 0 }
  if (!GetClientRect(hwnd, rect) || rect.right <= 0 || rect.bottom <= 0) return null
  const origin = { x: 0, y: edge === 'top' ? 0 : rect.bottom - 1 }
  if (!ClientToScreen(hwnd, origin)) return null
  const width = rect.right

  if (screenDC === undefined) {
    screenDC = GetDC(null) as bigint
    memoryDC = CreateCompatibleDC(screenDC) as bigint
  }
  if (width !== bitmapWidth) {
    if (bitmap !== undefined) DeleteObject(bitmap)
    bitmap = CreateCompatibleBitmap(screenDC, width, 1) as bigint
    bitmapWidth = width
    info.writeInt32LE(width, 4)
  }

  // GetDIBits wants the bitmap out of the device context again.
  const previous = SelectObject(memoryDC, bitmap)
  const copied = BitBlt(memoryDC, 0, 0, width, 1, screenDC, origin.x, origin.y, SRCCOPY)
  SelectObject(memoryDC, previous)
  const pixels = Buffer.alloc(width * 4)
  if (!copied || GetDIBits(screenDC, bitmap, 0, 1, pixels, info, 0) !== 1) return null
  return pixels
}
