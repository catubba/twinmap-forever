// Paints tiles of the parchment (parchment.ts) on a thread of its own, a few at once: first what painting takes, shared
// with the thread that worked it out, then the tiles to make, each answered with its pixels.
import { parentPort } from 'node:worker_threads'
import { make, painter, type Ground, type Task } from './parchment'

let detail: ReturnType<typeof painter>['detail'] | undefined
parentPort?.on('message', (told: Ground | (Task & { id: number })) => {
  if ('layers' in told) return void (detail = painter(told).detail)
  const rgb = make(detail!, told)
  // Pixels given are the asker's already: only those painted here go back, moved rather than copied.
  if (told.rgb || !rgb) parentPort?.postMessage({ id: told.id })
  else parentPort?.postMessage({ id: told.id, rgb }, [rgb.buffer as ArrayBuffer])
})
