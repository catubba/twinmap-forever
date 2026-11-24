import { expect, test } from 'vitest'
import { questXp } from './quests'

test("a quest's XP for a character: whole up to five levels under it, less below, rounded as Questie rounds it", () => {
  expect(questXp(1950, 24, 20), 'above the character').toBe(1950)
  expect(questXp(880, 16, 20), 'four levels under: whole, rounded to 25').toBe(875)
  expect(questXp(1000, 14, 20), 'six under: 80%').toBe(800)
  expect(questXp(2450, 30, 40), 'ten under: a tenth').toBe(250)
  expect(questXp(170, 2, 60), 'never less than a tenth').toBe(15)
})
