import { expect, test } from 'vitest'
import type { ItemFacts } from './items'
import { craftOf, forRace, grouped, knownSpells, trainerClass, vendorRows, whoOf } from './npc-panel'
import type { Sheet } from './sheet'
import type { ProfessionRank, TrainerRow } from './trainers'

const FACTS: ItemFacts = {
  159: ['Refreshing Spring Water', 1, 1, 0, 5, 25, 5, 0],
  1205: ['Melon Juice', 1, 25, 0, 5, 500, 5, 0],
  21215: ["Graccu's Mince Meat Fruitcake", 1, 0, 0, 5, 300, 1, 141],
}
const sheet = (pieces: Record<string, unknown>): Sheet => ({ code: 'c', rev: 1, pieces, at: {} })
const CATUBBIO = sheet({
  who: { name: 'Catubbio Sucameli', race: 'Gnome', class: 'WARLOCK', level: 29 },
  bags: [{ b: 0, n: 16, s: [[1, 159, 3], [2, 1205, 20], [3, 159, 2]] }],
  bank: [{ b: 6, n: 48, s: [[1, 1205, 40]] }],
  spells: [348, 695],
  skills: [[202, 168, 225], [129, 150, 150]],
  recipes: { known: [3922], seen: [202] },
})

test('a vendor sells by name, holiday items left out, with how many the character has in bags and bank', () => {
  expect(vendorRows([1205, 159, 21215, 7], FACTS, CATUBBIO).map((r) => [r.name, r.buy, r.perBuy, r.bags, r.bank])).toEqual([
    ['Item 7', null, 1, 0, 0],
    ['Melon Juice', 500, 5, 20, 40],
    ['Refreshing Spring Water', 25, 5, 5, 0],
  ])
  expect(vendorRows([159], FACTS).map((r) => [r.bags, r.bank])).toEqual([[0, 0]])
})

const row = (spell: number, level: number, cost: number | null, more: Partial<TrainerRow> = {}): TrainerRow => ({ spell, name: `S${spell}`, rank: 0, level, skill: 0, cost, talent: false, races: 0, icon: 0, ...more })

test('a trainer list: what is open now with its total, then each level still to reach, and the known apart', () => {
  const rows = [row(348, 1, 10), row(695, 6, 100), row(1, 28, 500), row(2, 28, null), row(3, 24, 400, { talent: true }), row(4, 30, 600), row(5, 29, 50), row(6, 20, 300, { quest: 'The Binding' })]
  const g = grouped(rows, (r) => r.level, 29, knownSpells(CATUBBIO))
  expect(g.now.rows.map((r) => r.spell)).toEqual([1, 2, 3, 5, 6])
  expect(g.now.cost).toBe(550) // no price for a talent, a quest's spell, nor a cost not known
  expect(g.later.map((x) => [x.at, x.cost, x.rows.length])).toEqual([[30, 600, 1]])
  expect(g.known.map((r) => r.spell)).toEqual([348, 695])
})

test('a class trainer is told by what is written under its name; a spell of other races is left out', () => {
  expect(trainerClass('Warlock Trainer')).toBe('WARLOCK')
  expect(trainerClass('Artisan Engineer')).toBeNull()
  expect(trainerClass(undefined)).toBeNull()
  const rows = [row(1, 1, 1, { races: 1 << 6 }), row(2, 1, 1, { races: 1 }), row(3, 1, 1)]
  expect(forRace(rows, whoOf(CATUBBIO).race).map((r) => r.spell)).toEqual([1, 3])
  expect(forRace(rows, 'Skyborne').map((r) => r.spell)).toEqual([1, 2, 3])
})

test('where the character stands in a profession: skill, rank, the next rank this trainer gives, the recipes known', () => {
  const ranks: ProfessionRank[] = [
    { name: 'Journeyman', spell: 4037, most: 150, cost: 450, skill: 50, level: 10 },
    { name: 'Expert', spell: 4038, most: 225, cost: 4500, skill: 125, level: 20 },
    { name: 'Artisan', spell: 12656, most: 300, cost: 45000, skill: 200, level: 35 },
  ]
  const e = craftOf(CATUBBIO, 'Engineering', ranks)
  expect([e.skill, e.most, e.rank, e.next?.name, e.read, [...e.known]]).toEqual([168, 225, 'Expert', 'Artisan', true, [3922]])
  const a = craftOf(CATUBBIO, 'Alchemy', ranks)
  expect([a.skill, a.most, a.rank, a.next?.name, a.read]).toEqual([0, 0, null, 'Journeyman', false])
})
