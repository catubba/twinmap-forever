import { expect, test } from 'vitest'
import { objectiveAreas, objectiveGroups, questXp, xpDrop, type ObjectiveKind } from './quests'

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

test('a quest whose XP drops at the next level or the one after says from which; one that dropped says so', () => {
  expect([16, 15, 14, 17, 18, 24].map((q) => xpDrop(q, 20)), 'at level 20').toEqual([22, 21, 'less', null, null, null])
  expect(questXp(1000, 16, 21), 'still whole the level before').toBe(1000)
  expect(questXp(1000, 16, 22), 'less from the level told').toBe(800)
})

test("objectives as areas: a quest's places near each other are one area round them, one far off another; a place for two quests is in both", () => {
  const at = (x: number, y: number, quests: string[]) => ({ x, y, p: { type: 'objective' as const, area: 1, x: 0, y: 0, name: 'Murloc', quests } })
  const areas = objectiveAreas([at(0, 0, ['Murlocs']), at(1, 0, ['Murlocs', 'Fish']), at(10, 10, ['Murlocs'])], 0.75, 0.05)
  const murlocs = areas.find((a) => a.quest === 'Murlocs')!, fish = areas.find((a) => a.quest === 'Fish')!
  expect(murlocs.rings.length, 'two places 1 apart, within twice 0.75, are one area; the one far off is another').toBe(2)
  expect(fish.rings.length, 'the shared place is an area of the other quest too').toBe(1)
  // Every point of a ring lies on the edge: as far as reach from the nearest place, within a cell.
  const places = [[0, 0], [1, 0], [10, 10]]
  for (const p of murlocs.rings.flat()) expect(Math.abs(Math.min(...places.map(([x, y]) => Math.hypot(p.x - x!, p.y - y!))) - 0.75)).toBeLessThan(0.05)
  // A place alone: a ring round it, its area that of the circle.
  const ring = fish.rings[0]!, area = Math.abs(ring.reduce((s, p, i) => s + p.x * ring[(i + 1) % ring.length]!.y - ring[(i + 1) % ring.length]!.x * p.y, 0)) / 2
  expect(area).toBeCloseTo(Math.PI * 0.75 ** 2, 1)
  // Places across a continent: each traced on its own, not on a grid over the whole ground between them.
  const started = performance.now()
  expect(objectiveAreas([at(0, 0, ['Far']), at(150, 150, ['Far'])], 0.49, 0.1)[0]!.rings.length).toBe(2)
  expect(performance.now() - started, 'ms').toBeLessThan(50)
})
