const { app, BrowserWindow } = require('electron')
const { existsSync, mkdtempSync, realpathSync } = require('node:fs')
const { registerHooks } = require('node:module')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { setTimeout: sleep } = require('node:timers/promises')
const assert = require('node:assert/strict')
const { narrow } = require('../src/shared/strips.fixture.json')
const { waitForMappedWindow } = require('./probe-window.cjs')
app.setAppPath(join(__dirname, '..'))
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && existsSync(new URL(specifier + '.ts', context.parentURL))) return next(specifier + '.ts', context)
  return next(specifier, context)
} })
const capture = require('../src/main/capture-linux.ts')
const { decodeRow } = require('../src/shared/strip.ts')
app.on('window-all-closed', () => {})
const profile = mkdtempSync(join(tmpdir(), 'twinmap-probe-'))
for (const key of ['userData', 'sessionData', 'logs']) app.setPath(key, profile)
async function poll(fn, ms, watchCapture = true) {
  const deadline = performance.now() + ms
  do {
    const state = capture.lastHelperState()
    if (watchCapture && (state || capture.currentSession() === null)) throw new Error(`capture ended: ${state ? JSON.stringify(state) : 'helper exited'}`)
    const result = fn(); if (result) return result; await sleep(15)
  } while (performance.now() < deadline)
  return null
}
async function probe() {
  const game = process.argv.includes('--game'), title = 'Twinmap probe ' + process.pid
  let window
  if (!game) {
    process.env.TWINMAP_CAPTURE_TEST_PROGRAM = realpathSync(__filename)
    window = new BrowserWindow({ title, frame: false, width: 900, height: 160, useContentSize: true })
    await window.loadURL('data:text/html,' + encodeURIComponent(`<!doctype html><title>${title}</title><style>body{margin:0;overflow:hidden}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas><script>
      const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d', {alpha:false}), cells = ${JSON.stringify(narrow[0])}
      function redraw() {
        canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio
        ctx.fillStyle = '#804020'; ctx.fillRect(0,0,canvas.width,canvas.height)
        const strip = ctx.createImageData(Math.min(cells.length,canvas.width),1)
        for (let i=0;i<strip.width;i++) { const v=Number(cells[i]); strip.data.set([v&4?255:0,v&2?255:0,v&1?255:0,255],i*4) }
        ctx.putImageData(strip,0,0); ctx.fillStyle='#00ff00'; ctx.fillRect(0,canvas.height-1,canvas.width,1)
      }
      addEventListener('resize',redraw); redraw()
      let n=0; function animate(){if(canvas.width>451 && canvas.height>81){ctx.fillStyle=n++%2?'#ffffff':'#000000';ctx.fillRect(450,80,1,1)} requestAnimationFrame(animate)} requestAnimationFrame(animate)
    </script>`))
    if (process.env.HYPRLAND_INSTANCE_SIGNATURE) await waitForMappedWindow(title, process.pid)
  }
  assert.ok(capture.requestCapture())
  console.log(game ? 'Pick the WoW window in the picker' : `Pick the window titled "${title}" in the picker`)
  const id = await poll(() => capture.findGameWindow(), 60000)
  assert.notEqual(id, null, 'window process not found')
  if (game) {
    const kinds = Object.fromEntries(['top', 'bottom', 'left', 'right'].map(edge => [edge, new Set()]))
    const first = await poll(() => Object.keys(kinds).some(edge => capture.readRow(id, edge) !== null), 60000)
    assert.ok(first, 'no game frame received within 60 seconds')
    const deadline = performance.now() + 10000
    while (performance.now() < deadline) {
      for (const edge of Object.keys(kinds)) { const row = capture.readRow(id, edge); if (row) kinds[edge].add(decodeRow(row).kind) }
      await sleep(15)
    }
    for (const [edge, seen] of Object.entries(kinds)) console.log(`${edge}: ${[...seen].join(', ')}`)
  } else {
    const row = await poll(() => { const r = capture.readRow(id, 'top'); return r && decodeRow(r).kind === 'block' && r }, 60000)
    assert.ok(row, 'no decoded block within 60 seconds'); console.log('decoded block')
    const trustedSession = capture.currentSession()
    assert.notEqual(trustedSession, null)
    capture.trustCapture(trustedSession)
    const info = await poll(() => capture.frameInfo(), 1000)
    assert.ok(info); assert.equal(info.session, 1); assert.ok(info.frames > 0)
    const age = Number(process.hrtime.bigint() / 1_000_000n) - info.lastFrameMs
    assert.ok(age >= 0 && age <= 2000)
    const times = [], before = performance.now(), startFrames = info.frames
    for (let i = 0; i < 120; i++) {
      const start = performance.now(), result = capture.readRow(id, 'top'), elapsed = performance.now() - start
      if (result) times.push(elapsed)
      await sleep(15)
    }
    const elapsed = performance.now() - before, endInfo = await poll(() => capture.frameInfo(), 1000)
    assert.ok(endInfo); times.sort((a, b) => a - b); assert.ok(times.length)
    const median = times[Math.floor(times.length * 0.5)], p95 = times[Math.floor(times.length * 0.95)]
    console.log(`row reads: median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms; ${times.length}/120 successful`)
    console.log(`synthetic captured frames: ${endInfo.frames - startFrames} in ${(elapsed / 1000).toFixed(2)} s`)
    assert.ok(p95 < 5); assert.ok(endInfo.frames > startFrames, 'no new frames during sampling')
    let bottomPixel = null
    const bottom = await poll(() => {
      const row = capture.readRow(id, 'bottom')
      if (row) { const sample = (row.length >> 3) * 4; bottomPixel = [...row.subarray(sample, sample + 3)] }
      return row && bottomPixel.join(',') === '0,255,0'
    }, 2000)
    assert.ok(bottom, `bottom pixel: ${JSON.stringify(bottomPixel)}`)
    let boxPixel = null
    const box = await poll(() => {
      const rect = capture.readRect(id, 8, 8, 1, 1, true)
      if (rect) boxPixel = [...rect.rgb]
      return rect && boxPixel.join(',') === '128,64,32'
    }, 2000)
    assert.ok(box, `interior pixel: ${JSON.stringify(boxPixel)}`)
    let columnValues = null
    const columns = await poll(() => {
      const left = capture.readRow(id, 'left'), right = capture.readRow(id, 'right'), info = capture.frameInfo()
      columnValues = { leftLength: left?.length ?? null, rightLength: right?.length ?? null, height: info?.height ?? null,
        first: left ? [...left.subarray(4, 8)] : null, last: left ? [...left.subarray(-4)] : null }
      return left && right && info && left.length === 4 * info.height && right.length === 4 * info.height
        && columnValues.first.join(',') === '32,64,128,255' && columnValues.last.join(',') === '0,255,0,255'
    }, 2000)
    assert.ok(columns, `columns: ${JSON.stringify(columnValues)}`)
    assert.equal(capture.showsOnly(id, 8, 8, 1), true); assert.equal(capture.showsOnly(id, -1, 0, 1), false)
  }
  capture.stopCapture()
  assert.ok(await poll(() => capture.currentSession() === null, 2000, false), 'helper did not close within 2 seconds')
  if (window) window.close()
}
app.whenReady().then(probe).then(() => app.quit(), error => { console.error(error); capture.stopCapture(); app.exit(1) })
