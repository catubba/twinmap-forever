import { expect, test } from 'vitest'
import { keep, keptFrom } from './kept'

const stop = { name: 'Goldshire', continent: 0, at: { x: 10, y: 20 }, pin: { m: 1429, x: 42, y: 65 } }

test('nothing readable was never kept, and each of the two stands alone', () => {
  expect(keptFrom(null)).toEqual({ route: null, pins: null })
  expect(keptFrom('junk')).toEqual({ route: null, pins: null })
  expect(keptFrom({ pins: [] })).toEqual({ route: null, pins: [] }) // no pins is not the same as never kept
  expect(keptFrom({ route: { stops: [stop], next: 0, sent: false }, pins: [stop, { name: 3 }] })).toEqual({ route: { stops: [stop], next: 0, sent: false }, pins: [stop] })
})

test('a screen changes one and the other stays; what it sends is checked', () => {
  const before = keptFrom({ pins: [stop] })
  expect(keep(before, 'route', { stops: [stop, 'junk'], next: 0, sent: false })).toEqual({ route: { stops: [stop], next: 0, sent: false }, pins: [stop] })
  expect(keep(before, 'pins', [])).toEqual({ route: null, pins: [] })
  expect(keep(before, 'pins', 'junk')).toEqual({ route: null, pins: [] })
  expect(keep(before, 'settings', {})).toBe(before)
})
