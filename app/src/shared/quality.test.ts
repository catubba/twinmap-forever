import { expect, test } from 'vitest'
import { lower, QUALITIES, qualityOf, type Switches } from './quality'

const set = (q: keyof typeof QUALITIES, more: Partial<Switches> = {}): Switches => ({ density: 'few', ...QUALITIES[q], ...more })

test('each step is itself; one switch changed, or more trees than High has, is Custom', () => {
  for (const q of ['low', 'medium', 'high'] as const) expect(qualityOf(set(q))).toBe(q)
  // how many trees does not count where the step has none
  expect(qualityOf(set('medium', { density: 'many' }))).toBe('medium')
  expect(qualityOf(set('high', { density: 'many' }))).toBe('custom')
  expect(qualityOf(set('high', { objects: false }))).toBe('custom')
  expect(qualityOf(set('low', { daynight: false }))).toBe('custom')
})

test('the step under: High, Medium, then nothing; from Custom, under what it has on', () => {
  expect(lower(set('high'))).toBe('medium')
  expect(lower(set('medium'))).toBe('low')
  expect(lower(set('low'))).toBeNull()
  expect(lower(set('low', { ground: true }))).toBe('medium')
  expect(lower(set('low', { buildings: true, daynight: false }))).toBe('low')
  expect(lower(set('low', { daynight: false }))).toBeNull()
})
