import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { findWindow, readRow, type WindowHandle } from './capture'

// A real window on the real screen, drawn by capture.test.ps1 with the same formulas as below.
const TITLE = `Twinmap capture test ${process.pid}`
const WIDTH = 640, HEIGHT = 60

const child = spawn(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(__dirname, 'capture.test.ps1'), TITLE, String(WIDTH), String(HEIGHT)],
  { stdio: ['ignore', 'ignore', 'inherit'] },
)
let hwnd: WindowHandle | null = null

beforeAll(async () => {
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
afterAll(() => void child.kill())

// Blue, green, red, unused: the bytes Windows gives for a cell of the strip (R*4 + G*2 + B).
function expected(cell: (x: number) => number): number[] {
  return Array.from({ length: WIDTH }, (_, x) => cell(x)).flatMap((v) => [v & 1 ? 255 : 0, v & 2 ? 255 : 0, v & 4 ? 255 : 0])
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

test('a window that does not exist is not found, and gives no row', () => {
  expect(findWindow('Twinmap: no such window')).toBeNull()
  expect(readRow(0x7fff_fff0n)).toBeNull()
})
