import { expect, test } from 'vitest'
import { journeyFrom, span, startedBy } from './journey'

test('a journey reads off the strip with its legs; what is none reads as none', () => {
  const told = { owner: 'AdventureGuideForever', name: 'Three Corners', m: 1415, x: 43.55, y: 68.7, left: 265, legs: [{ mode: 'walk', text: 'Walk to Deeprun Tram', s: 68 }, { mode: 'tram', text: 'Ride the tram', s: 202 }] }
  expect(journeyFrom(told)).toEqual({ name: 'Three Corners', owner: 'AdventureGuideForever', left: 265, legs: [{ mode: 'walk', text: 'Walk to Deeprun Tram', seconds: 68 }, { mode: 'tram', text: 'Ride the tram', seconds: 202 }], goal: { m: 1415, x: 43.55, y: 68.7, name: 'Three Corners' } })
  expect(journeyFrom({ loading: true })).toEqual({ loading: true })
  expect(journeyFrom([]), 'the addon says there is none').toBeNull()
  expect(journeyFrom(undefined), 'no Shortest Path').toBeNull()
  expect(journeyFrom({ name: 'No legs' })).toBeNull()
})

test('what the strip tells is not trusted: odd legs are left out, odd numbers are zero, text is plain', () => {
  const read = journeyFrom({ name: 'A\u0007B', left: -4, legs: [7, { text: '' }, { mode: 3, text: 'Fly to Ironforge', s: 'long' }] })
  expect(read).toEqual({ name: 'A B', owner: '', left: 0, legs: [{ mode: '', text: 'Fly to Ironforge', seconds: 0 }], goal: null })
})

test('who started a journey is named only when it is another addon', () => {
  expect(startedBy('AdventureGuideForever')).toBe('Adventure Guide')
  expect(startedBy('Twinmap')).toBe('')
  expect(startedBy('')).toBe('')
})

test('a time is told in the unit that fits it', () => {
  expect([span(45), span(265), span(4320)]).toEqual(['45 s', '4 min', '1 h 12 min'])
})
