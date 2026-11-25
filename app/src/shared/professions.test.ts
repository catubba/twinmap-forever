import { expect, test } from 'vitest'
import { difficulty, professionsOf } from './professions'
import { SPELLS_FORMAT, type SpellFacts } from './spells'

// Engineering and its child line (the recipes' skill-ups go there), Herbalism with no recipe, Cooking, a weapon skill.
const facts: SpellFacts = {
  format: SPELLS_FORMAT,
  spells: { 3918: ['Rough Blasting Powder', '', 1, 1], 3919: ['Rough Dynamite', '', 2, 1], 3925: ['Rough Boomstick', '', 3, 1], 4036: ['Engineering', '', 4, 1], 2538: ['Charred Wolf Meat', '', 5, 1] },
  lines: { 202: ['Engineering', 10, 11, 0], 2941: ['Engineering', 10, 11, 202], 182: ['Herbalism', 11, 11, 0], 185: ['Cooking', 12, 9, 0], 43: ['Swords', 13, 6, 0] },
  abilities: {
    202: [[4036, 0, 0, 0], [3918, 20, 40, 2941], [3919, 30, 60, 2941], [3919, 30, 60, 2941], [3925, 80, 110, 2941]],
    185: [[2538, 45, 85, 2939]],
  },
  makes: { 3918: 4357, 3919: 4358 },
}

test('the colours of the game: yellow from the first number, green half way, grey from the second', () => {
  expect([1, 19, 20, 29, 30, 39, 40].map((r) => difficulty(r, 20, 40))).toEqual(['optimal', 'optimal', 'medium', 'medium', 'easy', 'easy', 'trivial'])
  expect(difficulty(5, 0, 0)).toBe('trivial')
})

test('professions from the sheet: known recipes the hardest first, the others only where the window was seen', () => {
  const pieces = {
    skills: [[43, 150, 155], [185, 60, 75], [202, 35, 75], [2941, 35, 75], [182, 12, 75]],
    recipes: { known: [3918, 3919, 2538], seen: [202] },
  }
  const [eng, herb, cook, ...rest] = professionsOf(pieces, facts)
  expect(rest).toEqual([])
  expect([eng!.name, herb!.name, cook!.name]).toEqual(['Engineering', 'Herbalism', 'Cooking'])
  expect(eng).toMatchObject({ line: 202, rank: 35, most: 75, secondary: false, crafts: true, seen: true })
  expect(eng!.known.map((r) => [r.name, r.difficulty, r.item])).toEqual([['Rough Dynamite', 'medium', 4358], ['Rough Blasting Powder', 'easy', 4357]])
  expect(eng!.unknown.map((r) => [r.name, r.yellow, r.icon, r.item])).toEqual([['Rough Boomstick', 80, 3, 0]])
  expect(herb).toMatchObject({ crafts: false, known: [], unknown: [] })
  expect(cook).toMatchObject({ secondary: true, seen: false, unknown: [] })
  expect(cook!.known.map((r) => r.name)).toEqual(['Charred Wolf Meat'])
  expect(professionsOf({}, facts)).toEqual([])
})
