import { expect, test, vi } from 'vitest'
import { clientPidFrom, commandLine, inWindow, isGame, monitorsFrom, monitorEdgeRect, parseSetup, programFrom, rgbFrom, stateOf, edgeRect, wineProgramPath } from './capture-linux-frame'
import type { Rect } from '../shared/window'

function monitorReply(monitors: (Rect & { outputs?: number[] })[]): Buffer {
  const bytes = Buffer.alloc(32 + monitors.reduce((size, monitor) => size + 24 + (monitor.outputs?.length ?? 0) * 4, 0))
  bytes[0] = 1
  bytes.writeUInt32LE((bytes.length - 32) / 4, 4)
  bytes.writeUInt32LE(1234, 8) // timestamp, not nMonitors
  bytes.writeUInt32LE(monitors.length, 12)
  bytes.writeUInt32LE(monitors.reduce((count, monitor) => count + (monitor.outputs?.length ?? 0), 0), 16)
  let offset = 32
  for (const [i, monitor] of monitors.entries()) {
    const outputs = monitor.outputs ?? []
    bytes.writeUInt32LE(100 + i, offset)
    bytes[offset + 4] = i === 0 ? 1 : 0
    bytes[offset + 5] = 1
    bytes.writeUInt16LE(outputs.length, offset + 6)
    bytes.writeInt16LE(monitor.x, offset + 8)
    bytes.writeInt16LE(monitor.y, offset + 10)
    bytes.writeUInt16LE(monitor.width, offset + 12)
    bytes.writeUInt16LE(monitor.height, offset + 14)
    bytes.writeUInt32LE(600, offset + 16)
    bytes.writeUInt32LE(340, offset + 20)
    outputs.forEach((output, j) => bytes.writeUInt32LE(output, offset + 24 + j * 4))
    offset += 24 + outputs.length * 4
  }
  return bytes
}

test('parses one or two RandR monitors, including signed origins and variable output lists', () => {
  const first = { x: -1920, y: -100, width: 1920, height: 1080 }
  const second = { x: 0, y: 0, width: 3840, height: 2160 }
  expect(monitorsFrom(monitorReply([]))).toEqual([])
  expect(monitorsFrom(monitorReply([first]))).toEqual([first])
  expect(monitorsFrom(monitorReply([first, second]))).toEqual([first, second])
  expect(monitorsFrom(monitorReply([{ ...first, outputs: [41, 42] }, { ...second, outputs: [43] }]))).toEqual([first, second])
})

test('rejects the entire malformed or truncated RandR monitor reply', () => {
  const bytes = monitorReply([{ x: 0, y: 0, width: 1920, height: 1080, outputs: [41, 42] }])
  for (let length = 0; length < bytes.length; length++) expect(monitorsFrom(bytes.subarray(0, length))).toEqual([])
  for (const [offset, value] of [[0, 0], [4, 0xffffffff], [4, 0], [12, 0], [12, 2], [12, 0xffffffff], [16, 1], [38, 3], [44, 0]]) {
    const malformed = Buffer.from(bytes)
    malformed.writeUInt32LE(value!, offset!)
    expect(monitorsFrom(malformed)).toEqual([])
  }
  const two = monitorReply([{ x: 0, y: 0, width: 1920, height: 1080 }, { x: 1920, y: 0, width: 1080, height: 1200 }])
  two.writeUInt16LE(1, 62) // Missing output after the second record: discard the valid first record too.
  expect(monitorsFrom(two)).toEqual([])
  expect(monitorsFrom(Buffer.concat([bytes, Buffer.alloc(4)]))).toEqual([])
})

function clientIds(entries: { mask: number; values: number[] }[]): Buffer {
  const bytes = Buffer.alloc(32 + entries.reduce((size, entry) => size + 12 + entry.values.length * 4, 0))
  bytes[0] = 1
  bytes.writeUInt32LE((bytes.length - 32) / 4, 4)
  bytes.writeUInt32LE(entries.length, 8)
  let offset = 32
  for (const { mask, values } of entries) {
    bytes.writeUInt32LE(0x100, offset)
    bytes.writeUInt32LE(mask, offset + 4)
    bytes.writeUInt32LE(values.length * 4, offset + 8)
    values.forEach((value, i) => bytes.writeUInt32LE(value, offset + 12 + i * 4))
    offset += 12 + values.length * 4
  }
  return bytes
}

test('reads a local client PID from X-Resource replies', () => {
  expect(clientPidFrom(clientIds([{ mask: 2, values: [4321] }]))).toBe(4321)
  expect(clientPidFrom(clientIds([{ mask: 1, values: [0x100] }, { mask: 3, values: [4321, 99] }]))).toBe(4321)
  expect(clientPidFrom(clientIds([]))).toBeNull()
  expect(clientPidFrom(clientIds([{ mask: 1, values: [4321] }]))).toBeNull()
  expect(clientPidFrom(clientIds([{ mask: 2, values: [] }]))).toBeNull()
})

test('rejects truncated and malformed X-Resource replies', () => {
  const bytes = clientIds([{ mask: 2, values: [4321] }])
  for (let length = 0; length < bytes.length; length++) expect(clientPidFrom(bytes.subarray(0, length))).toBeNull()
  for (const [offset, value] of [[0, 0], [4, 0xffffffff], [8, 2], [40, 3], [40, 8], [44, 0], [44, 0xffffffff]]) {
    const malformed = Buffer.from(bytes)
    malformed.writeUInt32LE(value!, offset!)
    expect(clientPidFrom(malformed)).toBeNull()
  }
  const truncated = clientIds([{ mask: 2, values: [4321] }, { mask: 1, values: [0x100] }])
  truncated.writeUInt32LE(8, 56)
  expect(clientPidFrom(truncated)).toBeNull()
})

function setupBytes(): Buffer {
  // Header, five-byte vendor + padding, two formats, one screen, two depths/visuals.
  const bytes = Buffer.alloc(168)
  bytes[0] = 1
  bytes.writeUInt16LE(11, 2)
  bytes.writeUInt16LE((bytes.length - 8) / 4, 6)
  bytes.writeUInt16LE(5, 24)
  bytes[28] = 1
  bytes[29] = 2
  bytes.write('X.org', 40)
  bytes.set([16, 16, 32], 48)
  bytes.set([24, 32, 32], 56)
  bytes.writeUInt32LE(0x100, 64) // root
  bytes.writeUInt32LE(0x202, 96) // root_visual
  bytes[102] = 24
  bytes[103] = 2
  bytes[104] = 16
  bytes.writeUInt16LE(1, 106)
  bytes.writeUInt32LE(0x201, 112)
  bytes[116] = 4
  bytes.writeUInt32LE(0xf800, 120)
  bytes.writeUInt32LE(0x07e0, 124)
  bytes.writeUInt32LE(0x001f, 128)
  bytes[136] = 24
  bytes.writeUInt16LE(1, 138)
  bytes.writeUInt32LE(0x202, 144)
  bytes[148] = 4
  bytes.writeUInt32LE(0xff0000, 152)
  bytes.writeUInt32LE(0xff00, 156)
  bytes.writeUInt32LE(0xff, 160)
  return bytes
}

test('parses X11 setup formats and visuals after the padded vendor string', () => {
  const parsed = parseSetup(setupBytes(), 0)
  expect(parsed.root).toBe(0x100)
  expect(parsed.rootVisual).toBe(0x202)
  expect(parsed.rootDepth).toBe(24)
  expect(parsed.imageByteOrder).toBe(0)
  expect([...parsed.formatsByDepth]).toEqual([[16, { bits: 16, pad: 32 }], [24, { bits: 32, pad: 32 }]])
  expect([...parsed.visualsById]).toEqual([[0x201, { depth: 16, trueColor: false }], [0x202, { depth: 24, trueColor: true }]])
})

test('selects the requested screen after skipping the preceding screen depths and visuals', () => {
  const first = setupBytes(), bytes = Buffer.concat([first, first.subarray(64)])
  bytes.writeUInt16LE((bytes.length - 8) / 4, 6)
  bytes[28] = 2
  bytes[30] = 1
  bytes.writeUInt32LE(0x300, 168)
  bytes.writeUInt32LE(0x402, 200)
  bytes.writeUInt32LE(0x401, 216)
  bytes.writeUInt32LE(0x402, 248)
  const parsed = parseSetup(bytes, 1)
  expect(parsed.root).toBe(0x300)
  expect(parsed.rootVisual).toBe(0x402)
  expect(parsed.rootDepth).toBe(24)
  expect(parsed.imageByteOrder).toBe(1)
  expect([...parsed.visualsById.keys()]).toEqual([0x401, 0x402])
})

test('requires the TrueColor class and all three BGRX masks', () => {
  for (const offset of [148, 152, 156, 160]) {
    const bytes = setupBytes()
    bytes[offset] = offset === 148 ? 3 : 1
    expect(parseSetup(bytes, 0).visualsById.get(0x202)?.trueColor).toBe(false)
  }
})

test('rejects absent screens and truncated X11 setup records', () => {
  const bytes = setupBytes()
  for (const screen of [-1, 1, 0.5]) expect(() => parseSetup(bytes, screen)).toThrow('no screen')
  for (const length of [0, 39, 48, 64, 104, 112, 144, 167]) {
    expect(() => parseSetup(bytes.subarray(0, length), 0)).toThrow('truncated')
  }
  for (const offset of [24, 29, 103, 106, 138]) {
    const malformed = setupBytes()
    malformed[offset] = 255
    expect(() => parseSetup(malformed, 0)).toThrow('truncated')
  }
})

test('finds the Windows executable in Wine and Proton command lines', () => {
  for (const path of ['C:\\Program Files (x86)\\World of Warcraft\\_forever_\\Wow.exe', '/games/World of Warcraft/_forever_/WOW.EXE']) {
    const args = commandLine(Buffer.from(`/usr/bin/wine64\0"${path}"\0-launch\0`))
    expect(programFrom(args, '/usr/bin/wine-preloader')).toBe(path)
    expect(isGame(args, '/usr/bin/wine-preloader', [])).toBe(true)
  }
  expect(programFrom(['/opt/electron', 'probe.cjs'], '/opt/electron')).toBe('/opt/electron')
  expect(programFrom([], null)).toBeNull()
  expect(programFrom(['C:\\Launcher.exe', 'C:\\_forever_\\Wow.exe'], '/usr/bin/wine')).toBe('C:\\Launcher.exe')
  expect(programFrom(['C:\\Other\\Wow.exe'], '/usr/bin/wine')).toBe('C:\\Other\\Wow.exe')
})

test('only selects the game in argv[0], or argv[1] behind a Wine or Proton loader', () => {
  const game = 'C:\\Games\\_forever_\\Wow.exe'
  expect(programFrom([game, 'C:\\Other.exe'], '/usr/bin/wine')).toBe(game)
  expect(isGame([game], '/usr/bin/wine', [])).toBe(true)
  for (const loader of ['wine', '/usr/bin/wine64', '/usr/bin/wine-preloader', '/usr/bin/wine64-preloader', '/steam/Proton/proton']) {
    expect(programFrom([loader, game, 'C:\\Other.exe'], '/usr/bin/wine-preloader')).toBe(game)
    expect(isGame([loader, game], '/usr/bin/wine-preloader', [])).toBe(true)
  }
  for (const args of [
    ['bash', '-c', `exec "${game}"`],
    ['bash', '-c', game],
    ['bash', game],
    ['/bin/sh', '-c', `cd x && wine ${game}`],
    ['C:\\Launcher.exe', game],
    ['wine', 'C:\\Launcher.exe', game],
    ['wine', '--flag', game],
    ['/usr/bin/not-wine', game],
  ]) {
    expect(programFrom(args, '/usr/bin/wine'), args.join(' ')).not.toBe(game)
    expect(isGame(args, '/usr/bin/wine', ['wow.exe']), args.join(' ')).toBe(false)
  }
})

test('joins split drive-letter executable paths at the first exe, with or without a Wine loader', () => {
  for (const pieces of [
    ['C:\\Program', 'Files', '(x86)\\World', 'of', 'Warcraft\\_forever_\\Wow.exe'],
    ['C:/Program', 'Files/World', 'of', 'Warcraft/_forever_/Wow.exe'],
    ['C:\\Games\\WoW', '-', 'Forever\\_forever_\\Wow.exe'],
  ]) {
    const program = pieces.join(' ')
    for (const loader of [[], ['/usr/bin/wine64']]) {
      const args = [...loader, ...pieces, '--flag', 'Other.exe']
      expect(programFrom(args, '/usr/bin/wine')).toBe(program)
      expect(isGame(args, '/usr/bin/wine', [])).toBe(true)
    }
  }
  expect(programFrom(['/home/player/Wow.exe', '--flag', 'Other.exe'], null)).toBe('/home/player/Wow.exe')
  expect(programFrom(['wine', 'C:\\Launcher.exe', 'Other.exe'], null)).toBe('C:\\Launcher.exe')
  expect(programFrom(['relative', 'path.exe'], null)).toBe('relative')
})

test('does not join Unix paths or cross option-like path pieces', () => {
  for (const loader of [[], ['/usr/bin/wine64']]) {
    for (const pieces of [
      ['/home/player/Games/World', 'of', 'Warcraft/_forever_/Wow.exe'],
      ['C:\\Program', '-opt', 'Files\\_forever_\\Wow.exe'],
      ['C:\\Program', '/opt', 'Files\\_forever_\\Wow.exe'],
    ]) {
      const args = [...loader, ...pieces]
      expect(programFrom(args, '/usr/bin/wine')).toBe(loader[0] ?? pieces[0])
      expect(isGame(args, '/usr/bin/wine', ['wow.exe'])).toBe(false)
    }
  }
})

test('joins at most sixteen path pieces and keeps the old result without an exe', () => {
  for (const loader of [[], ['wine']]) {
    const pieces = ['C:\\Program', ...Array<string>(14).fill('part'), '_forever_\\Wow.exe']
    expect(programFrom([...loader, ...pieces], null)).toBe(pieces.join(' '))
    const tooLong = [...loader, ...pieces.slice(0, 15), 'part', pieces[15]!]
    expect(programFrom(tooLong, null)).toBe(loader[0] ?? pieces[0])
    expect(isGame(tooLong, null, [])).toBe(false)
    expect(programFrom([...loader, '/home/player/split', 'path'], null)).toBe(loader[0] ?? '/home/player/split')
  }
})

test('requires Forever, or a bare game executable with both the Wine class and a Forever path', () => {
  expect(isGame(['wine', 'Wow.exe', 'C:\\Games\\_forever_\\'], '/usr/bin/wine', ['wow.exe', 'Wow.exe'])).toBe(true)
  expect(isGame(['wine', 'Wow.exe', '--cwd=/games/_forever_/'], '/usr/bin/wine', ['WOW.EXE'])).toBe(true)
  expect(isGame(['wine', '--cwd=/games/_forever_/'], '/usr/bin/wine', ['WOW.EXE'])).toBe(false)
  for (const path of ['/games/_retail_/Wow.exe', '/games/not_forever_/Wow.exe', '/games/_forever_/Wow.exe.bak', '/games/_forever_/Wow.exe/other', 'Wow.exe']) {
    expect(isGame([path], '/usr/bin/wine', []), path).toBe(false)
  }
  expect(isGame(['/games/_retail_/Wow.exe'], '/usr/bin/wine', ['wow.exe'])).toBe(false)
  expect(isGame(['/games/_forever_/Launcher.exe'], '/usr/bin/wine', ['launcher.exe'])).toBe(false)
  expect(isGame(['/games/_forever_backup/'], '/usr/bin/wine', ['wow.exe'])).toBe(false)
})

test('translates the C drive using the process Wine prefix, ahead of Steam compat data', () => {
  const resolveDrive = vi.fn()
  const environment = Buffer.from('OTHER=value\0WINEPREFIX=/wine/prefix\0STEAM_COMPAT_DATA_PATH=/steam/123\0')
  expect(wineProgramPath('C:\\a\\b\\Wow.exe', environment, resolveDrive)).toBe('/wine/prefix/drive_c/a/b/Wow.exe')
  expect(resolveDrive).not.toHaveBeenCalled()
})

test('uses the Steam compat prefix when WINEPREFIX is absent or empty', () => {
  for (const environment of ['STEAM_COMPAT_DATA_PATH=/steam/123\0', 'WINEPREFIX=\0STEAM_COMPAT_DATA_PATH=/steam/123\0']) {
    expect(wineProgramPath('C:\\a\\b', Buffer.from(environment), vi.fn())).toBe('/steam/123/pfx/drive_c/a/b')
  }
})

test('uses the game environment HOME for the default Wine prefix', () => {
  const environment = Buffer.from('HOME=/home/player\0')
  expect(wineProgramPath('C:\\Games\\Wow.exe', environment, vi.fn())).toBe('/home/player/.wine/drive_c/Games/Wow.exe')
})

test('ignores relative prefixes and falls through to the next absolute source', () => {
  for (const prefix of ['relative/prefix', '~/prefix']) {
    const environment = Buffer.from(`WINEPREFIX=${prefix}\0STEAM_COMPAT_DATA_PATH=/steam/123\0HOME=/home/player\0`)
    expect(wineProgramPath('C:\\Wow.exe', environment, vi.fn())).toBe('/steam/123/pfx/drive_c/Wow.exe')
  }
  for (const compat of ['relative/123', '~/123']) {
    const environment = Buffer.from(`WINEPREFIX=relative\0STEAM_COMPAT_DATA_PATH=${compat}\0HOME=/home/player\0`)
    expect(wineProgramPath('C:\\Wow.exe', environment, vi.fn())).toBe('/home/player/.wine/drive_c/Wow.exe')
  }
  expect(wineProgramPath('C:\\Wow.exe', Buffer.from('WINEPREFIX=relative\0STEAM_COMPAT_DATA_PATH=relative\0HOME=relative\0'), vi.fn()))
    .toBe('C:\\Wow.exe')
})

test('resolves other drive letters through dosdevices symlinks', () => {
  const resolveDrive = vi.fn().mockReturnValue('/mnt/games')
  const environment = Buffer.from('WINEPREFIX=/wine/prefix\0')
  expect(wineProgramPath('D:\\World of Warcraft\\_forever_\\Wow.exe', environment, resolveDrive))
    .toBe('/mnt/games/World of Warcraft/_forever_/Wow.exe')
  expect(resolveDrive).toHaveBeenCalledExactlyOnceWith('/wine/prefix/dosdevices/d:')
})

test('normalizes mixed Windows slashes and drive letter case', () => {
  const environment = Buffer.from('WINEPREFIX=/wine/prefix\0')
  expect(wineProgramPath('c:/Games\\_forever_/Wow.exe', environment, vi.fn()))
    .toBe('/wine/prefix/drive_c/Games/_forever_/Wow.exe')
  const resolveDrive = vi.fn().mockReturnValue('/mnt/games')
  expect(wineProgramPath('e:/Games\\_forever_/Wow.exe', environment, resolveDrive))
    .toBe('/mnt/games/Games/_forever_/Wow.exe')
  expect(resolveDrive).toHaveBeenCalledExactlyOnceWith('/wine/prefix/dosdevices/e:')
})

test('preserves the original path when the prefix or drive cannot be resolved', () => {
  const program = 'D:\\Games\\_forever_\\Wow.exe', resolveDrive = vi.fn(() => { throw new Error('missing drive') })
  for (const environment of [null, Buffer.alloc(0), Buffer.from('OTHER=value\0STEAM_COMPAT_DATA_PATH=\0')]) {
    expect(wineProgramPath(program, environment, resolveDrive)).toBe(program)
  }
  expect(resolveDrive).not.toHaveBeenCalled()
  expect(wineProgramPath(program, Buffer.from('WINEPREFIX=/wine/prefix\0'), resolveDrive)).toBe(program)
  expect(wineProgramPath('/games/_forever_/Wow.exe', Buffer.from('WINEPREFIX=/wine/prefix\0'), resolveDrive))
    .toBe('/games/_forever_/Wow.exe')
})

test('distinguishes a missing window, a hidden window and a viewable one', () => {
  expect(stateOf(null, [], 12)).toBe('gone')
  expect(stateOf(null, [12], 12)).toBe('gone')
  expect(stateOf(0, [], 12)).toBe('minimized')
  expect(stateOf(1, [], 12)).toBe('minimized')
  expect(stateOf(2, [8, 12], 12)).toBe('minimized')
  expect(stateOf(2, [8], 12)).toBe('open')
})

test('copies BGRX to RGB without treating the unused byte as alpha', () => {
  const pixels = Buffer.from([32, 64, 128, 0, 0, 255, 0, 255, 255, 0, 0, 17])
  const rgb = rgbFrom(pixels)
  expect([...rgb]).toEqual([128, 64, 32, 0, 255, 0, 0, 0, 255])
  pixels.fill(0)
  expect([...rgb]).toEqual([128, 64, 32, 0, 255, 0, 0, 0, 255])
})

test('accepts only whole rectangles inside the window', () => {
  expect(inWindow(640, 480, 0, 0, 640, 480)).toBe(true)
  expect(inWindow(640, 480, 639, 479, 1, 1)).toBe(true)
  for (const [x, y, w, h] of [[-1, 0, 1, 1], [639, 480, 1, 1], [0, 0, 0, 1], [0.5, 0, 1, 1], [0, 0, 641, 1]]) {
    expect(inWindow(640, 480, x!, y!, w!, h!)).toBe(false)
  }
})

test('clips the extra fullscreen Wine row to the current root height', () => {
  const edges = edgeRect({ x: 0, y: 0, width: 3840, height: 2161 }, 3840, 2160)
  expect(edges).toEqual({ x: 0, y: 0, width: 3840, height: 2160 })
  expect(edges!.y + edges!.height - 1).toBe(2159)
})

test('keeps the whole drawable when a fitting window hangs off the right and bottom', () => {
  const edges = edgeRect({ x: 3800, y: 2100, width: 640, height: 480 }, 3840, 2160)
  expect(edges).toEqual({ x: 0, y: 0, width: 640, height: 480 })
  expect(edges!.x + edges!.width - 1).toBe(639)
  expect(edges!.y + edges!.height - 1).toBe(479)
})

test('keeps the whole drawable when a fitting window hangs off the left and top', () => {
  expect(edgeRect({ x: -100, y: -20, width: 640, height: 480 }, 3840, 2160))
    .toEqual({ x: 0, y: 0, width: 640, height: 480 })
})

test('clips an offset window only on the axis larger than the root', () => {
  expect(edgeRect({ x: -100, y: -20, width: 4000, height: 480 }, 3840, 2160))
    .toEqual({ x: 100, y: 0, width: 3840, height: 480 })
  expect(edgeRect({ x: 100, y: 2100, width: 4000, height: 480 }, 3840, 2160))
    .toEqual({ x: 0, y: 0, width: 3740, height: 480 })
  expect(edgeRect({ x: -100, y: -20, width: 640, height: 2200 }, 3840, 2160))
    .toEqual({ x: 0, y: 20, width: 640, height: 2160 })
  expect(edgeRect({ x: 3800, y: 20, width: 640, height: 2200 }, 3840, 2160))
    .toEqual({ x: 0, y: 0, width: 640, height: 2140 })
})

test('keeps the whole drawable when the window is fully inside the root', () => {
  expect(edgeRect({ x: 100, y: 20, width: 640, height: 480 }, 3840, 2160))
    .toEqual({ x: 0, y: 0, width: 640, height: 480 })
})

test('returns no edge rectangle when a larger window is fully outside the root', () => {
  for (const [x, y] of [[3840, 0], [0, 2160], [-4000, 0], [0, -2200], [4000, 3000]]) {
    expect(edgeRect({ x: x!, y: y!, width: 4000, height: 2200 }, 3840, 2160)).toBeNull()
  }
})

test('clips fullscreen edges against the game monitor in single, side-by-side and stacked layouts', () => {
  const large = { x: 0, y: 0, width: 3840, height: 2160 }
  for (const { monitors, window, root, expected } of [
    { monitors: [large], window: { ...large, height: 2161 }, root: [3840, 2160], expected: { x: 0, y: 0, width: 3840, height: 2160 } },
    { monitors: [large, { ...large, x: 3840 }], window: { ...large, height: 2161 }, root: [7680, 2160], expected: { x: 0, y: 0, width: 3840, height: 2160 } },
    { monitors: [large, { x: 3840, y: 0, width: 1920, height: 1080 }], window: { x: 3840, y: 0, width: 1920, height: 1081 }, root: [5760, 2160], expected: { x: 0, y: 0, width: 1920, height: 1080 } },
    { monitors: [large, { ...large, y: 2160 }], window: { ...large, height: 2161 }, root: [3840, 4320], expected: { x: 0, y: 0, width: 3840, height: 2160 } },
    { monitors: [large, { x: 3840, y: 400, width: 1920, height: 1080 }], window: { x: 3840, y: 400, width: 1920, height: 1081 }, root: [5760, 2160], expected: { x: 0, y: 0, width: 1920, height: 1080 } },
    { monitors: [large, { x: 3840, y: 400, width: 1920, height: 1080 }], window: { x: 3840, y: 380, width: 1920, height: 1101 }, root: [5760, 2160], expected: { x: 0, y: 20, width: 1920, height: 1080 } },
  ]) {
    const edges = monitorEdgeRect(window, monitors, root[0]!, root[1]!)
    expect(edges).toEqual(expected)
    expect(edges!.y + edges!.height - 1).toBe(expected.y + expected.height - 1)
  }
})

test('keeps a fitting window whole, including when it straddles monitors', () => {
  const monitors = [{ x: 0, y: 0, width: 1920, height: 1080 }, { x: 1920, y: 0, width: 1080, height: 1200 }]
  for (const window of [{ x: 2000, y: 100, width: 640, height: 480 }, { x: 1700, y: 800, width: 640, height: 480 }]) {
    expect(monitorEdgeRect(window, monitors, 3000, 1200)).toEqual({ x: 0, y: 0, width: 640, height: 480 })
  }
})

test('clips only the oversized x axis against an offset monitor', () => {
  const monitors = [{ x: 0, y: 0, width: 3840, height: 2160 }, { x: 3840, y: 400, width: 1920, height: 1080 }]
  expect(monitorEdgeRect({ x: 3800, y: 300, width: 2000, height: 480 }, monitors, 5760, 2160))
    .toEqual({ x: 40, y: 0, width: 1920, height: 480 })
})

test('breaks equal intersections by centre containment, then monitor order', () => {
  const window = { x: 50, y: 0, width: 200, height: 101 }
  const monitors = [{ x: 0, y: 0, width: 150, height: 100 }, { x: 150, y: 0, width: 150, height: 100 }]
  for (const order of [monitors, [...monitors].reverse()]) {
    expect(monitorEdgeRect(window, order, 300, 200)).toEqual({ x: 100, y: 0, width: 100, height: 100 })
  }
  const separated = [{ x: 0, y: 0, width: 100, height: 100 }, { x: 200, y: 0, width: 100, height: 100 }]
  expect(monitorEdgeRect({ x: 0, y: 0, width: 300, height: 101 }, separated, 300, 200))
    .toEqual({ x: 0, y: 0, width: 100, height: 100 })
  expect(monitorEdgeRect({ x: 0, y: 0, width: 300, height: 101 }, [...separated].reverse(), 300, 200))
    .toEqual({ x: 200, y: 0, width: 100, height: 100 })
  const overlapping = [{ x: 0, y: 0, width: 150, height: 100 }, { x: 50, y: 0, width: 150, height: 100 }]
  expect(monitorEdgeRect({ x: 0, y: 0, width: 200, height: 101 }, overlapping, 300, 200))
    .toEqual({ x: 0, y: 0, width: 150, height: 100 })
})

test('uses the exact root fallback with no monitors or no intersecting monitor', () => {
  for (const window of [
    { x: 0, y: 0, width: 3840, height: 2161 },
    { x: -100, y: -20, width: 4000, height: 480 },
    { x: 3800, y: 2100, width: 640, height: 480 },
    { x: 4000, y: 3000, width: 4000, height: 2200 },
  ]) {
    for (const monitors of [[], [{ x: -10000, y: -10000, width: 100, height: 100 }]]) {
      expect(monitorEdgeRect(window, monitors, 3840, 2160)).toEqual(edgeRect(window, 3840, 2160))
    }
  }
})
