import { expect, test } from 'vitest'
import { gameFolderFrom, openClientFiles, registryInstallPath } from '../main/client-files'
import { sentKeys } from '../main/keys'
import { TALENTS_FORMAT, talentFacts, treeOf, type TalentFacts } from './talents'

// A tree of two tabs and a third with one talent, as talentFacts makes it.
const facts: TalentFacts = {
  format: TALENTS_FORMAT,
  trees: {
    7: {
      classes: 1 << 8,
      tabs: [['Affliction', 1], ['Demonology', 2], ['Destruction', 3]],
      talents: [
        [10, 0, 0, 1, 5, 'Improved Corruption', 11],
        [11, 0, 1, 1, 1, 'Siphon Life', 12],
        [12, 0, 2, 1, 1, 'Wrack', 13],
        [20, 1, 0, 0, 3, 'Improved Imp', 14],
        [30, 2, 0, 0, 5, 'Bane', 15],
      ],
      arrows: [[11, 12], [10, 20]],
    },
    8: { classes: 1 << 4, tabs: [['Discipline', 4], ['Holy', 5], ['Shadow Magic', 6]], talents: [[40, 0, 0, 0, 5, 'Unbreakable Will', 16]], arrows: [] },
  },
}

test('the tree of the talents taken: points by tab, ranks never past the most, arrows within a tab', () => {
  const tree = treeOf({ free: 2, t: [[10, 5, 17810], [11, 1, 18265], [20, 9, 18694], [99, 1, 1]] }, 9, facts)!
  expect(tree.tabs.map((t) => [t.name, t.spent])).toEqual([['Affliction', 6], ['Demonology', 3], ['Destruction', 0]])
  expect([tree.free, tree.spent]).toEqual([2, 9])
  expect(tree.tabs[0]!.arrows.map(([a, b]) => [a.name, b.name])).toEqual([['Siphon Life', 'Wrack']])
  expect(tree.tabs[0]!.talents.map((t) => t.rank)).toEqual([5, 1, 0])
})

test('with nothing taken the tree of the class, and none for a class the files have no tree of', () => {
  expect(treeOf({ free: 0, t: [] }, 5, facts)!.tabs.map((t) => t.name)).toEqual(['Discipline', 'Holy', 'Shadow Magic'])
  expect(treeOf(undefined, 9, facts)!.free).toBe(0)
  expect(treeOf({ t: [] }, 1, facts)).toBeUndefined()
  expect(treeOf('nonsense', undefined, facts)).toBeUndefined()
})

// The player's game: Catubbio's warlock at level 33 as his sheet had it on 25 November 2026, against the game's window.
const real = gameFolderFrom([registryInstallPath()])
test.skipIf(!real)("the real game's warlock tree: three tabs of four columns and seven rows, and the talents taken", () => {
  const read = talentFacts(openClientFiles(real!, sentKeys(real!)))!
  expect(Object.values(read.trees).filter((t) => t.classes & (1 << 8))).toHaveLength(1)
  const taken = [[105911, 2, 17804], [105912, 1, 18265], [105917, 1, 427712], [105918, 2, 17783], [105919, 2, 18827], [105920, 3, 403511], [105922, 2, 437032], [105924, 5, 17810], [105925, 5, 18174]]
  const tree = treeOf({ free: 1, t: taken }, 9, read)!
  expect(tree.tabs.map((t) => `${t.name} ${t.spent} ${t.talents.length}`)).toEqual(['Affliction 23 17', 'Demonology 0 19', 'Destruction 0 16'])
  const at = (name: string): string => {
    const t = tree.tabs.flatMap((t) => t.talents).find((t) => t.name === name)!
    return `${t.row} ${t.column} ${t.rank}/${t.most}`
  }
  expect([at('Improved Corruption'), at('Suppression'), at('Pandemic'), at('Wrack'), at('Incinerate')]).toEqual(['0 2 5/5', '0 1 5/5', '2 3 1/3', '6 1 0/1', '6 1 0/1'])
  expect(tree.tabs[0]!.arrows.map(([a, b]) => `${a.name} > ${b.name}`)).toEqual(['Siphon Life > Wrack', 'Amplify Curse > Curse of Exhaustion'])
  // Every class the game has a tree for, its tabs named as the game's window names them.
  for (const cls of [1, 2, 3, 4, 5, 7, 8, 9, 11]) expect(treeOf({ t: [] }, cls, read)?.tabs).toHaveLength(3)
  expect(treeOf({ t: [] }, 5, read)!.tabs.map((t) => t.name)).toEqual(['Discipline', 'Holy', 'Shadow'])
  expect(treeOf({ t: [] }, 7, read)!.tabs.map((t) => t.name)).toEqual(['Elemental', 'Enhancement', 'Restoration'])
})
