// Run from app/ with npm run probe:mac. This opens only a synthetic window.
const { app, BrowserWindow } = require('electron')
const { existsSync, mkdtempSync, realpathSync } = require('node:fs')
const { registerHooks } = require('node:module')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { setTimeout: sleep } = require('node:timers/promises')
const assert = require('node:assert/strict')
const { narrow } = require('../src/shared/strips.fixture.json')

// Electron treats the script's directory as the app root when invoked directly.
app.setAppPath(join(__dirname, '..'))
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && existsSync(new URL(specifier + '.ts', context.parentURL))) {
      return next(specifier + '.ts', context)
    }
    return next(specifier, context)
  },
})
const capture = require('../src/main/capture-darwin.ts')
const { decodeRow } = require('../src/shared/strip.ts')
const profile = mkdtempSync(join(tmpdir(), 'twinmap-probe-'))
for (const key of ['userData', 'sessionData', 'logs']) app.setPath(key, profile)

const title = 'Twinmap capture probe'
const started = performance.now()
console.log(`CGPreflightScreenCaptureAccess: ${capture.captureAllowed()}`)

async function probe() {
  process.env.TWINMAP_CAPTURE_TEST_PROGRAM = realpathSync(process.execPath)
  const window = new BrowserWindow({ title, width: 900, height: 160, useContentSize: true })
  await window.loadURL('data:text/html,' + encodeURIComponent(`<!doctype html><title>${title}</title>
    <style>body {margin:0} canvas {display:block;width:100vw;height:100vh}</style><canvas></canvas>
    <script>
    const canvas = document.querySelector('canvas')
    canvas.width = innerWidth * devicePixelRatio
    canvas.height = innerHeight * devicePixelRatio
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.fillStyle = '#804020'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const strip = ctx.createImageData(canvas.width, 1)
    const cells = ${JSON.stringify(narrow[0])}
    for (let i = 0; i < canvas.width; i++) {
      const v = Number(cells[i] || 0)
      strip.data.set([v & 4 ? 255 : 0, v & 2 ? 255 : 0, v & 1 ? 255 : 0, 255], i * 4)
    }
    ctx.putImageData(strip, 0, 0)
    ctx.fillStyle = '#00ff00'
    ctx.fillRect(0, canvas.height - 1, canvas.width, 1)
    </script>`))
  const deadline = performance.now() + 5000
  let id = null, row = null
  while (performance.now() < deadline) {
    id ??= capture.findGameWindow()
    if (id !== null) row = capture.readRow(id)
    if (row && decodeRow(row).kind === 'block') break
    await sleep(50)
  }
  if (id === null) throw new Error('CGWindowListCopyWindowInfo did not expose the visible probe window to the program matcher')
  console.log(`window ${id}, executable: ${capture.programOf(id)}, state: ${capture.windowState(id)}`)
  if (!row) throw new Error(capture.captureAllowed()
    ? 'ScreenCaptureKit provided no frame within 5 seconds'
    : 'Allow Twinmap under System Settings > Privacy & Security > Screen Recording')
  console.log(`first frame: ${(performance.now() - started).toFixed(1)} ms after startup`)
  const decoded = decodeRow(row)
  console.log(`decoded strip: ${JSON.stringify(decoded)}`)
  assert.equal(decoded.kind, 'block')
  assert.equal(capture.windowState(id), 'open')

  const time = []
  let missed = 0
  for (let i = 0; i < 120; i++) {
    const before = performance.now()
    const top = capture.readRow(id)
    const elapsed = performance.now() - before
    if (top) time.push(elapsed)
    else missed++
    await sleep(15)
  }
  time.sort((a, b) => a - b)
  assert.ok(time.length, 'no rows returned during the timing run')
  console.log(`row reads (${time.length}/120, ${missed} missed): median ${time[Math.floor(time.length * 0.5)].toFixed(3)} ms, p95 ${time[Math.floor(time.length * 0.95)].toFixed(3)} ms`)

  const bottom = capture.readRow(id, 'bottom')
  const box = capture.readRect(id, 8, 8, 1, 1, true)
  assert.ok(bottom)
  assert.ok(box)
  const sample = (bottom.length >> 3) * 4 // away from the window's rounded bottom corners
  const bottomRgb = [...bottom.subarray(sample, sample + 3)]
  console.log(`top BGRA: ${[...row.subarray(0, 24)]}\nbottom BGR: ${bottomRgb}\ninterior RGB: ${[...box.rgb]}`)
  assert.deepEqual(bottomRgb, [0, 255, 0])
  assert.deepEqual([...box.rgb], [128, 64, 32])
  assert.equal(capture.showsOnly(id, 8, 8, 1), true)
  assert.equal(capture.showsOnly(id, -1, 0, 1), false)
}

app.whenReady().then(probe).then(
  () => { capture.stopCapture(); app.quit() },
  (error) => { console.error(error.message); capture.stopCapture(); app.exit(1) },
)
