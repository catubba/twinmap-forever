import { expect, test } from 'vitest'
import { initialCapturing, stepCapture } from './capture-linux-state'

test('capture starts only on an explicit connection and never retries a crash', () => {
  const idle = initialCapturing()
  expect(stepCapture(idle, { kind: 'connect' })).toBe(idle)
  const waiting = stepCapture(idle, { kind: 'game', running: true })
  expect(waiting.state).toBe('waiting')
  const picking = stepCapture(waiting, { kind: 'connect' })
  expect(picking.state).toBe('picking')
  const running = stepCapture(picking, { kind: 'layout' })
  expect(running.state).toBe('running')
  expect(stepCapture(running, { kind: 'exit' }).state).toBe('waiting')
  expect(stepCapture(running, { kind: 'reselect' }).state).toBe('picking')
})

test('capture hints wait for ten seconds and respect pause and decoded blocks', async () => {
  const { hintOf } = await import('./capture-linux-state')
  const state = { running: true, sessionStartMs: 0, lastBlockMs: null, paused: false, nowMs: 9999, hyprland: false, tokenReturned: true }
  expect(hintOf(state)).toBeNull()
  expect(hintOf({ ...state, nowMs: 10000 })).toBe('wrong-window')
  expect(hintOf({ ...state, nowMs: 10000, paused: true })).toBeNull()
  expect(hintOf({ ...state, nowMs: 10000, lastBlockMs: 500 })).toBeNull()
  expect(hintOf({ ...state, nowMs: 10000, lastBlockMs: 500, hyprland: true, tokenReturned: false })).toBe('not-remembered')
})

test('automatic restore is attempted once per game process', async () => {
  const { restoreGate } = await import('./capture-linux-state')
  const gate = restoreGate()
  expect(gate.take(42)).toBe(true)
  expect(gate.take(42)).toBe(false)
  gate.reset()
  expect(gate.take(42)).toBe(true)
  expect(gate.take(43)).toBe(true)
})
test('unsupported capture can be explicitly retried', () => {
  expect(stepCapture({ state: 'unsupported', why: 'portal' }, { kind: 'connect' }).state).toBe('picking')
})
test('a replacement PID invalidates the old game session', async () => {
  const { gameChanged } = await import('./capture-linux-state')
  expect(gameChanged(42, 43)).toBe(true)
  expect(gameChanged(42, null)).toBe(true)
  expect(gameChanged(null, 43)).toBe(false)
  expect(gameChanged(42, 42)).toBe(false)
})
test('frame identity requires the selected game PID', async () => {
  const { frameMatchesGame } = await import('./capture-linux-state')
  expect(frameMatchesGame(42, 42)).toBe(true)
  expect(frameMatchesGame(42, 43)).toBe(false)
  expect(frameMatchesGame(null, 42)).toBe(false)
})
test('an explicit request can wait for a stopping helper', async () => {
  const { selectionAfterStop } = await import('./capture-linux-state')
  expect(selectionAfterStop({ state: 'waiting' }, true).state).toBe('picking')
  expect(selectionAfterStop({ state: 'unsupported' }, true).state).toBe('picking')
  expect(selectionAfterStop({ state: 'idle' }, true).state).toBe('idle')
  expect(selectionAfterStop({ state: 'waiting' }, false).state).toBe('waiting')
})
