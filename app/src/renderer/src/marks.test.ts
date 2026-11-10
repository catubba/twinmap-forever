import { expect, test } from 'vitest'
import { GLYPHS, pin, PIN_NAMES, pinSize } from './marks'

test('every pin of the specification is there, at its size', () => {
  expect(Object.fromEntries(PIN_NAMES.map((name) => [name, pinSize(name)]))).toEqual({
    quest: 20, turnin: 20, objective: 9, service: 14, resource: 12, dungeon: 16, rare: 16, companion: 12, flag: 16, corpse: 14, player: 28,
  })
})

test('a pin is a square svg of its size, and no two pins are the same drawing', () => {
  for (const name of PIN_NAMES) expect(pin(name)).toContain(`viewBox="0 0 ${pinSize(name)} ${pinSize(name)}" width="${pinSize(name)}"`)
  expect(new Set(PIN_NAMES.map(pin)).size).toBe(PIN_NAMES.length)
})

test('every glyph of the specification is there', () => {
  expect(Object.keys(GLYPHS).sort()).toEqual(['check', 'close', 'direction', 'grip', 'menu', 'minus', 'plus', 'search'])
})
