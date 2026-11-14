import { expect, test } from 'vitest'
import { companionPin, GLYPHS, pin, PIN_NAMES, pinSize } from './marks'

test('every pin of the specification is there, at its size', () => {
  expect(Object.fromEntries(PIN_NAMES.map((name) => [name, pinSize(name)]))).toEqual({
    quest: 20, turnin: 20, objective: 9, service: 14, resource: 12, dungeon: 16, rare: 16, companion: 22, flag: 16, corpse: 14, player: 28,
  })
})

test('a pin is a square svg of its size, and no two pins are the same drawing', () => {
  for (const name of PIN_NAMES) expect(pin(name)).toContain(`viewBox="0 0 ${pinSize(name)} ${pinSize(name)}" width="${pinSize(name)}"`)
  expect(new Set(PIN_NAMES.map(pin)).size).toBe(PIN_NAMES.length)
})

test('a companion has their role on the disc, or the first letter of their name', () => {
  const drawn = ['T', 'H', 'D'].map((role) => companionPin(role, 'Anna'))
  expect(new Set(drawn).size).toBe(3)
  for (const svg of drawn) expect(svg).not.toContain('<text')
  expect(companionPin(undefined, 'staliot Falsaperla')).toContain('>S</text>')
  expect(companionPin('X', '<b>')).toContain('></text>')
})

test('every glyph of the specification is there', () => {
  expect(Object.keys(GLYPHS).sort()).toEqual(['check', 'close', 'direction', 'grip', 'menu', 'minus', 'plus', 'search'])
})
