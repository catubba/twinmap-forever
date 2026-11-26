// Run from app/ with npm run probe:linux -- --no-sandbox under Xvfb or an X11 desktop.
// With libxcb-res.so.0 and X-Resource 1.2, also verify lookup after replacing the reported PID.
// For monitor clipping, define two RandR 1.5 monitors inside a larger Xvfb screen with xrandr --setmonitor.
const { app, BrowserWindow } = require('electron')
const { existsSync, mkdtempSync, realpathSync } = require('node:fs')
const { registerHooks } = require('node:module')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { setTimeout: sleep } = require('node:timers/promises')
const assert = require('node:assert/strict')
const koffi = require('koffi')
const { narrow } = require('../src/shared/strips.fixture.json')

app.setAppPath(join(__dirname, '..'))
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && existsSync(new URL(specifier + '.ts', context.parentURL))) {
      return next(specifier + '.ts', context)
    }
    return next(specifier, context)
  },
})
const capture = require('../src/main/capture-linux.ts')
const { decodeRow } = require('../src/shared/strip.ts')
const { monitorsFrom, parseSetup } = require('../src/main/capture-linux-frame.ts')
const profile = mkdtempSync(join(tmpdir(), 'twinmap-probe-'))
for (const key of ['userData', 'sessionData', 'logs']) app.setPath(key, profile)
const title = 'Twinmap capture probe'
const started = performance.now()
app.on('window-all-closed', () => {}) // Keep running long enough to check the destroyed window.

function replacePid(id) {
  const xcb = koffi.load('libxcb.so.1'), libc = koffi.load('libc.so.6')
  const connect = xcb.func('void * xcb_connect(const char *display, _Out_ int *screen)')
  const disconnect = xcb.func('void xcb_disconnect(void *c)')
  const extension = xcb.func('uint32_t xcb_query_extension(void *c, uint16_t length, const char *name)')
  const extensionReply = xcb.func('void * xcb_query_extension_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)')
  const intern = xcb.func('uint32_t xcb_intern_atom(void *c, uint8_t only, uint16_t length, const char *name)')
  const internReply = xcb.func('void * xcb_intern_atom_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)')
  const change = xcb.func('uint32_t xcb_change_property(void *c, uint8_t mode, uint32_t window, uint32_t property, uint32_t type, uint8_t format, uint32_t length, const void *data)')
  const flush = xcb.func('int xcb_flush(void *c)')
  const free = koffi.load(null).func('void free(void *pointer)')
  const copy = libc.func('void * memcpy(void *destination, uintptr_t source, size_t length)')
  const connection = connect(null, [0])
  const reply = (read, cookie) => {
    const error = [null], pointer = read(connection, cookie, error)
    try {
      assert.equal(error[0], null, 'the probe XCB request failed')
      assert.ok(pointer, 'the probe XCB reply is missing')
      const bytes = Buffer.alloc(32)
      copy(bytes, koffi.address(pointer), bytes.length)
      return bytes
    } finally {
      if (error[0]) free(error[0])
      if (pointer) free(pointer)
    }
  }
  try {
    // Check with the core protocol before sending any extension request.
    if (!reply(extensionReply, extension(connection, 10, 'X-Resource'))[8]) {
      console.log('pid via X-Resource: skipped (server has no X-Resource extension)')
      return false
    }
    let res
    try { res = koffi.load('libxcb-res.so.0') } catch {
      console.log('pid via X-Resource: skipped (libxcb-res.so.0 could not be loaded)')
      return false
    }
    const version = res.func('uint32_t xcb_res_query_version(void *c, uint8_t major, uint8_t minor)')
    const versionReply = res.func('void * xcb_res_query_version_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)')
    const supported = reply(versionReply, version(connection, 1, 2))
    if (supported.readUInt16LE(8) < 1 || (supported.readUInt16LE(8) === 1 && supported.readUInt16LE(10) < 2)) {
      console.log('pid via X-Resource: skipped (server needs X-Resource 1.2)')
      return false
    }
    const property = reply(internReply, intern(connection, 0, 11, '_NET_WM_PID')).readUInt32LE(8)
    const value = Buffer.alloc(4)
    value.writeUInt32LE(0x7ffffffe)
    change(connection, 0, id, property, 6, 32, 1, value) // CARDINAL
    assert.ok(flush(connection) > 0, 'the probe PID property was not flushed')
    // A reply ensures the property change is processed before capture reads it.
    reply(internReply, intern(connection, 0, 11, '_NET_WM_PID'))
    return true
  } finally { disconnect(connection) }
}

function monitorLayout() {
  const xcb = koffi.load('libxcb.so.1'), libc = koffi.load('libc.so.6')
  const connect = xcb.func('void * xcb_connect(const char *display, _Out_ int *screen)')
  const disconnect = xcb.func('void xcb_disconnect(void *c)')
  const setup = xcb.func('void * xcb_get_setup(void *c)')
  const extension = xcb.func('uint32_t xcb_query_extension(void *c, uint16_t length, const char *name)')
  const extensionReply = xcb.func('void * xcb_query_extension_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)')
  const geometry = xcb.func('uint32_t xcb_get_geometry(void *c, uint32_t drawable)')
  const geometryReply = xcb.func('void * xcb_get_geometry_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)')
  const free = koffi.load(null).func('void free(void *pointer)')
  const memcpy = libc.func('void * memcpy(void *destination, uintptr_t source, size_t length)')
  const screen = [0], connection = connect(null, screen)
  const copy = (pointer, length) => {
    assert.ok(pointer, 'the monitor probe received no native data')
    const bytes = Buffer.alloc(length)
    memcpy(bytes, koffi.address(pointer), length)
    return bytes
  }
  const reply = (read, cookie) => {
    const error = [null], pointer = read(connection, cookie, error)
    try {
      assert.equal(error[0], null, 'the monitor probe XCB request failed')
      const header = copy(pointer, 32)
      return copy(pointer, 32 + header.readUInt32LE(4) * 4)
    } finally {
      if (error[0]) free(error[0])
      if (pointer) free(pointer)
    }
  }
  try {
    if (!reply(extensionReply, extension(connection, 5, 'RANDR'))[8]) return null
    let randr
    try { randr = koffi.load('libxcb-randr.so.0') } catch { return null }
    const version = randr.func('uint32_t xcb_randr_query_version(void *c, uint32_t major, uint32_t minor)')
    const versionReply = randr.func('void * xcb_randr_query_version_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)')
    const supported = reply(versionReply, version(connection, 1, 5))
    if (supported.readUInt32LE(8) < 1 || (supported.readUInt32LE(8) === 1 && supported.readUInt32LE(12) < 5)) return null
    const pointer = setup(connection), header = copy(pointer, 8)
    const { root } = parseSetup(copy(pointer, 8 + header.readUInt16LE(6) * 4), screen[0])
    const monitors = randr.func('uint32_t xcb_randr_get_monitors(void *c, uint32_t window, uint8_t get_active)')
    const monitorsReply = randr.func('void * xcb_randr_get_monitors_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)')
    const bounds = reply(geometryReply, geometry(connection, root))
    return { monitors: monitorsFrom(reply(monitorsReply, monitors(connection, root, 1))), width: bounds.readUInt16LE(16), height: bounds.readUInt16LE(18) }
  } finally { disconnect(connection) }
}

async function probeMonitorEdge(expected) {
  const layout = monitorLayout()
  const monitor = layout?.monitors.length >= 2 && layout.monitors.find((m) =>
    m.x >= 0 && m.y >= 0 && m.x + m.width <= layout.width && m.y + m.height + 1 <= layout.height
    && m.width >= narrow[0].length
    && layout.monitors.every((other) => other === m || other.x >= m.x + m.width || other.x + other.width <= m.x
      || other.y >= m.y + m.height || other.y + other.height <= m.y))
  if (!monitor) {
    console.log('two-monitor bottom edge: skipped (needs RandR 1.5 and two separate monitors, with room for an extra row inside the root)')
    return
  }
  const bounds = { x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height + 1 }
  const window = new BrowserWindow({ ...bounds, title: title + ' monitor', frame: false, useContentSize: true, enableLargerThanScreen: true, show: false })
  try {
    await window.loadURL('data:text/html,' + encodeURIComponent(`<!doctype html><title>${title} monitor</title>
      <style>body {margin:0;background:black} canvas {display:block}</style><canvas></canvas>
      <script>
      const canvas = document.querySelector('canvas')
      canvas.width = ${monitor.width}; canvas.height = ${monitor.height + 1}
      const ctx = canvas.getContext('2d', { alpha: false })
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      const strip = ctx.createImageData(canvas.width, 1), cells = ${JSON.stringify(narrow[0])}
      for (let i = 0; i < canvas.width; i++) {
        const v = Number(cells[i] || 0)
        strip.data.set([v & 4 ? 255 : 0, v & 2 ? 255 : 0, v & 1 ? 255 : 0, 255], i * 4)
      }
      ctx.putImageData(strip, 0, ${monitor.height - 1})
      </script>`))
    window.setBounds(bounds)
    window.show()
    assert.equal(await window.webContents.executeJavaScript('devicePixelRatio'), 1, 'the monitor probe requires an unscaled X11 display')
    assert.deepEqual(window.getBounds(), bounds, 'the monitor probe window must be one row taller than its monitor')
    const deadline = performance.now() + 5000
    let id = null, row = null
    while (performance.now() < deadline) {
      id ??= capture.findWindow(title + ' monitor')
      if (id !== null) row = capture.readRow(id, 'bottom')
      if (row && decodeRow(row).kind === 'block') break
      await sleep(50)
    }
    assert.notEqual(id, null, 'XCB did not find the monitor probe window')
    const extra = capture.readRect(id, 0, monitor.height, monitor.width, 1)
    assert.ok(extra, 'the extra row must be readable inside the X root')
    assert.ok(extra.rgb.every((value) => value === 0), 'the extra last row must be black')
    assert.ok(row, 'the monitor bottom edge returned no pixels')
    assert.equal(row.length, monitor.width * 4)
    assert.deepEqual(decodeRow(row), decodeRow(expected), 'the monitor bottom edge did not decode the strip above the black row')
    console.log(`two-monitor bottom edge: ok (${monitor.width}x${monitor.height}+${monitor.x}+${monitor.y}, root ${layout.width}x${layout.height})`)
  } finally { window.destroy() }
}

async function probe() {
  process.env.TWINMAP_CAPTURE_TEST_PROGRAM = realpathSync(process.execPath)
  const window = new BrowserWindow({ title, width: 900, height: 160, frame: false, useContentSize: true })
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
    id ??= capture.findGameWindow() ?? capture.findWindow(title)
    if (id !== null) row = capture.readRow(id, 'top')
    if (row && decodeRow(row).kind === 'block') break
    await sleep(50)
  }
  assert.notEqual(id, null, 'XCB did not find the probe window by program or title')
  assert.ok(row, 'XCB provided no row within 5 seconds; check DISPLAY and the X11 capture log')
  const decoded = decodeRow(row)
  assert.equal(decoded.kind, 'block', 'the top row did not decode the strip fixture')
  const expected = Buffer.from(Array.from(narrow[0], Number).flatMap((v) => [v & 1 ? 255 : 0, v & 2 ? 255 : 0, v & 4 ? 255 : 0, 255]))
  assert.deepEqual(decoded, decodeRow(expected))
  assert.equal(capture.windowState(id), 'open')
  if (replacePid(id)) {
    assert.equal(realpathSync(capture.programOf(id)), realpathSync(process.execPath))
    assert.equal(capture.findGameWindow(), id)
    assert.equal(capture.findWindow(title), id)
    console.log('pid via X-Resource: ok')
  }
  console.log(`window ${id}, executable: ${capture.programOf(id)}, state: ${capture.windowState(id)}`)
  console.log(`first frame: ${(performance.now() - started).toFixed(1)} ms after startup`)
  console.log(`decoded strip: ${JSON.stringify(decoded)}`)

  let elapsed = 0
  for (let i = 0; i < 100; i++) {
    const before = performance.now()
    const top = capture.readRow(id, 'top')
    elapsed += performance.now() - before
    assert.ok(top, `row read ${i + 1} returned no pixels`)
    assert.equal(decodeRow(top).kind, 'block')
    await sleep(15)
  }
  console.log(`100 row reads: mean ${(elapsed / 100).toFixed(3)} ms`)
  const bottom = capture.readRow(id, 'bottom'), left = capture.readRow(id, 'left'), right = capture.readRow(id, 'right')
  assert.ok(bottom)
  assert.ok(left)
  assert.ok(right)
  assert.equal(bottom.length, row.length)
  const middle = Math.floor(bottom.length / 8) * 4
  assert.deepEqual([...bottom.subarray(middle, middle + 3)], [0, 255, 0])
  for (const column of [left, right]) {
    assert.deepEqual([...column.subarray(4, 7)], [32, 64, 128])
    assert.deepEqual([...column.subarray(-4, -1)], [0, 255, 0])
  }
  const rect = capture.readRect(id, 8, 8, 1, 1, true), box = capture.readBox(id, 8, 8, 1)
  assert.ok(rect, 'the interior rectangle returned no pixels')
  assert.ok(box, 'the interior box returned no pixels')
  assert.deepEqual([...rect.rgb], [128, 64, 32])
  assert.deepEqual([...box.rgb], [128, 64, 32])
  assert.equal(capture.showsOnly(id, 8, 8, 1), true)
  assert.equal(capture.showsOnly(id, -1, 0, 1), false)
  assert.equal(capture.readRow(0x7ffffff0), null)
  assert.equal(capture.windowState(0x7ffffff0), 'gone')
  window.destroy()
  await sleep(150)
  assert.equal(capture.windowState(id), 'gone')
  assert.equal(capture.readRow(id), null)
  await probeMonitorEdge(expected)
}

app.whenReady().then(probe).then(
  () => { capture.stopCapture(); app.quit() },
  (error) => { console.error(`Linux capture probe: ${error.message}`); capture.stopCapture(); app.exit(1) },
)
