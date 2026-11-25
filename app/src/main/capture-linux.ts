// XCB reports errors per request, so a game closing during a read cannot end the app.
import { readFileSync, readlinkSync, realpathSync } from 'node:fs'
import { endianness } from 'node:os'
import { app } from 'electron'
import koffi, { type LibraryHandle } from 'koffi'
import type { Edge, WindowHandle } from './capture'
import { clientPidFrom, commandLine, inWindow, isGame, parseSetup, programFrom, rgbFrom, stateOf, edgeRect, wineProgramPath } from './capture-linux-frame'

type NativeFunction = ReturnType<LibraryHandle['func']>
// Keep Koffi's pointer value for native calls/free; only addresses support arithmetic.
type NativePointer = bigint | object

function bindRes() {
  const res = koffi.load('libxcb-res.so.0')
  return {
    version: res.func('uint32_t xcb_res_query_version(void *c, uint8_t major, uint8_t minor)'),
    versionReply: res.func('void * xcb_res_query_version_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
    ids: res.func('uint32_t xcb_res_query_client_ids(void *c, uint32_t count, const void *specs)'),
    idsReply: res.func('void * xcb_res_query_client_ids_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
  }
}

function bind() {
  const xcb = koffi.load('libxcb.so.1'), libc = koffi.load('libc.so.6')
  // XCB sequence-only cookies use the uint32_t ABI on x86-64 SysV and AArch64.
  koffi.opaque('TwinmapXcbError')
  return {
    connect: xcb.func('void * xcb_connect(const char *display, _Out_ int *screen)'),
    disconnect: xcb.func('void xcb_disconnect(void *c)'),
    hasError: xcb.func('int xcb_connection_has_error(void *c)'),
    setup: xcb.func('void * xcb_get_setup(void *c)'),
    extension: xcb.func('uint32_t xcb_query_extension(void *c, uint16_t length, const char *name)'),
    extensionReply: xcb.func('void * xcb_query_extension_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
    intern: xcb.func('uint32_t xcb_intern_atom(void *c, uint8_t only, uint16_t length, const char *name)'),
    internReply: xcb.func('void * xcb_intern_atom_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
    property: xcb.func('uint32_t xcb_get_property(void *c, uint8_t remove, uint32_t window, uint32_t property, uint32_t type, uint32_t offset, uint32_t length)'),
    propertyReply: xcb.func('void * xcb_get_property_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
    tree: xcb.func('uint32_t xcb_query_tree(void *c, uint32_t window)'),
    treeReply: xcb.func('void * xcb_query_tree_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
    attributes: xcb.func('uint32_t xcb_get_window_attributes(void *c, uint32_t window)'),
    attributesReply: xcb.func('void * xcb_get_window_attributes_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
    geometry: xcb.func('uint32_t xcb_get_geometry(void *c, uint32_t drawable)'),
    geometryReply: xcb.func('void * xcb_get_geometry_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
    translate: xcb.func('uint32_t xcb_translate_coordinates(void *c, uint32_t source, uint32_t destination, int16_t x, int16_t y)'),
    translateReply: xcb.func('void * xcb_translate_coordinates_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
    check: xcb.func('TwinmapXcbError * xcb_request_check(void *c, uint32_t cookie)'),
    select: xcb.func('uint32_t xcb_change_window_attributes_checked(void *c, uint32_t window, uint32_t mask, const uint32_t *values)'),
    event: xcb.func('void * xcb_poll_for_event(void *c)'),
    image: xcb.func('uint32_t xcb_get_image(void *c, uint8_t format, uint32_t drawable, int16_t x, int16_t y, uint16_t width, uint16_t height, uint32_t planes)'),
    imageReply: xcb.func('void * xcb_get_image_reply(void *c, uint32_t cookie, _Out_ TwinmapXcbError **error)'),
    // Electron/Chromium replaces the allocator; replies must return to the allocator libxcb used.
    free: koffi.load(null).func('void free(void *pointer)'),
    // Electron cannot expose foreign memory as an ArrayBuffer. All replies are copied before free.
    copy: libc.func('void * memcpy(void *destination, uintptr_t source, size_t length)'),
    connection: null as NativePointer | null, root: 0,
    res: undefined as boolean | undefined,
    formatsByDepth: new Map<number, { bits: number; pad: number }>(),
    visualsById: new Map<number, { depth: number; trueColor: boolean }>(),
    atoms: new Map<string, number>(),
  }
}
type Native = ReturnType<typeof bind>
type WindowInfo = { id: number; width: number; height: number; x: number; y: number; depth: number; visual: number; state: 'minimized' | 'open'; edges: ReturnType<typeof edgeRect> }
let native: Native | undefined, bindings: Native | undefined, tried = false
let resBindings: ReturnType<typeof bindRes> | null | undefined
let checked: { id: number; until: number; info: WindowInfo | null } | undefined
const problems = new Set<string>()

function problem(message: string): void {
  if (problems.has(message)) return
  problems.add(message)
  console.error(`Twinmap capture: ${message}`)
}

function copy(n: Native, pointer: NativePointer | null, length: number, offset = 0): Buffer {
  const bytes = Buffer.alloc(length)
  if (length) {
    if (pointer === null) throw new Error('X11 returned a null data pointer')
    n.copy(bytes, koffi.address(pointer) + BigInt(offset), length)
  }
  return bytes
}

function reply(n: Native, read: NativeFunction, cookie: number): Buffer | null {
  // Koffi documents a one-element array for an _Out_ pointer-to-pointer.
  const error: [NativePointer | null] = [null]
  const pointer = read(n.connection, cookie, error) as NativePointer | null
  try {
    if (error[0] || !pointer) return null
    const header = copy(n, pointer, 32), length = header.readUInt32LE(4) * 4
    return length ? Buffer.concat([header, copy(n, pointer, length, 32)]) : header
  } finally {
    if (error[0]) n.free(error[0])
    if (pointer) n.free(pointer)
  }
}

function succeeds(n: Native, cookie: number): boolean {
  const error = n.check(n.connection, cookie)
  if (!error) return !n.hasError(n.connection)
  n.free(error)
  return false
}

function connection(): Native | undefined {
  if (tried) {
    if (native?.hasError(native.connection)) {
      problem('the X11 connection was closed')
      stopCapture()
    }
    return native
  }
  tried = true
  let n: Native | undefined
  try {
    if (!process.env.DISPLAY) throw new Error('DISPLAY is not set; an X11 or XWayland display is required')
    if (endianness() !== 'LE') throw new Error('only little-endian X11 clients are supported')
    n = bindings ??= bind()
    n.res = undefined
    n.atoms.clear()
    n.formatsByDepth.clear()
    n.visualsById.clear()
    const screen = [0]
    n.connection = n.connect(null, screen)
    if (!n.connection || n.hasError(n.connection)) throw new Error('could not connect to the X11 display')
    const setup = n.setup(n.connection), header = copy(n, setup, 8)
    const parsed = parseSetup(copy(n, setup, 8 + 4 * header.readUInt16LE(6)), screen[0]!)
    if (parsed.imageByteOrder !== 0) throw new Error('only little-endian X11 BGRX pixels are supported')
    n.root = parsed.root
    n.formatsByDepth = parsed.formatsByDepth
    n.visualsById = parsed.visualsById
    native = n
    return n
  } catch (error) {
    if (n?.connection) {
      n.disconnect(n.connection)
      n.connection = null
    }
    problem(error instanceof Error ? error.message : String(error))
    return undefined
  }
}

function atom(n: Native, name: string): number {
  if (!n.atoms.has(name)) {
    const value = reply(n, n.internReply, n.intern(n.connection, 0, Buffer.byteLength(name), name))
    n.atoms.set(name, value?.readUInt32LE(8) ?? 0)
  }
  return n.atoms.get(name)!
}

function property(n: Native, id: number, name: string, format: number): Buffer | null {
  const value = reply(n, n.propertyReply, n.property(n.connection, 0, id, atom(n, name), 0, 0, 65536))
  if (!value || value[1] !== format) return null
  return value.subarray(32, 32 + value.readUInt32LE(16) * (format / 8))
}

const numbers = (value: Buffer | null): number[] => value ? Array.from({ length: Math.floor(value.length / 4) }, (_, i) => value.readUInt32LE(i * 4)) : []

function windows(n: Native): number[] {
  const list = property(n, n.root, '_NET_CLIENT_LIST', 32)
  if (list) return numbers(list)
  // A bare X server, as in the probe, has no window manager to publish the EWMH list.
  const tree = reply(n, n.treeReply, n.tree(n.connection, n.root))
  return tree ? numbers(tree.subarray(32, 32 + tree.readUInt16LE(16) * 4)) : []
}

function clientPid(n: Native, id: number): number | null {
  if (n.res === undefined) {
    n.res = false
    try {
      // Sending an unsupported extension request closes the XCB connection.
      const present = reply(n, n.extensionReply, n.extension(n.connection, 10, 'X-Resource'))
      if (present?.[8]) {
        if (resBindings === undefined) {
          resBindings = null // Remember a load failure across connections.
          resBindings = bindRes()
        }
        if (resBindings) {
          const version = reply(n, resBindings.versionReply, resBindings.version(n.connection, 1, 2))
          n.res = !!version && (version.readUInt16LE(8) > 1 || (version.readUInt16LE(8) === 1 && version.readUInt16LE(10) >= 2))
        }
      }
    } catch {}
    if (!n.res) problem('X-Resource is not available; window PIDs come from _NET_WM_PID')
  }
  try {
    if (n.res && resBindings) {
      const spec = Buffer.alloc(8)
      spec.writeUInt32LE(id)
      spec.writeUInt32LE(2, 4)
      const value = reply(n, resBindings.idsReply, resBindings.ids(n.connection, 1, spec))
      return value ? clientPidFrom(value) : null
    }
  } catch {}
  return null
}

function processOf(n: Native, id: number): { pid: number; args: string[]; executable: string | null } {
  // A Flatpak game reports its namespace PID. The X server sees the host PID.
  let pid = clientPid(n, id) ?? 0
  let args: string[] = [], executable: string | null = null
  if (pid) {
    try { args = commandLine(readFileSync(`/proc/${pid}/cmdline`)) } catch {}
  }
  if (!args.length) {
    const value = property(n, id, '_NET_WM_PID', 32)
    const fallback = value && value.length >= 4 ? value.readUInt32LE(0) : 0
    if (fallback && fallback !== pid) {
      let fallbackArgs: string[] = []
      try { fallbackArgs = commandLine(readFileSync(`/proc/${fallback}/cmdline`)) } catch {}
      if (!pid || fallbackArgs.length) {
        pid = fallback
        args = fallbackArgs
      }
    }
  }
  if (pid) {
    try { executable = readlinkSync(`/proc/${pid}/exe`) } catch {}
  }
  return { pid, args, executable }
}

export function findWindow(title: string): WindowHandle | null {
  const n = connection()
  if (!n) return null
  return windows(n).find((id) => {
    const name = property(n, id, '_NET_WM_NAME', 8)
    return (name?.toString('utf8') ?? property(n, id, 'WM_NAME', 8)?.toString('latin1')) === title
  }) ?? null
}

export function programOf(window: WindowHandle): string | null {
  const n = connection()
  if (!n) return null
  const { pid, args, executable } = processOf(n, Number(window))
  const program = programFrom(args, executable)
  if (!program || !/^[a-z]:[\\/]/i.test(program)) return program
  let environment: Buffer | null = null
  try { environment = readFileSync(`/proc/${pid}/environ`) } catch {}
  return wineProgramPath(program, environment, realpathSync)
}

function windowOf(matches: (n: Native, id: number) => boolean, includeMinimized = false): WindowHandle | null {
  const n = connection()
  if (!n) return null
  let minimized: number | null = null
  for (const id of windows(n)) {
    if (!matches(n, id)) continue
    const attributes = reply(n, n.attributesReply, n.attributes(n.connection, id))
    if (!attributes) continue
    const state = stateOf(attributes[26]!, numbers(property(n, id, '_NET_WM_STATE', 32)), atom(n, '_NET_WM_STATE_HIDDEN'))
    if (state === 'open') return id
    if (includeMinimized) minimized ??= id
  }
  return minimized
}

export const findWindowOf = (program: RegExp): WindowHandle | null => windowOf((n, id) => {
  const { args, executable } = processOf(n, id)
  program.lastIndex = 0
  return program.test(programFrom(args, executable) ?? '')
})

export function findGameWindow(): WindowHandle | null {
  const test = !app.isPackaged && process.env.TWINMAP_CAPTURE_TEST_PROGRAM
  return windowOf((n, id) => {
    const { args, executable } = processOf(n, id)
    return test ? executable === test || programFrom(args, executable) === test
      : isGame(args, executable, property(n, id, 'WM_CLASS', 8)?.toString('utf8').split('\0') ?? [])
  }, true)
}

function windowInfo(n: Native, id: number): WindowInfo | null {
  let event: NativePointer | null
  while ((event = n.event(n.connection))) {
    try {
      const bytes = copy(n, event, 32), type = bytes[0]! & 0x7f
      if ([17, 18, 19, 22].includes(type) && checked?.id === bytes.readUInt32LE(8)) {
        checked = undefined
      }
    } finally { n.free(event) }
  }
  const now = performance.now()
  if (checked?.id === id && checked.until > now) return checked.info
  if (checked?.id !== id) succeeds(n, n.select(n.connection, id, 1 << 11, [1 << 17])) // StructureNotify
  const attributes = reply(n, n.attributesReply, n.attributes(n.connection, id))
  const geometry = attributes && reply(n, n.geometryReply, n.geometry(n.connection, id))
  const origin = geometry && reply(n, n.translateReply, n.translate(n.connection, id, n.root, 0, 0))
  const root = origin && reply(n, n.geometryReply, n.geometry(n.connection, n.root))
  const state = stateOf(attributes?.[26] ?? null, numbers(property(n, id, '_NET_WM_STATE', 32)), atom(n, '_NET_WM_STATE_HIDDEN'))
  const bounds = geometry && origin && {
    width: geometry.readUInt16LE(16), height: geometry.readUInt16LE(18), x: origin.readInt16LE(12), y: origin.readInt16LE(14),
  }
  const info: WindowInfo | null = bounds && state !== 'gone' ? {
    ...bounds, id, depth: geometry![1]!, visual: attributes!.readUInt32LE(8), state,
    edges: root ? edgeRect(bounds, root.readUInt16LE(16), root.readUInt16LE(18)) : null,
  } : null
  checked = { id, until: now + 100, info }
  return info
}

export function windowState(window: WindowHandle): 'gone' | 'minimized' | 'open' {
  const n = connection()
  return n ? windowInfo(n, Number(window))?.state ?? 'gone' : 'gone'
}

function pixels(n: Native, info: WindowInfo, x: number, y: number, width: number, height: number): Buffer | null {
  if (info.state !== 'open' || !inWindow(info.width, info.height, x, y, width, height) || x > 32767 || y > 32767) return null
  const format = n.formatsByDepth.get(info.depth), visual = n.visualsById.get(info.visual)
  if (![24, 32].includes(info.depth) || format?.bits !== 32 || format.pad !== 32 || !visual?.trueColor || visual.depth !== info.depth) {
    problem('only 24/32-bit TrueColor X11 visuals with little-endian BGRX pixels are supported')
    return null
  }
  // Read the window's current backing contents, including when redirected by a compositor.
  // Window drawable coordinates start inside the border; no border offset is added.
  const image = reply(n, n.imageReply, n.image(n.connection, 2, info.id, x, y, width, height, 0xffffffff)) // ZPixmap
  if (!image) {
    checked = undefined
    return null
  }
  if (image[1] !== info.depth || image.length - 32 !== width * height * 4) return null
  return image.subarray(32)
}

function owns(n: Native, info: WindowInfo, x: number, y: number, width: number, height: number, dense = false): boolean {
  if (info.state !== 'open' || !inWindow(info.width, info.height, x, y, width, height)) return false
  // Ownership requires the game frame to be above every sample, with or without a compositor.
  let frame = info.id
  for (let i = 0; i < 32; i++) {
    const tree = reply(n, n.treeReply, n.tree(n.connection, frame))
    if (!tree) return false
    const parent = tree.readUInt32LE(12)
    if (parent === n.root) break
    if (!parent || i === 31) return false
    frame = parent
  }
  const points = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1], [width >> 1, height >> 1]]
  if (dense) {
    const step = Math.max(1, Math.floor(Math.min(width, height) / 16))
    for (let dy = 0; dy < height; dy += step) for (let dx = 0; dx < width; dx += step) points.push([dx, dy])
  }
  return points.every(([dx, dy]) => {
    const at = reply(n, n.translateReply, n.translate(n.connection, n.root, n.root, info.x + x + dx!, info.y + y + dy!))
    return !!at?.[1] && at.readUInt32LE(8) === frame
  })
}

export function readRect(window: WindowHandle, x: number, y: number, width: number, height: number, own = false): { width: number; height: number; rgb: Uint8Array; at: { x: number; y: number } } | null {
  const n = connection(), info = n && windowInfo(n, Number(window))
  if (!n || !info || (own && !owns(n, info, x, y, width, height))) return null
  const read = pixels(n, info, x, y, width, height)
  return read && { width, height, rgb: rgbFrom(read), at: { x: info.x + x, y: info.y + y } }
}

export function readBox(window: WindowHandle, x: number, y: number, size: number): { size: number; rgb: Uint8Array } | null {
  const read = readRect(window, x, y, size, size)
  return read && { size, rgb: read.rgb }
}

export function showsOnly(window: WindowHandle, x: number, y: number, size: number): boolean {
  const n = connection(), info = n && windowInfo(n, Number(window))
  return !!n && !!info && owns(n, info, x, y, size, size, true)
}

export function readRow(window: WindowHandle, edge: Edge = 'top'): Buffer | null {
  const n = connection(), info = n && windowInfo(n, Number(window))
  if (!n || !info?.edges) return null
  // Fullscreen Wine adds a black row below the screen, so take the edge from the part that fits the screen.
  const { x, y, width, height } = info.edges
  const side = edge === 'left' || edge === 'right'
  return pixels(n, info, edge === 'right' ? x + width - 1 : x, edge === 'bottom' ? y + height - 1 : y, side ? 1 : width, side ? height : 1)
}

export function stopCapture(): void {
  if (native) {
    native.disconnect(native.connection)
    native.connection = null
    native = undefined
  }
  checked = undefined
  tried = false
}
