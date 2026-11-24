import { spawn, type ChildProcess } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { findWindow, findWindowOf, loadCapture, readBox, readRect, readRow, type WindowHandle } from './capture'

describe.skipIf(process.platform !== 'win32')('Windows capture', () => {
  // A real window on the real screen, drawn by capture.test.ps1 with the same formulas as below. It
  // passes for a Chinese client of the game: PowerShell copied to a _forever_ folder as Wow.exe, and
  // a title that is not "World of Warcraft".
  const TITLE = `魔兽世界 Twinmap capture test ${process.pid}`
  const WIDTH = 640, HEIGHT = 60
  const fake = join(tmpdir(), `twinmap-capture-${process.pid}`)
  let child: ChildProcess | undefined
  let hwnd: WindowHandle | null = null

  beforeAll(async () => {
    await loadCapture()
    mkdirSync(join(fake, '_forever_'), { recursive: true })
    copyFileSync(join(process.env.SystemRoot!, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), join(fake, '_forever_', 'Wow.exe'))
    child = spawn(
      join(fake, '_forever_', 'Wow.exe'),
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(__dirname, 'capture.test.ps1'), TITLE, String(WIDTH), String(HEIGHT)],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    )
    // Up to a minute: on a busy machine PowerShell alone can take more than 15 seconds to start.
    for (let i = 0; i < 600 && !hwnd; i++) {
      await sleep(100)
      hwnd = findWindow(TITLE)
    }
    // Found is not painted yet, and over a game that fills the screen the first frames read are still
    // the game's: wait until the window's own first pixel shows, a few seconds at most.
    const first = expected((x) => (x * 7 + 3) % 8).slice(0, 3)
    for (let i = 0; i < 50 && hwnd; i++) {
      await sleep(100)
      if (colors(readRow(hwnd, 'top')).slice(0, 3).join() === first.join()) break
    }
  }, 70_000)
  afterAll(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const process = child
      const gone = new Promise((done) => process.once('exit', done))
      process.kill()
      await gone
    }
    rmSync(fake, { recursive: true, force: true, maxRetries: 20 })
  })

  // Blue, green, red, unused: the bytes Windows gives for a cell of the strip (R*4 + G*2 + B).
  function expected(cell: (x: number) => number, length = WIDTH): number[] {
    return Array.from({ length }, (_, x) => cell(x)).flatMap((v) => [v & 1 ? 255 : 0, v & 2 ? 255 : 0, v & 4 ? 255 : 0])
  }
  const colors = (row: Buffer | null): number[] => [...(row ?? [])].filter((_, i) => i % 4 !== 3)

  test('the top row of a window is read pixel by pixel', () => {
    expect(hwnd, 'the test window did not open').not.toBeNull()
    const row = readRow(hwnd!, 'top')
    expect(row?.length).toBe(WIDTH * 4)
    expect(colors(row)).toEqual(expected((x) => (x * 7 + 3) % 8))
  })

  test('the bottom row is read too, and it is another row', () => {
    expect(colors(readRow(hwnd!, 'bottom'))).toEqual(expected((x) => (x * 5 + 1) % 8))
  })

  test('the left and right columns are read from the top down, their ends the rows drawn over them', () => {
    // The top row starts with 3 and ends with (639 * 7 + 3) % 8, the bottom one with 1 and (639 * 5 + 1) % 8.
    const left = (y: number): number => (y === 0 ? 3 : y === HEIGHT - 1 ? 1 : (y * 3 + 2) % 8)
    const right = (y: number): number => (y === 0 ? ((WIDTH - 1) * 7 + 3) % 8 : y === HEIGHT - 1 ? ((WIDTH - 1) * 5 + 1) % 8 : (y * 7 + 5) % 8)
    const column = readRow(hwnd!, 'left')
    expect(column?.length).toBe(HEIGHT * 4)
    expect(colors(column)).toEqual(expected(left, HEIGHT))
    expect(colors(readRow(hwnd!, 'right'))).toEqual(expected(right, HEIGHT))
    expect(colors(readRow(hwnd!, 'top')), 'a row after a column: the same row as before').toEqual(expected((x) => (x * 7 + 3) % 8))
  })

  test('the game is found by its program, whatever its title', () => {
    expect(findWindowOf(new RegExp(`\\\\twinmap-capture-${process.pid}\\\\_forever_\\\\Wow\\.exe$`, 'i'))).toBe(hwnd)
    expect(findWindowOf(/\\no such folder\\Wow\.exe$/i)).toBeNull()
  })

  test('a window that does not exist is not found, and gives no row', () => {
    expect(findWindow('Twinmap: no such window')).toBeNull()
    expect(readRow(0x7fff_fff0n)).toBeNull()
  })

  test('a square of the window is read too: its first row is the top row, red first', () => {
    const box = readBox(hwnd!, 0, 0, 16)
    expect(box?.rgb.length).toBe(16 * 16 * 3)
    const top = expected((x) => (x * 7 + 3) % 8).slice(0, 16 * 3)
    // The row comes as blue, green, red; the square as red, green, blue.
    expect([...box!.rgb.subarray(0, 16 * 3)]).toEqual(Array.from({ length: 16 }, (_, x) => [top[x * 3 + 2], top[x * 3 + 1], top[x * 3]]).flat())
    // Past the window there is nothing to read.
    expect(readBox(hwnd!, WIDTH - 8, 0, 16)).toBeNull()
    expect(readBox(hwnd!, -1, 0, 16)).toBeNull()
    expect(readBox(0x7fff_fff0n, 0, 0, 16)).toBeNull()
  })

  test('a rectangle is read only off the window itself when asked so: not off what lies over it', () => {
    // The test window is over all others at the top left of the screen: its own pixels are read, the desktop's under it are not.
    expect(readRect(hwnd!, 0, 0, 20, 10, true)?.rgb.length).toBe(20 * 10 * 3)
    const desktop = findWindow('Program Manager')
    expect(desktop, 'the desktop was not found').not.toBeNull()
    expect(readRect(desktop!, 0, 0, 20, 10)).not.toBeNull()
    expect(readRect(desktop!, 0, 0, 20, 10, true)).toBeNull()
  })
})
