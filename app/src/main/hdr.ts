// The reading of the screen in floating point (hdr-reader.ts), asked from the app: a process of
// its own for each reading, so that whatever happens in there the app stays up.
import { utilityProcess } from 'electron'
import type { HdrAsk } from './hdr-reader'
// A path to the worker entry. The DLL bindings are evaluated only when Windows forks it.
import readerPath from './hdr-reader?modulePath'

const WITHIN = 5000 // ms a reading may take: a process starts, a frame of the screen comes

/** The rectangle of the desktop as the game drew it, or null when there is no such reading to be had (see readHdrRect). */
export function readHdr(ask: HdrAsk): Promise<{ width: number; height: number; rgb: Uint8Array } | null> {
  if (process.platform !== 'win32') return Promise.resolve(null)
  return new Promise((done) => {
    const reader = utilityProcess.fork(readerPath)
    let over = false
    const end = (read: unknown): void => {
      if (over) return
      over = true
      clearTimeout(timer)
      reader.kill()
      const r = read as { width?: unknown; height?: unknown; rgb?: unknown } | null
      done(r && r.width === ask.width && r.height === ask.height && r.rgb instanceof Uint8Array && r.rgb.length === ask.width * ask.height * 3 ? { width: ask.width, height: ask.height, rgb: r.rgb } : null)
    }
    const timer = setTimeout(() => end(null), WITHIN)
    reader.once('spawn', () => reader.postMessage(ask))
    reader.once('message', end)
    reader.once('exit', () => end(null))
  })
}
