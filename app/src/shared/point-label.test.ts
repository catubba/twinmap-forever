import { expect, test } from 'vitest'
import { unitsOfPlace } from './geo'
import { layersFrom } from './layers'
import type { GameMap } from './maps'
import { labelPlace, placeOfUnits, wayTo, zoneAt } from './point-label'

const DUN_MOROGH = { minX: -7160.4, minY: -3122.9, maxX: -3877.1, maxY: 1802.1 }
const IRONFORGE = { minX: -5096.8, minY: -1504.2, maxX: -4569.2, maxY: -713.6 }
const zone = (id: number, name: string, rect: typeof IRONFORGE): GameMap => ({ id, name, parent: 1415, level: 'zone', continent: 0, rect }) as GameMap
const MAPS = [zone(1426, 'Dun Morogh', DUN_MOROGH), zone(1455, 'Ironforge', IRONFORGE)]

test('a point of the map reads back as the coordinates the game shows', () => {
  const back = placeOfUnits(DUN_MOROGH, unitsOfPlace(DUN_MOROGH, 46.6, 52.2))
  expect(back.x).toBeCloseTo(46.6)
  expect(back.y).toBeCloseTo(52.2)
})

test('a point is in the smallest zone that holds it: the city, not the zone around it', () => {
  expect(zoneAt(MAPS, 0, unitsOfPlace(IRONFORGE, 55.8, 48.4))?.zone.name).toBe('Ironforge')
  const kharanos = zoneAt(MAPS, 0, unitsOfPlace(DUN_MOROGH, 46.6, 52.2))!
  expect(kharanos.zone.name).toBe('Dun Morogh')
  expect(kharanos.place.x).toBeCloseTo(46.6)
  expect(zoneAt(MAPS, 1, unitsOfPlace(DUN_MOROGH, 46.6, 52.2))).toBeUndefined()
  expect(zoneAt(MAPS, 0, { x: 1, y: 1 })).toBeUndefined()
})

test('distance, direction in words and time on foot', () => {
  // A map unit is 133.33 yards; y grows to the south.
  expect(wayTo({ x: 100, y: 100 }, { x: 100, y: 97 })).toEqual({ far: '400 yd north', time: '0:57 on foot' })
  expect(wayTo({ x: 100, y: 100 }, { x: 102, y: 102 }).far).toBe('377 yd south-east')
  expect(wayTo({ x: 100, y: 100 }, { x: 90, y: 100.5 })).toEqual({ far: '1,335 yd west', time: '3:11 on foot' })
  expect(wayTo({ x: 100, y: 100 }, { x: 99, y: 99 }).far).toContain('north-west')
})

test('the label opens on the side with the most room, at each of the four edges', () => {
  const map = { width: 930, height: 750 }, label = { width: 280, height: 140 }
  expect(labelPlace({ x: 30, y: 375 }, map, label)).toEqual({ side: 'right', left: 44, top: 305 })
  expect(labelPlace({ x: 900, y: 375 }, map, label)).toEqual({ side: 'left', left: 606, top: 305 })
  expect(labelPlace({ x: 465, y: 30 }, map, label)).toEqual({ side: 'below', left: 325, top: 44 })
  expect(labelPlace({ x: 465, y: 720 }, map, label)).toEqual({ side: 'above', left: 325, top: 566 })
})

test('in a corner the label slides to stay whole inside the frame', () => {
  const map = { width: 930, height: 750 }, label = { width: 280, height: 140 }
  expect(labelPlace({ x: 20, y: 20 }, map, label)).toEqual({ side: 'right', left: 34, top: 18 })
  expect(labelPlace({ x: 915, y: 740 }, map, label)).toEqual({ side: 'left', left: 621, top: 592 })
})

test('on a narrow map the label goes where it fits, never under the frame', () => {
  const map = { width: 380, height: 434 }, label = { width: 300, height: 125 }
  expect(labelPlace({ x: 330, y: 250 }, map, label)).toEqual({ side: 'above', left: 62, top: 111 })
})

test('saved layer choices: off stays off, everything else is on, rubbish is ignored', () => {
  expect(layersFrom(null).zones).toBe(true)
  expect(layersFrom('not json').arrow).toBe(true)
  const kept = layersFrom(JSON.stringify({ zones: false, arrow: true, gone: false }))
  expect([kept.zones, kept.arrow, kept.bosses]).toEqual([false, true, true])
  expect('gone' in kept).toBe(false)
})
