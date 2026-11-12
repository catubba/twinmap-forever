import { expect, test } from 'vitest'
import { goneFrom, markPart, marksNews, inboxFrom, pinFrom, routeNewsFrom, sendState, stepFrom } from './send'

test('a pin is checked before it leaves: a real map, a place on it, a name of plain text', () => {
  expect(pinFrom({ m: 1429, x: 43.712, y: 65.8, name: 'Lion\'s Pride Inn' })).toEqual({ m: 1429, x: 43.71, y: 65.8, name: 'Lion\'s Pride Inn' })
  expect(pinFrom({ m: 1429, x: 0, y: 100, name: ' |cffff0000red|r\n ' + 'x'.repeat(200) })?.name).toBe('/cffff0000red/r  ' + 'x'.repeat(63))
  expect(pinFrom({ m: 1429, x: 1, y: 1, name: ' \t ' })?.name).toBe('Pin')
  for (const wrong of [null, 'pin', {}, { m: 0, x: 1, y: 1, name: 'a' }, { m: 1.5, x: 1, y: 1, name: 'a' }, { m: 1, x: -1, y: 1, name: 'a' }, { m: 1, x: 1, y: 101, name: 'a' }, { m: 1, x: '1', y: 1, name: 'a' }, { m: 1, x: 1, y: 1 }]) {
    expect(pinFrom(wrong), JSON.stringify(wrong)).toBeNull()
  }
})

test('what the addon tells of its inbox is taken only when it is what it should be', () => {
  expect(inboxFrom({ seq: 7, left: 30 })).toEqual({ seq: 7, left: 30 })
  expect(inboxFrom({ seq: 7, left: 0, off: 'slots used up', more: 1 })).toEqual({ seq: 7, left: 0, off: 'slots used up' })
  expect(inboxFrom({ seq: '7', left: 30 })).toBeNull()
  expect(inboxFrom(undefined)).toBeNull()
})

test('a send can go only to a game that listens, and the player is told what to do otherwise', () => {
  const listening = { seq: 3, left: 30 }
  expect(sendState(true, listening, true)).toEqual({ can: true, why: '' })
  expect(sendState(true, listening, false).why).toContain('no zone')
  expect(sendState(false, listening, true).why).toBe('The game is not connected.')
  expect(sendState(true, null, true).why).toContain('not listening yet')
  expect(sendState(true, { seq: 3, left: 0, off: 'slots used up' }, true).why).toContain('/reload')
  expect(sendState(true, { seq: 0, left: 30, off: 'fonts not readable' }, true).why).toContain('Restart the game once')
})

test('a route and a step are checked before they leave', () => {
  const stop = { m: 1432, x: 40, y: 50, rx: 0.5, ry: 0.75, name: 'First|stop' }
  expect(routeNewsFrom({ t: 5, at: 1, stops: [stop], more: 1 })).toEqual({ t: 5, at: 1, stops: [{ ...stop, name: 'First/stop' }] })
  expect(routeNewsFrom(false), 'the route taken away').toBe(false)
  for (const wrong of [null, {}, { t: 5, at: 1, stops: [] }, { t: 5, at: 0, stops: [stop] }, { t: 5, at: 1, stops: [{ ...stop, rx: 0 }] }, { t: 5, at: 1, stops: [{ ...stop, x: 101 }] }, { t: 5, at: 1, stops: Array(31).fill(stop) }]) {
    expect(routeNewsFrom(wrong), JSON.stringify(wrong)?.slice(0, 60)).toBeNull()
  }
  expect(stepFrom({ t: 5, at: 3 })).toEqual({ t: 5, at: 3 })
  expect(stepFrom({ t: 5, at: 2.5 })).toBeNull()
  expect(sendState(true, { seq: 1, left: 30 }, false, 'A stop is').why).toBe('A stop is in no zone the game can mark.')
})

test('the marks sent are only what changed: a new or renamed point, and false for one no longer saved', () => {
  const inn = { m: 1429, x: 43.71, y: 65.8, name: 'Inn' }, mine = { m: 1429, x: 10, y: 20, name: 'Mine' }
  expect(markPart(inn)).toBe('mark1429x4371y6580')
  expect(marksNews([inn, mine, { m: 0, x: 1, y: 1, name: 'no map' }], { pin: inn })).toEqual({ mark1429x4371y6580: inn, mark1429x1000y2000: mine })
  const have = { mark1429x4371y6580: inn, mark1429x1000y2000: mine, route: { t: 1 } }
  expect(marksNews([inn, mine], have), 'nothing changed, nothing to send').toEqual({})
  expect(marksNews([{ ...inn, name: 'Lion|s Pride' }], have)).toEqual({ mark1429x4371y6580: { ...inn, name: 'Lion/s Pride' }, mark1429x1000y2000: false })
  expect(marksNews([], have), 'the other parts are not the marks to take away').toEqual({ mark1429x4371y6580: false, mark1429x1000y2000: false })
  expect(marksNews('pins', have)).toBeNull()
})

test('the marks removed in the game are read off the strip, and anything else is none', () => {
  expect(goneFrom({ gone: ['mark1429x4371y6580', 7] })).toEqual(['mark1429x4371y6580'])
  expect(goneFrom({ gone: [] })).toEqual([])
  expect(goneFrom(undefined)).toEqual([])
  expect(goneFrom({ gone: 'all' })).toEqual([])
})
