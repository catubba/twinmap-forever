import { expect, test } from 'vitest'
import { protocolMismatch, type GameState } from './game'
import { experience, linkStatus, LOST_AFTER, type LinkSnapshot } from './link'

const NOW = 1_000_000
const link = (game: LinkSnapshot['game'], state: Partial<GameState> = {}, seconds = 600): LinkSnapshot => ({
  game,
  seconds,
  reads: 0,
  cpu: 0,
  state: { sections: {}, updatedAt: {}, protocol: null, blocks: 0, lost: 0, corrupt: 0, ...state },
})
const heard = (ago: number, pos = {}): Partial<GameState> => ({ sections: { pos }, updatedAt: { pos: NOW - ago } })

test('with a fresh position the link is connected, and says nothing on the map', () => {
  expect(linkStatus(link('open', heard(3000)), NOW)).toEqual({ kind: 'connected', word: 'Connected', tone: 'done' })
})

test('in a fight it says position only', () => {
  expect(linkStatus(link('open', heard(1000, { combat: true })), NOW)).toMatchObject({ kind: 'combat', word: 'In combat, position only', tone: 'gold' })
})

test('game closed or minimized comes before anything the strip said earlier', () => {
  expect(linkStatus(link('closed', heard(1000)), NOW)).toMatchObject({ kind: 'closed', word: 'Game not running', tone: 'objective' })
  expect(linkStatus(link('minimized', heard(1000)), NOW)).toMatchObject({ kind: 'minimized', word: 'Game minimized' })
  expect(linkStatus(link('closed'), NOW).line).toContain('The map still works')
})

test('a strip that stops, as when it is paused, is a lost link after two missed heartbeats', () => {
  expect(linkStatus(link('open', heard(LOST_AFTER)), NOW).kind).toBe('connected')
  expect(linkStatus(link('open', heard(LOST_AFTER + 1)), NOW)).toMatchObject({ kind: 'lost', word: 'Link lost', tone: 'objective' })
  expect(linkStatus(link('open', heard(LOST_AFTER + 1, { combat: true })), NOW).kind).toBe('lost')
})

test('a game that never sent anything: connecting at first, then a lost link', () => {
  expect(linkStatus(link('open', {}, 5), NOW)).toEqual({ kind: 'waiting', word: 'Connecting', tone: 'dim' })
  expect(linkStatus(link('open', {}, 60), NOW).kind).toBe('lost')
})

test('a different protocol says which of the two to update, whatever else is true', () => {
  expect(linkStatus(link('open', { ...heard(1000), protocol: protocolMismatch(2) }), NOW)).toMatchObject({ kind: 'update-app', word: 'Update the app', tone: 'objective' })
  const older = linkStatus(link('open', { protocol: protocolMismatch(0) }, 5), NOW)
  expect(older).toMatchObject({ kind: 'update-addon', word: 'Update the addon' })
  expect(older.line).toContain('Update the addon')
})

test('the experience bar: percent done, and the rested part never past the end of the level', () => {
  expect(experience({ xp: 8432, max: 13600, rested: 2040 })).toEqual({ percent: 62, rested: 15 })
  expect(experience({ xp: 12000, max: 13600, rested: 9000 })!.rested).toBeCloseTo(100 - (12000 / 13600) * 100)
  expect(experience({ xp: 0, max: 400 })).toEqual({ percent: 0, rested: 0 })
  expect(experience({})).toBeNull()
  expect(experience({ xp: 0, max: 0 })).toBeNull()
})
