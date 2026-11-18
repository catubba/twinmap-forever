import { expect, test } from 'vitest'
import { ago, firstName, knownOf, shownOf } from './characters'
import type { Sheets } from './sheet'

const sheet = (who: object, seen: number) => ({ code: 'c', rev: 1, pieces: { who, money: 1 }, at: { who: seen - 5, money: seen } })
const sheets: Sheets = {
  'Catubbio Sucameli': sheet({ name: 'Catubbio Sucameli', race: 'Gnome', class: 'WARLOCK', level: 29 }, 1000),
  'Brunilde Ferrozampa': sheet({ race: 'Dwarf', class: 'PALADIN', level: 41 }, 3000),
  'Ottavio Malvento': sheet({ race: 'NightElf', class: 'MAGE', level: 12 }, 2000),
  'Nessuno': sheet({}, 500),
}

test('the one in game comes first, the others by when they were last seen', () => {
  const known = knownOf(sheets, 'Catubbio Sucameli')
  expect(known.map((k) => k.key)).toEqual(['Catubbio Sucameli', 'Brunilde Ferrozampa', 'Ottavio Malvento', 'Nessuno'])
  expect(known[0]).toEqual({ key: 'Catubbio Sucameli', class: 'WARLOCK', color: '#9482c9', level: 29, line: 'Level 29 Gnome Warlock', live: true, seen: 1000 })
  expect(known[2]!.line).toBe('Level 12 Night Elf Mage')
  expect(known[3]).toEqual({ key: 'Nessuno', color: 'var(--text)', line: '', live: false, seen: 500 })
  expect(knownOf(sheets, null)[0]!.key).toBe('Brunilde Ferrozampa')
})

test('the one picked is shown while it is kept; else the one in game; else the one seen last', () => {
  const known = knownOf(sheets, 'Catubbio Sucameli')
  expect(shownOf(known, 'Ottavio Malvento')!.key).toBe('Ottavio Malvento')
  expect(shownOf(known, 'Forgotten')!.key).toBe('Catubbio Sucameli')
  expect(shownOf(known, null)!.key).toBe('Catubbio Sucameli')
  expect(shownOf(knownOf(sheets, null), null)!.key).toBe('Brunilde Ferrozampa')
  expect(shownOf([], null)).toBeNull()
})

test('how long ago, in words', () => {
  const now = 10 * 24 * 3_600_000
  expect(ago(now - 20_000, now)).toBe('just now')
  expect(ago(now - 60_000, now)).toBe('1 minute ago')
  expect(ago(now - 5 * 3_600_000, now)).toBe('5 hours ago')
  expect(ago(now - 3 * 24 * 3_600_000, now)).toBe('3 days ago')
  expect(ago(0, 22 * 24 * 3_600_000)).toBe('3 weeks ago')
  expect(firstName('Catubbio Sucameli')).toBe('Catubbio')
})
