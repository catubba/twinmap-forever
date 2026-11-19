// A rectangle of a screen that is in HDR, read in floating point, where the reading at 8 bits of
// capture.ts comes out burnt (shared/hdr.ts says why). Windows gives the desktop as it lays it out
// (DXGI desktop duplication) at 16 bits a channel; the rectangle is copied off it and given back
// as the game drew it, three bytes a pixel.
//
// This runs as a process of its own (main/hdr.ts starts it for one reading and ends it): these are
// calls into Direct3D by hand, where a mistake ends the process rather than throwing. Here that
// costs one picture, which is then kept as the reading at 8 bits gave it.
import koffi from 'koffi'
import { autoHdr, fromHdr } from '../shared/hdr'

/** What is asked: a rectangle of the desktop, in pixels of the screens, and what the reading at 8 bits gave there (three bytes a pixel). */
export interface HdrAsk {
  x: number
  y: number
  width: number
  height: number
  seen: Uint8Array
}

koffi.struct('Mapped', { data: 'void *', rowPitch: 'uint32_t', depthPitch: 'uint32_t' })
const user32 = koffi.load('user32.dll'), d3d11 = koffi.load('d3d11.dll'), dxgi = koffi.load('dxgi.dll')
const SetProcessDpiAwarenessContext = user32.func('int __stdcall SetProcessDpiAwarenessContext(intptr_t context)')
const GetDisplayConfigBufferSizes = user32.func('long __stdcall GetDisplayConfigBufferSizes(uint32_t flags, _Out_ uint32_t *paths, _Out_ uint32_t *modes)')
const QueryDisplayConfig = user32.func('long __stdcall QueryDisplayConfig(uint32_t flags, _Inout_ uint32_t *paths, void *pathArray, _Inout_ uint32_t *modes, void *modeArray, void *topology)')
const DisplayConfigGetDeviceInfo = user32.func('long __stdcall DisplayConfigGetDeviceInfo(void *packet)')
const CreateDXGIFactory1 = dxgi.func('int __stdcall CreateDXGIFactory1(void *iid, _Out_ void **factory)')
const D3D11CreateDevice = d3d11.func('int __stdcall D3D11CreateDevice(void *adapter, int type, void *software, uint32_t flags, void *levels, uint32_t count, uint32_t sdk, _Out_ void **device, void *level, _Out_ void **context)')

// The methods called, as they stand in the tables of their interfaces (dxgi.h, dxgi1_2.h, dxgi1_5.h, dxgi1_6.h, d3d11.h).
const QUERY = 0, RELEASE = 2
const ENUM_ADAPTERS = 7, ENUM_OUTPUTS = 7, DUPLICATE_OUTPUT1 = 26, GET_DESC1 = 27
const ACQUIRE_NEXT_FRAME = 8, RELEASE_FRAME = 14
const CREATE_TEXTURE_2D = 5, MAP = 14, UNMAP = 15, COPY_SUBRESOURCE_REGION = 46
const IID_FACTORY1 = '770aae78-f26f-4dba-a829-253c83d1b387', IID_OUTPUT6 = '068346e8-aaec-4b84-add7-137f513f77a1', IID_TEXTURE_2D = '6f15aaf2-d208-4e89-9ab4-489535d34f9c'
const HALF_FLOATS = 10 // DXGI_FORMAT_R16G16B16A16_FLOAT
const HDR = 12 // DXGI_COLOR_SPACE_RGB_FULL_G2084_NONE_P2020: the screen is in HDR
const UPRIGHT = 1 // DXGI_MODE_ROTATION_IDENTITY
const WAIT_TIMEOUT = 0x887a0027 | 0 // DXGI_ERROR_WAIT_TIMEOUT

const proto = {
  query: koffi.proto('int __stdcall HdrQuery(void *self, void *iid, _Out_ void **out)'),
  release: koffi.proto('uint32_t __stdcall HdrRelease(void *self)'),
  nth: koffi.proto('int __stdcall HdrNth(void *self, uint32_t index, _Out_ void **out)'),
  desc: koffi.proto('int __stdcall HdrDesc(void *self, void *desc)'),
  duplicate: koffi.proto('int __stdcall HdrDuplicate(void *self, void *device, uint32_t flags, uint32_t count, void *formats, _Out_ void **out)'),
  acquire: koffi.proto('int __stdcall HdrAcquire(void *self, uint32_t timeout, void *info, _Out_ void **resource)'),
  frame: koffi.proto('int __stdcall HdrFrame(void *self)'),
  texture: koffi.proto('int __stdcall HdrTexture(void *self, void *desc, void *initial, _Out_ void **out)'),
  copy: koffi.proto('void __stdcall HdrCopy(void *self, void *to, uint32_t toSub, uint32_t x, uint32_t y, uint32_t z, void *from, uint32_t fromSub, void *box)'),
  map: koffi.proto('int __stdcall HdrMap(void *self, void *resource, uint32_t sub, uint32_t type, uint32_t flags, _Out_ Mapped *mapped)'),
  unmap: koffi.proto('void __stdcall HdrUnmap(void *self, void *resource, uint32_t sub)'),
}
type Com = unknown // an object of Windows, held by its address

/** A method of an object of Windows, by its place in the table. */
const call = (object: Com, index: number, type: ReturnType<typeof koffi.proto>, ...args: unknown[]): number =>
  koffi.call(koffi.decode(koffi.decode(object, 'void *'), index * 8, 'void *'), type, object, ...args) as number

const guid = (text: string): Buffer => {
  const hex = text.replace(/-/g, ''), bytes = Buffer.alloc(16)
  bytes.writeUInt32LE(parseInt(hex.slice(0, 8), 16), 0)
  bytes.writeUInt16LE(parseInt(hex.slice(8, 12), 16), 4)
  bytes.writeUInt16LE(parseInt(hex.slice(12, 16), 16), 6)
  Buffer.from(hex.slice(16), 'hex').copy(bytes, 8)
  return bytes
}
const words = (...values: number[]): Buffer => {
  const bytes = Buffer.alloc(values.length * 4)
  values.forEach((v, i) => bytes.writeUInt32LE(v, i * 4))
  return bytes
}

/** What Windows tells for plain white on the screen of this name (\\.\DISPLAY1), in times the standard's 80 nits; null when it will not say. */
function whiteOf(screen: string): number | null {
  const paths = [0], modes = [0]
  if (GetDisplayConfigBufferSizes(2, paths, modes)) return null // 2: the paths in use only
  const pathArray = Buffer.alloc(72 * paths[0]!), modeArray = Buffer.alloc(64 * modes[0]!)
  if (QueryDisplayConfig(2, paths, pathArray, modes, modeArray, null)) return null
  for (let i = 0; i < paths[0]!; i++) {
    const path = pathArray.subarray(i * 72, i * 72 + 72)
    const name = Buffer.alloc(84) // DISPLAYCONFIG_SOURCE_DEVICE_NAME
    words(1, 84).copy(name)
    path.copy(name, 8, 0, 12) // the adapter and the id of the source
    if (DisplayConfigGetDeviceInfo(name) || name.toString('utf16le', 20, 84).replace(/\0[^]*$/, '') !== screen) continue
    const white = Buffer.alloc(24) // DISPLAYCONFIG_SDR_WHITE_LEVEL
    words(11, 24).copy(white)
    path.copy(white, 8, 20, 32) // the adapter and the id of the target
    return DisplayConfigGetDeviceInfo(white) ? null : white.readUInt32LE(20) / 1000
  }
  return null
}

/** Half floats as numbers, by a table of the 65536 there are. */
function halves(): Float32Array {
  const table = new Float32Array(65536)
  for (let i = 0; i < 65536; i++) {
    const exponent = (i >> 10) & 31, rest = i & 1023
    table[i] = (i & 0x8000 ? -1 : 1) * (exponent === 0 ? rest * 2 ** -24 : exponent === 31 ? (rest ? NaN : Infinity) : (1 + rest / 1024) * 2 ** (exponent - 15))
  }
  return table
}

/**
 * The rectangle as the game drew it, or null: when its screen is not in HDR or shows the game as it
 * drew itself (the reading at 8 bits is then right as it is), when the rectangle is not whole on one
 * upright screen, and when Windows refuses any step.
 */
export function readHdrRect(ask: HdrAsk): { width: number; height: number; rgb: Uint8Array } | null {
  const { x, y, width, height, seen } = ask
  if (![x, y, width, height].every(Number.isInteger) || width <= 0 || height <= 0 || width > 8192 || height > 8192 || !(seen instanceof Uint8Array) || seen.length !== width * height * 3) return null
  SetProcessDpiAwarenessContext(-4) // per monitor, version 2: the duplication in floating point asks for it. Already so in Electron.
  const held: Com[] = [] // let go at the end, the last first
  const got = (hr: number, out: [Com]): Com | null => (hr < 0 || !out[0] ? null : (held.push(out[0]), out[0]))
  try {
    const out = (): [Com] => [null]
    let o = out()
    const factory = got(CreateDXGIFactory1(guid(IID_FACTORY1), o), o)
    if (!factory) return null
    // The screen the rectangle is on, and the graphics card that draws it.
    let adapter: Com = null, output: Com = null, left = 0, top = 0, plain = 0
    for (let a = 0; !output; a++) {
      const card = got(call(factory, ENUM_ADAPTERS, proto.nth, a, (o = out())), o)
      if (!card) break
      for (let n = 0; !output; n++) {
        const one = got(call(card, ENUM_OUTPUTS, proto.nth, n, (o = out())), o)
        if (!one) break
        const six = got(call(one, QUERY, proto.query, guid(IID_OUTPUT6), (o = out())), o)
        const desc = Buffer.alloc(152) // DXGI_OUTPUT_DESC1
        if (!six || call(six, GET_DESC1, proto.desc, desc) < 0) continue
        const l = desc.readInt32LE(64), t = desc.readInt32LE(68), r = desc.readInt32LE(72), b = desc.readInt32LE(76)
        if (x < l || y < t || x + width > r || y + height > b) continue
        if (desc.readUInt32LE(84) !== UPRIGHT || desc.readUInt32LE(100) !== HDR) return null
        const white = whiteOf(desc.toString('utf16le', 0, 64).replace(/\0[^]*$/, ''))
        if (!white) return null
        adapter = card
        output = six
        left = l
        top = t
        plain = white
      }
    }
    if (!adapter || !output) return null
    const device = out(), context = out()
    if (D3D11CreateDevice(adapter, 0, null, 0, null, 0, 7, device, null, context) < 0) return null
    held.push(device[0], context[0])
    const duplication = got(call(output, DUPLICATE_OUTPUT1, proto.duplicate, device[0], 0, 1, words(HALF_FLOATS), (o = out())), o)
    if (!duplication) return null
    // A texture the processor may read, as large as the rectangle: usage staging (3), read access (0x20000).
    const staging = got(call(device[0], CREATE_TEXTURE_2D, proto.texture, words(width, height, 1, 1, HALF_FLOATS, 1, 0, 3, 0, 0x20000, 0), null, (o = out())), o)
    if (!staging) return null
    // The first frames may carry the pointer alone: the one with a picture has the time it was shown.
    // On a screen where nothing moves none comes in the time given: asked again.
    const info = Buffer.alloc(48)
    let frame: Com = null
    for (let tries = 0; tries < 10 && !frame; tries++) {
      const resource = out()
      const hr = call(duplication, ACQUIRE_NEXT_FRAME, proto.acquire, 300, info, resource)
      if (hr === WAIT_TIMEOUT) continue
      if (hr < 0) return null
      if (info.readBigInt64LE(0) !== 0n) frame = resource[0]
      else {
        call(resource[0], RELEASE, proto.release)
        call(duplication, RELEASE_FRAME, proto.frame)
      }
    }
    if (!frame) return null
    held.push(frame)
    const texture = got(call(frame, QUERY, proto.query, guid(IID_TEXTURE_2D), (o = out())), o)
    if (!texture) return null
    call(context[0], COPY_SUBRESOURCE_REGION, proto.copy, staging, 0, 0, 0, 0, texture, 0, words(x - left, y - top, 0, x - left + width, y - top + height, 1))
    call(duplication, RELEASE_FRAME, proto.frame)
    const mapped = {} as { data: unknown; rowPitch: number }
    if (call(context[0], MAP, proto.map, staging, 0, 1, 0, mapped) < 0) return null
    // Copied and let go at once: nothing of ours is done while the card's memory is held.
    const pitch = mapped.rowPitch >> 1
    const half = koffi.decode(mapped.data, koffi.array('uint16_t', pitch * height, 'Typed')) as Uint16Array
    call(context[0], UNMAP, proto.unmap, staging, 0)
    const table = halves(), light = new Float32Array(width * height * 3)
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const from = row * pitch + col * 4, to = (row * width + col) * 3
        light[to] = table[half[from]!]!
        light[to + 1] = table[half[from + 1]!]!
        light[to + 2] = table[half[from + 2]!]!
      }
    }
    return autoHdr(light, seen, plain) ? { width, height, rgb: fromHdr(light, plain) } : null
  } finally {
    for (const object of held.reverse()) call(object, RELEASE, proto.release)
  }
}

// As the process main/hdr.ts starts: one rectangle asked, one answer, and it is ended from there.
process.parentPort?.once('message', (event: { data: HdrAsk }) => {
  let read: ReturnType<typeof readHdrRect> = null
  try {
    read = readHdrRect(event.data)
  } catch {
    // no picture from here: the one read at 8 bits is kept
  }
  process.parentPort.postMessage(read)
})
