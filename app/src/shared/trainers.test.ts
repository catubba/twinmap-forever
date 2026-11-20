import { expect, test } from 'vitest'
import { gameFolderFrom, openClientFiles, registryInstallPath } from '../main/client-files'
import { sentKeys } from '../main/keys'
import type { Sheet } from './sheet'
import { classTrainer, professionTrainer, trainerFacts, trainerReads, type TrainerFacts, type TrainerRead } from './trainers'

const FACTS: TrainerFacts = {
  format: 1,
  classes: {
    9: [
      [348, 1, 'Immolate', 1, 0, 0, 135817],
      [695, 6, 'Shadow Bolt', 2, 0, 0, 136197],
      [697, 10, 'Summon Voidwalker', 0, 0, 0, 136221],
      [18867, 24, 'Shadowburn', 2, 0, 1, 136191],
    ],
  },
  spells: { 4037: ['Journeyman', 136243], 3922: ['Handful of Copper Bolts', 133588], 3958: ['Iron Strut', 133608] },
  makes: { 3922: 4359 },
}
const NONE = trainerReads({})
const sheet = (trainers: TrainerRead[], at: number): Sheet => ({ code: 'c', rev: 1, pieces: { trainers }, at: { trainers: at } })

test("before any trainer is seen, a class trainer teaches the game's list, by level, with no costs", () => {
  expect(classTrainer(5172, 'WARLOCK', FACTS, NONE).map((r) => [r.level, r.name, r.rank, r.cost, r.talent])).toEqual([
    [1, 'Immolate', 1, null, false],
    [6, 'Shadow Bolt', 2, null, false],
    [10, 'Summon Voidwalker', 0, null, false],
    [24, 'Shadowburn', 2, null, true],
  ])
  expect(classTrainer(5172, 'DEATHKNIGHT', FACTS, NONE)).toEqual([])
})

test('a spell a quest teaches says which quest, as One for All lists them', () => {
  expect(classTrainer(5172, 'WARLOCK', FACTS, NONE).map((r) => r.quest)).toEqual([undefined, undefined, 'The Binding', undefined])
})

test('a trainer seen in the game says what it teaches; its costs go to every trainer of the class; the newest reading wins', () => {
  // Catubbio saw Briarthorn: the voidwalker is a quest's, not the trainer's; a spell the game's list lacks has its number. Another character saw him before, at other prices.
  const reads = trainerReads({
    old: sheet([{ n: 5172, c: 'WARLOCK', s: [[695, 90, 6, 0]] }], 1),
    catubbio: sheet([{ n: 5172, c: 'WARLOCK', s: [[348, 10, 1, 0], [695, 100, 6, 0], [18867, 1800, 24, 0], [1225228, 0, 1, 0]] }], 2),
  })
  expect(classTrainer(5172, 'WARLOCK', FACTS, reads).map((r) => [r.level, r.name, r.cost])).toEqual([
    [1, 'Immolate', 10],
    [1, 'Spell 1225228', 0],
    [6, 'Shadow Bolt', 100],
    [24, 'Shadowburn', 1800],
  ])
  // Another warlock trainer, never seen: the game's list, with the costs read at Briarthorn.
  expect(classTrainer(906, 'WARLOCK', FACTS, reads).map((r) => r.cost)).toEqual([10, 100, null, 1800])
})

test('a profession trainer gives the ranks it teaches and its recipes by skill, at the costs it asked when seen', () => {
  const p = professionTrainer(5174, FACTS, NONE)!
  expect(p.profession).toBe('Engineering')
  expect(p.skill).toBe(202)
  expect(p.ranks.map((r) => [r.name, r.most, r.cost, r.skill, r.level])).toEqual([
    ['Apprentice', 75, 10, 0, 5],
    ['Journeyman', 150, 450, 50, 10],
    ['Expert', 225, 4500, 125, 20],
  ])
  expect(p.rows[0]).toMatchObject({ name: 'Handful of Copper Bolts', skill: 30, cost: 115 })
  // Seen in the game: what it teaches, and its prices.
  const reads = trainerReads({ c: sheet([{ n: 5174, s: [[4038, 5000, 20, 125], [3958, 999, 0, 190]] }], 1) })
  const seen = professionTrainer(5174, FACTS, reads)!
  expect(seen.ranks.find((r) => r.name === 'Expert')!.cost).toBe(5000)
  expect(seen.rows.map((r) => [r.name, r.skill, r.cost])).toEqual([['Iron Strut', 190, 999]])
  expect(professionTrainer(5172, FACTS, NONE), 'a class trainer').toBeNull()
})

test("the trainers of the participation programme come after the player's own: a trainer never seen here, and costs read nowhere else", () => {
  const seen: TrainerRead[] = [{ n: 906, c: 'WARLOCK', s: [[348, 9, 1, 0], [697, 400, 10, 0]] }, { n: 5172, c: 'WARLOCK', s: [[348, 1, 1, 0]] }]
  const reads = trainerReads({ catubbio: sheet([{ n: 5172, c: 'WARLOCK', s: [[348, 10, 1, 0]] }], 2) }, seen)
  expect(reads.trainers.get(5172)!.s).toEqual([[348, 10, 1, 0]])
  expect(classTrainer(906, 'WARLOCK', FACTS, reads).map((r) => [r.name, r.cost])).toEqual([['Immolate', 10], ['Summon Voidwalker', 400]])
})

test('a reading the app cannot use is left out', () => {
  const bad = { c: { code: 'c', rev: 1, pieces: { trainers: [null, { n: 'x', s: [] }, { n: 1, s: [[1, 'free'], 'line', [2, 30, 1, 0]] }] }, at: {} } } as unknown as Record<string, Sheet>
  const reads = trainerReads(bad)
  expect([...reads.trainers.keys()]).toEqual([1])
  expect([...reads.lines.keys()]).toEqual([2])
})

// The player's game: the warlock's spells up to level 30, as One for All lists them (its Data/TrainerSpells.lua),
// with two more the game lists and One for All does not: Bane of Havoc (Forever's, at 1) and the first rank of
// Conflagrate (a talent of Forever's trees, which are not in the table Talent). The summons come by quests in the
// game: the trainer's own list leaves them out once seen. And the engineering trainer of Ironforge.
const real = gameFolderFrom([registryInstallPath()])
test.skipIf(!real)("the real game lists the warlock's spells by level, and Springspindle Fizzlegear teaches engineering", () => {
  const facts = trainerFacts(openClientFiles(real!, sentKeys(real!)))!
  const warlock = classTrainer(5172, 'WARLOCK', facts, NONE).filter((r) => r.level <= 30)
  expect(warlock.map((r) => `${r.level} ${r.name}${r.rank ? ' ' + r.rank : ''}${r.talent ? ' T' : ''}`).join(' | ')).toBe(
    '1 Bane of Havoc | 1 Immolate 1 | 1 Summon Imp | 4 Corruption 1 | 4 Curse of Weakness 1 | 6 Life Tap 1 | 6 Shadow Bolt 2 | 8 Bane of Agony 1 | 8 Fear 1 | ' +
      '10 Create Healthstone 1 | 10 Demon Skin 2 | 10 Drain Soul 1 | 10 Immolate 2 | 10 Summon Voidwalker | 12 Curse of Weakness 2 | 12 Health Funnel 1 | ' +
      '12 Shadow Bolt 3 | 14 Corruption 2 | 14 Curse of Recklessness 1 | 14 Drain Life 1 | 16 Life Tap 2 | 16 Unending Breath | 18 Bane of Agony 2 | ' +
      '18 Create Soulstone 1 | 18 Searing Pain 1 | 20 Curse of the Elements 1 | 20 Demon Armor 1 | 20 Health Funnel 2 | 20 Immolate 3 | 20 Rain of Fire 1 | ' +
      '20 Ritual of Summoning | 20 Shadow Bolt 4 | 20 Summon Incubus | 20 Summon Succubus | 22 Create Healthstone 2 | 22 Curse of Weakness 3 | ' +
      '22 Drain Life 2 | 22 Eye of Kilrogg | 24 Corruption 3 | 24 Drain Mana 1 | 24 Drain Soul 2 | 24 Sense Demons | 24 Shadowburn 2 T | 25 Conflagrate 1 T | ' +
      '26 Curse of Tongues 1 | 26 Detect Invisibility 1 | 26 Life Tap 3 | 26 Searing Pain 2 | 28 Bane of Agony 3 | 28 Banish 1 | 28 Create Firestone 1 | ' +
      '28 Curse of Recklessness 2 | 28 Health Funnel 3 | 28 Shadow Bolt 5 | 30 Create Soulstone 2 | 30 Curse of the Elements 2 | 30 Demon Armor 2 | ' +
      '30 Drain Life 3 | 30 Hellfire 1 | 30 Immolate 4 | 30 Subjugate Demon 1 | 30 Summon Felhunter',
  )
  expect(warlock.every((r) => r.icon > 0)).toBe(true)
  // Every class has its list.
  for (const cls of [1, 2, 3, 4, 5, 7, 8, 9, 11]) {
    expect(facts.classes[cls]!.length, `class ${cls}`).toBeGreaterThan(100)
    // Each spell once: the panel lists them by number.
    expect(new Set(facts.classes[cls]!.map((s) => s[0])).size, `class ${cls} once`).toBe(facts.classes[cls]!.length)
  }
  // The quests' spells, as One for All lists them.
  expect(classTrainer(906, 'WARLOCK', facts, NONE).filter((r) => r.quest !== undefined).map((r) => `${r.name} ${r.quest}`)).toEqual([
    'Summon Voidwalker The Binding', 'Summon Incubus The Binding', 'Summon Succubus The Binding', 'Summon Felhunter The Binding', 'Inferno ', 'Ritual of Doom ',
  ])

  const engineering = professionTrainer(5174, facts, NONE)!
  expect(engineering.ranks.map((r) => r.name)).toEqual(['Apprentice', 'Journeyman', 'Expert'])
  expect(engineering.rows).toHaveLength(49)
  expect(engineering.rows.every((r) => !r.name.startsWith('Spell ') && r.cost !== null)).toBe(true)
  expect(engineering.rows.find((r) => r.name === 'Arclight Spanner')).toMatchObject({ skill: 50, cost: 150 })
  // Shown in game by Briarthorn and Springspindle, on 17 November 2026, though in neither list: their names still come.
  expect([17962, 1230656, 1249634].map((s) => facts.spells[s]?.[0])).toEqual(['Conflagrate', 'Reagent Bot', 'Sandpaper'])
  // A recipe makes its item: Copper Tube.
  expect(facts.makes[3924]).toBe(4361)
}, 60_000)
