import { expect, test } from 'vitest'
import { unitsOfPlace } from './geo'
import type { GameMap } from './maps'
import { journeyFrom, legsOn, span, startedBy } from './journey'

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

test('the legs lie on the map when every one tells where it starts and ends', () => {
  const maps = [{ id: 1415, name: 'Eastern Kingdoms', parent: 0, level: 'continent', continent: 0, rect: { minX: -16000, maxX: 4000, minY: -6000, maxY: 6000 }, area: 0 }] as unknown as GameMap[]
  const leg = (mode: string, p?: unknown[]) => ({ mode, text: 'Go', s: 5, p })
  const journey = (...legs: unknown[]) => journeyFrom({ name: 'Menethil', m: 1415, x: 50, y: 35, left: 10, legs })
  const way = legsOn(journey(leg('walk', [1415, 45.12, 80, 1415, 46, 78]), leg('flight', [1415, 46, 78, 1415, 47, 59])), maps)!
  expect(way.map((l) => l.mode)).toEqual(['walk', 'flight'])
  expect(way[1]!.points).toEqual([{ continent: 0, at: unitsOfPlace(maps[0]!.rect!, 46, 78) }, { continent: 0, at: unitsOfPlace(maps[0]!.rect!, 47, 59) }])
  expect(legsOn(journey(leg('walk', [1415, 45, 80, 1415, 46, 78]), leg('hearth')), maps), 'a leg with no ends').toBeNull()
  expect(legsOn(journey(leg('walk', [1415, 45, 80, 1415, 'x', 78])), maps), 'an end that does not read').toBeNull()
  expect(legsOn(journey(leg('walk', [9999, 45, 80, 1415, 46, 78])), maps), 'an end on a map Twinmap does not draw').toBeNull()
  expect(legsOn({ loading: true }, maps)).toBeNull()
})

test('the height of the ends of a leg is read when Shortest Path tells it', () => {
  const leg = { mode: 'walk', text: 'Walk to the bank', s: 40, p: [1455, 30, 60, 1455, 35, 65] }
  const read = (more: object): unknown => { const j = journeyFrom({ name: 'Bank', legs: [{ ...leg, ...more }] }); return j && !j.loading ? j.legs[0]!.heights : null }
  expect(read({ fz: 502, tz: 497 })).toEqual([502, 497])
  expect(read({ tz: -12 }), 'one end alone').toEqual([null, -12])
  expect(read({}), 'an older Shortest Path').toBeUndefined()
  expect(read({ fz: 'high', tz: 1e9 }), 'not heights').toBeUndefined()
})
