import { expect, test } from 'vitest'
import { placeWindow, WINDOW } from './window'

const MAIN = { x: 0, y: 0, width: 2560, height: 1392 }
const SIDE = { x: 2560, y: 69, width: 1920, height: 1032 }
const CENTRED = { x: 640, y: 296, width: 1280, height: 800 }

test('the first window is never smaller than its own minimum', () => {
  expect(WINDOW.width).toBeGreaterThanOrEqual(WINDOW.minWidth)
  expect(WINDOW.height).toBeGreaterThanOrEqual(WINDOW.minHeight)
})

test('with nothing saved, or something unreadable, the window opens centred on the main monitor', () => {
  for (const saved of [null, undefined, 'x', {}, { x: 1, y: 2 }, { x: 'a', y: 0, width: 900, height: 600 }, { x: NaN, y: 0, width: 900, height: 600 }])
    expect(placeWindow(saved, [MAIN, SIDE], MAIN)).toEqual(CENTRED)
})

test('the window comes back where it was, on either monitor', () => {
  const onMain = { x: 300, y: 200, width: 1000, height: 700 }
  const onSide = { x: 2760, y: 169, width: 1000, height: 700 }
  expect(placeWindow({ ...onMain, maximized: false }, [MAIN, SIDE], MAIN)).toEqual(onMain)
  expect(placeWindow({ ...onSide, maximized: true }, [MAIN, SIDE], MAIN)).toEqual(onSide)
})

test('a window half off a monitor comes back too, as long as its top row can be grabbed', () => {
  const hanging = { x: 4300, y: 500, width: 1000, height: 700 }
  expect(placeWindow(hanging, [MAIN, SIDE], MAIN)).toEqual(hanging)
})

test('without the monitor it was on, the window opens centred on the main one, with its size', () => {
  expect(placeWindow({ x: 2760, y: 169, width: 1000, height: 700 }, [MAIN], MAIN)).toEqual({ x: 780, y: 346, width: 1000, height: 700 })
})

test('a window whose top row is out of reach is brought back', () => {
  for (const lost of [{ x: 4450, y: 500 }, { x: 300, y: -60 }, { x: 300, y: 1380 }])
    expect(placeWindow({ ...lost, width: 1000, height: 700 }, [MAIN, SIDE], MAIN)).toEqual({ x: 780, y: 346, width: 1000, height: 700 })
})

test('a saved size is never under the minimum, nor over a main monitor it has to fall back on', () => {
  expect(placeWindow({ x: 300, y: 200, width: 10, height: 10 }, [MAIN], MAIN)).toEqual({ x: 300, y: 200, width: 720, height: 480 })
  const small = { x: 0, y: 0, width: 1366, height: 728 }
  expect(placeWindow({ x: 5000, y: 0, width: 1900, height: 1000 }, [small], small)).toEqual(small)
})
