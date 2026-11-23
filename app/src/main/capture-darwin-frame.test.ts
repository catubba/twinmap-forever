import { expect, test } from 'vitest'
import fixtures from '../shared/strips.fixture.json'
import { contentTop, FOREVER_PROGRAM, inContent, windowRecord } from './capture-darwin-frame'

test('reads the needed Quartz window fields even when a hidden window has no title or on-screen flag', () => {
  const record = { id: 12, pid: 200, bounds: { x: -640, y: 15, width: 640, height: 480 }, layer: 0 }
  expect(windowRecord(record)).toEqual({ ...record, onScreen: false, title: null })
  expect(windowRecord({ ...record, onScreen: true, title: '魔兽世界' })).toEqual({ ...record, onScreen: true, title: '魔兽世界' })
  expect(windowRecord({ ...record, id: null })).toBeNull()
  expect(windowRecord({ ...record, layer: null })).toBeNull()
  expect(windowRecord({ ...record, bounds: { ...record.bounds, width: 0 } })).toBeNull()
})

test('recognizes the Forever executable independently of its window title', () => {
  const executable = '/Applications/World of Warcraft/_forever_/World of Warcraft.app/Contents/MacOS/World of Warcraft'
  expect(FOREVER_PROGRAM.test(executable)).toBe(true)
  expect(FOREVER_PROGRAM.test(executable.replace('_forever_', '_retail_'))).toBe(false)
  expect(FOREVER_PROGRAM.test(executable + ' Launcher')).toBe(false)
})

test('uses Retina pixels for the standard title bar and a verified strip for custom chrome', () => {
  const cells = fixtures.narrow[0]!
  const strip = Buffer.from(Array.from(cells, Number).flatMap((v) => [v & 1 ? 255 : 0, v & 2 ? 255 : 0, v & 4 ? 255 : 0, 255]))
  const blank = Buffer.alloc(strip.length)
  const frame = { height: 400, scale: 2, titleBar: 28 }
  expect(contentTop(frame, () => blank)).toEqual({ top: 56, confirmed: false })
  expect(contentTop(frame, (y) => y === 64 ? strip : blank)).toEqual({ top: 64, confirmed: true })
  expect(contentTop({ ...frame, titleBar: 0 }, () => blank)).toEqual({ top: 0, confirmed: false })
  expect(contentTop(frame, (y) => y === 0 ? strip : blank)).toEqual({ top: 0, confirmed: true })
})

test('rectangles are measured from the content origin and stop at the physical edges', () => {
  const frame = { width: 800, height: 300, top: 56 }
  expect(inContent(frame, 0, 0, 800, 244)).toBe(true)
  expect(inContent(frame, 790, 234, 10, 10)).toBe(true)
  expect(inContent(frame, 790, 235, 10, 10)).toBe(false)
  expect(inContent(frame, -1, 0, 1, 1)).toBe(false)
  expect(inContent(frame, 0.25, 0, 1, 1)).toBe(false)
  expect(inContent(frame, 0, 0, 0, 1)).toBe(false)
})
