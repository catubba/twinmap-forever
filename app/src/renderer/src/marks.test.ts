import { expect, test } from 'vitest'
import { companionPin, GLYPHS, pin, PIN_NAMES, pinSize, playerPin } from './marks'
import { ARROW } from './look'

test('every pin of the specification is there, at its size', () => {
  expect(Object.fromEntries(PIN_NAMES.map((name) => [name, pinSize(name)]))).toEqual({
    quest: 20, turnin: 20, objective: 9, slay: 18, loot: 18, object: 18, talk: 18, event: 18, service: 14, resource: 12, boss: 22, slain: 22, rareBoss: 26, rareSlain: 26, dungeon: 16, rare: 16, companion: 22, flag: 16, corpse: 14, player: 28,
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
  expect(Object.keys(GLYPHS).sort()).toEqual(['bag', 'bug', 'check', 'close', 'coins', 'cube', 'direction', 'folder', 'gear', 'grip', 'info', 'keyboard', 'layout', 'menu', 'minus', 'palette', 'pause', 'phone', 'pin', 'play', 'plus', 'search', 'shield', 'sliders', 'swap'])
})

test("the character's arrow is drawn in the colour and at the size chosen, and as it was until then", () => {
  expect(playerPin('#3fa9ff', 1.5)).toContain('fill="#3fa9ff"')
  expect(playerPin('#3fa9ff', 1.5)).toContain('viewBox="0 0 28 28" width="42" height="42"')
  expect(playerPin(ARROW.colour, 1)).toBe(pin('player'))
})
