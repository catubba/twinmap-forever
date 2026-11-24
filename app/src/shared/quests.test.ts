import { expect, test } from 'vitest'
import { objectiveGroups, questXp, type ObjectiveKind } from './quests'

test('objectives near each other that ask for the same thing are one pin; a quest in front is gathered on its own', () => {
  const at = (x: number, kind: ObjectiveKind | undefined, quest: string) => ({ x, y: 0, p: { type: 'objective' as const, area: 1, x: 0, y: 0, kind, name: 'Tar Beast', quests: [quest] } })
  const placed = [at(0, 'loot', 'Super Sticky'), at(1, 'loot', 'Super Sticky'), at(2, 'loot', 'Muigin and Larion'), at(1.5, 'slay', 'The Apes'), at(9, 'loot', 'Super Sticky'), at(0.5, undefined, 'Lost')]
  const all = objectiveGroups(placed, 3, null)
  const loot = all.filter((g) => g.kind === 'loot').map((g) => [g.of.length, g.quests])
  expect(loot, 'three pouches near each other are one, for both quests; the far one alone').toEqual([[3, ['Super Sticky', 'Muigin and Larion']], [1, ['Super Sticky']]])
  expect(all.filter((g) => g.kind !== 'loot').map((g) => [g.kind, g.of.length]), 'a sword and a place of no known kind are not gathered with the pouches').toEqual([['slay', 1], [undefined, 1]])
  expect(all.every((g) => g.lit), 'with no quest in front, all are lit').toBe(true)

  const front = objectiveGroups(placed, 3, 'Super Sticky')
  expect(front.filter((g) => g.lit).map((g) => [g.of.length, g.quests]), 'the quest in front: its own places, gathered apart').toEqual([[2, ['Super Sticky']], [1, ['Super Sticky']]])
  expect(front.filter((g) => !g.lit).flatMap((g) => g.quests).sort(), 'every other quest dim').toEqual(['Lost', 'Muigin and Larion', 'The Apes'])
})

test("a quest's XP for a character: whole up to five levels under it, less below, rounded as Questie rounds it", () => {
  expect(questXp(1950, 24, 20), 'above the character').toBe(1950)
  expect(questXp(880, 16, 20), 'four levels under: whole, rounded to 25').toBe(875)
  expect(questXp(1000, 14, 20), 'six under: 80%').toBe(800)
  expect(questXp(2450, 30, 40), 'ten under: a tenth').toBe(250)
  expect(questXp(170, 2, 60), 'never less than a tenth').toBe(15)
})
