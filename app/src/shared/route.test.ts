import { expect, test } from 'vitest'
import { addStop, advance, bandOf, inRoute, MAX_STOPS, moveStop, noRoute, removeStop, routeFrom, type Route, type Stop } from './route'

const stop = (name: string, x: number, y = 0, continent: 0 | 1 = 0): Stop => ({ name, continent, at: { x, y }, pin: { m: 1432, x: 10, y: 20 } })
const five = (): Route => ['a', 'b', 'c', 'd', 'e'].reduce((route, name, i) => addStop(route, stop(name, i)), noRoute())
const names = (route: Route): string => route.stops.map((s) => s.name).join('')

test('stops are added at the end, once each, up to a limit', () => {
  const route = five()
  expect(names(route)).toBe('abcde')
  expect(addStop(route, stop('again', 2)), 'the same point twice').toBe(route)
  expect(inRoute(route, 0, { x: 2, y: 0 })).toBe(true)
  expect(inRoute(route, 1, { x: 2, y: 0 }), 'the other continent').toBe(false)
  let full = noRoute()
  for (let i = 0; i < MAX_STOPS + 5; i++) full = addStop(full, stop('s' + i, i))
  expect(full.stops.length).toBe(MAX_STOPS)
})

test('a route of five stops comes back from what was saved as it was, and anything else gives none', () => {
  const route = { ...advance(advance(five())), sent: true }
  expect(routeFrom(JSON.stringify(route))).toEqual(route)
  expect(routeFrom(null)).toEqual(noRoute())
  expect(routeFrom('not json')).toEqual(noRoute())
  expect(routeFrom('{"stops":[{"name":"x"},7],"next":3}')).toEqual(noRoute())
  expect(routeFrom(JSON.stringify({ stops: [stop('a', 1), { name: 'broken', continent: 4, at: { x: 1, y: 1 } }], next: 9 }))).toEqual({ stops: [stop('a', 1)], next: 1, sent: false })
})

test('stops are taken away and moved, and any change means the game no longer has the route', () => {
  const sent = { ...advance(five()), sent: true } // a is done, b is next
  expect(names(removeStop(sent, 3))).toBe('abce')
  expect(removeStop(sent, 3).sent).toBe(false)
  expect(removeStop(sent, 0).next, 'a done stop taken away: the next one is still b').toBe(0)
  expect(removeStop(sent, 2).next).toBe(1)
  expect(removeStop(addStop(noRoute(), stop('only', 1)), 0)).toEqual(noRoute())
  expect(names(moveStop(sent, 4, 1))).toBe('aebcd')
  expect(names(moveStop(sent, 1, 3))).toBe('acdbe')
  expect(moveStop(sent, 1, 3).sent).toBe(false)
  expect(moveStop(sent, 2, 0), 'not before a stop already done').toBe(sent)
  expect(moveStop(sent, 2, 5), 'not past the end').toBe(sent)
  expect(advance(sent).sent, 'walking on changes nothing the game has').toBe(true)
})

test('the band tells every state of the stop ahead', () => {
  const route = advance(five()) // next is b, at x = 1
  expect(bandOf(noRoute(), null, true)).toEqual({ state: 'none' })
  expect(bandOf(route, { continent: 0, at: { x: 1, y: 3 } }, false)).toEqual({ state: 'closed', name: 'b', n: 2, of: 5 })
  expect(bandOf(route, null, true), 'in a dungeon').toEqual({ state: 'elsewhere', name: 'b', n: 2, of: 5 })
  expect(bandOf(route, { continent: 1, at: { x: 1, y: 0 } }, true).state).toBe('elsewhere')
  const going = bandOf(route, { continent: 0, at: { x: 1, y: 300 } }, true)
  expect(going).toMatchObject({ state: 'going', name: 'b', n: 2, of: 5, turn: 0 })
  expect(going.state === 'going' && going.far).toMatch(/^[\d,]+ yd north$/)
  expect(going.state === 'going' && going.minutes).toBeGreaterThan(1)
  expect(bandOf(route, { continent: 0, at: { x: 1.001, y: 0 } }, true)).toMatchObject({ state: 'arrived', minutes: 1 })
  let walked = route
  for (let i = 0; i < 4; i++) walked = advance(walked)
  expect(bandOf(walked, null, true)).toEqual({ state: 'complete' })
  expect(advance(walked)).toBe(walked)
  expect(addStop(walked, stop('new', 9)), 'a route walked to its end starts anew').toEqual({ stops: [stop('new', 9)], next: 0, sent: false })
})
