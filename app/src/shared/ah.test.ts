import { expect, test } from 'vitest'
import * as ah from './ah'
import { ahItems, categoriesOf, gameAhNames, houseFrom, houseNumber, houseOf, listingFrom, nameRank, oneApart, priceOf, search, typical, type AhNames, type Listing } from './ah'
import type { ItemFacts } from './items'
import { gameFolderFrom, openClientFiles, registryInstallPath } from '../main/client-files'
import { sentKeys } from '../main/keys'

test('the house comes from the region, the ruleset in any language of the game and the side, and the neutral town wins', () => {
  const at = (hints: Parameters<typeof houseOf>[0]): number | null => {
    const h = houseOf(hints)
    return h && houseNumber(h)
  }
  expect(at({ region: 'EU', rs: 'Normal', side: 'A' })).toBe(111)
  expect(at({ region: 'EU', rs: 'Normal', side: 'A', nh: true })).toBe(117)
  expect(at({ region: 'US', rs: 'Normal', side: 'H' })).toBe(114)
  expect(at({ region: 'EU', rs: 'Rollenspiel (PvP)', side: 'H' })).toBe(124)
  expect(at({ region: 'KR', rs: '롤플레이', side: 'A' })).toBe(119)
  expect(at({ region: 'eu', rs: 'jcj', side: 'H' })).toBe(113)
  // Something not told, or not known: no house.
  expect(at({ region: 'EU', rs: 'Hardcore', side: 'A' })).toBeNull()
  expect(at({ region: 'CN', rs: 'Normal', side: 'A' })).toBeNull()
  expect(at({ region: 'EU', rs: 'Normal' })).toBeNull()
  expect(at(undefined)).toBeNull()
  expect(houseFrom({ region: 'EU', ruleset: 2, side: 'N' })).toEqual({ region: 'EU', ruleset: 2, side: 'N' })
  expect(houseFrom({ region: 'EU', ruleset: 7, side: 'A' })).toBeNull()
})

test('the typical price is the median weighed by how many', () => {
  expect(typical([[100, 1], [200, 1], [300, 10]])).toBe(300)
  expect(typical([[100, 5], [200, 1], [300, 1]])).toBe(100)
  expect(typical([[100, 1], [200, 1]])).toBe(100)
})

const NAMES: AhNames = { classes: { 2: 'Weapon', 4: 'Armor', 7: 'Trade Goods' }, subs: { '2.1': 'Two-Handed Axes', '4.1': 'Cloth', '7.5': 'Cloth' }, suffixes: { 1: 'of the Bear', 2: 'of Magic' } }
const FACTS: ItemFacts = {
  2589: ['Linen Cloth', 1, 13, 7, 5, 55, 1, 0, 5, 0, 0, 20],
  3195: ['Barbaric Battle Axe', 2, 1500, 2, 1, 7500, 1, 0, 25, 20, 17, 1],
  4310: ['Heavy Woolen Gloves', 2, 300, 4, 1, 1500, 1, 0, 22, 17, 10, 1],
  4311: ['Heavy Woolen Cloak', 2, 300, 4, 1, 1500, 1, 0, 22, 17, 16, 1],
}
const LISTING: Listing = { region: 'eu', house: 111, name: 'Alliance Auction House', snapshot: '2026-11-21T16:23:13Z', items: { 2589: [[15, 200], [12, 40]], '3195:1': [[9000, 1]], '3195:2': [[12000, 2], [15000, 1]], 3195: [[8000, 1]], 4310: [[2500, 1]], 4311: [[3000, 3]] } }

test('an item with kinds keeps a ladder for each kind, as the house has them', () => {
  const items = ahItems(LISTING, FACTS, NAMES)
  const axe = items.find((it) => it.id === 3195)!
  expect(axe.kinds.map((k) => [k.key, k.suffix, k.lowest, k.typical, k.available])).toEqual([['3195', '', 8000, 8000, 1], ['3195:2', 'of Magic', 12000, 12000, 3], ['3195:1', 'of the Bear', 9000, 9000, 1]])
  expect(axe.kinds[1]!.ladder).toEqual(LISTING.items['3195:2'])
  expect(axe.lowest).toBe(8000)
  const linen = items.find((it) => it.id === 2589)!
  expect(linen.kinds[0]!.ladder).toEqual([[12, 40], [15, 200]])
  expect([linen.stack, linen.level, linen.itemLevel]).toEqual([20, 0, 5])
})

test('the categories are the game\'s, armour with where it is worn, each with its items', () => {
  const items = ahItems(LISTING, FACTS, NAMES)
  const cats = categoriesOf(items, NAMES)
  expect(cats.map((c) => [c.name, c.n])).toEqual([['Weapon', 1], ['Armor', 2], ['Trade Goods', 1]])
  expect(cats[1]!.kids[0]!.kids.map((c) => [c.key, c.name, c.n])).toEqual([['4.1.16', 'Back', 1], ['4.1.10', 'Hands', 1]])
  for (const c of cats.flatMap((c) => [c, ...c.kids, ...c.kids.flatMap((k) => k.kids)])) expect(search(items, { typed: '', category: c.key }).length).toBe(c.n)
})

test('the search finds a name with a letter wrong, a whole name in quotes, and filters', () => {
  const items = ahItems(LISTING, FACTS, NAMES)
  const found = (typed: string, more = {}): number[] => search(items, { typed, category: null, ...more }).map((it) => it.id)
  expect(found('barbaic axe')).toEqual([3195])
  expect(found('barbraic')).toEqual([3195]) // two letters swapped
  expect(found('lnen')).toEqual([2589])
  expect(found('lin')).toEqual([2589])
  expect(found('lyn')).toEqual([]) // short words are taken as typed
  expect(found('bear')).toEqual([3195]) // a kind's name
  expect(found('heavy woolen')).toEqual([4311, 4310])
  expect(found('"heavy woolen"')).toEqual([])
  expect(found('"Heavy Woolen Gloves"')).toEqual([4310])
  expect(found('"barbaric battle axe of magic"')).toEqual([3195])
  expect(found('', { category: '7' })).toEqual([2589])
  expect(found('', { minLevel: 18 })).toEqual([3195])
  expect(found('', { maxLevel: 17, quality: 2 })).toEqual([4311, 4310])
  expect(found('', { maxPrice: 2500 })).toEqual([2589, 4310])
  expect(found('', { minPrice: 3000, maxPrice: 9000 })).toEqual([3195, 4311]) // the most on sale first
  expect(nameRank('barbaric battle axe', 'barbaric')).toBe(0)
  expect(nameRank('barbaric battle axe', 'barbaic')).toBe(1)
})

test('one letter apart: changed, added, taken off, two swapped; not two', () => {
  expect(oneApart('linen', 'lnen')).toBe(true)
  expect(oneApart('linen', 'linne')).toBe(true)
  expect(oneApart('linen', 'linex')).toBe(true)
  expect(oneApart('linen', 'linens')).toBe(true)
  expect(oneApart('linen', 'lean')).toBe(false)
  expect(oneApart('linen', 'nilen')).toBe(false)
})

test('a price is typed in gold, silver and copper, or as gold alone', () => {
  expect(priceOf('1g 50s')).toBe(15000)
  expect(priceOf('75s')).toBe(7500)
  expect(priceOf('1.5')).toBe(15000)
  expect(priceOf('2g3c')).toBe(20003)
  expect(priceOf('')).toBeUndefined()
  expect(priceOf('cheap')).toBeUndefined()
  expect(priceOf('5g cheap')).toBeUndefined()
})

test('a listing is taken only in the shape the bucket writes', () => {
  expect(listingFrom(LISTING)).toEqual(LISTING)
  expect(listingFrom({ ...LISTING, snapshot: 'soon' })).toBeNull()
  expect(listingFrom({ ...LISTING, items: [] })).toBeNull()
  expect(listingFrom('<html>')).toBeNull()
})

// The player's game: the names of the categories and of the kinds (M18-F3: "of the Eagle").
const real = gameFolderFrom([registryInstallPath()])
test.skipIf(!real)('the game names its categories and the kinds of its items', () => {
  const names = gameAhNames(openClientFiles(real!, sentKeys(real!)))!
  expect([names.classes[2], names.classes[4], names.classes[7]]).toEqual(['Weapon', 'Armor', 'Trade Goods'])
  expect([names.subs['2.1'], names.subs['4.1'], names.subs['7.9']]).toEqual(['Two-Handed Axes', 'Cloth', 'Herb'])
  expect(Object.values(names.suffixes)).toContain('of the Eagle')
}, 60_000)

test('the key of an item held comes from its link: the bonuses, never the modifiers', () => {
  const { keyOfLink } = ah
  expect(keyOfLink(15212, 'item:15212::::::::::::1:12726:1:28:5242')).toBe('15212:12726')
  expect(keyOfLink(6567, 'item:6567:::::::::::1:1:12718:1:28:5242')).toBe('6567:12718')
  expect(keyOfLink(2034, 'item:2034:::::::::::1::1:28:5237')).toBe('2034')
  expect(keyOfLink(6948, 'item:6948:::::::::::75')).toBe('6948')
  expect(keyOfLink(1970)).toBe('1970')
})

test('what a character holds, by kind and place, and which characters sell at a house', () => {
  const { ownedOf, sellsAt, homeOf } = ah
  const pieces = {
    bags: [{ b: 0, n: 16, s: [[1, 2589, 20], [2, 2589, 7], [3, 15212, 1, 'item:15212::::::::::::1:12726:1:28:5242'], [4, 15212, 1]] }, { b: -1, n: 6, s: [[1, 5396, 1]] }],
    bank: [{ b: -1, s: [[1, 5396, 1]] }, { b: 6, n: 8, s: [[1, 2589, 3]] }],
    gear: [[16, 15212, 40, 45, 'item:15212::::::::::::1:12718']],
  }
  expect(ownedOf('Catubbio Sucameli', pieces).map((o) => `${o.place} ${o.key} ${o.n}`)).toEqual(['Bags 2589 27', 'Bags 15212:12726 1', 'Bags 15212 1', 'Bank 2589 3', 'Worn 15212:12718 1'])
  const home = homeOf({ region: 'EU', rs: 'Normal', side: 'A', nh: true })!
  expect(home).toEqual({ region: 'EU', ruleset: 2, side: 'A' })
  expect(sellsAt(home, { region: 'EU', ruleset: 2, side: 'A' })).toBe(true)
  expect(sellsAt(home, { region: 'EU', ruleset: 2, side: 'N' })).toBe(true)
  expect(sellsAt(home, { region: 'EU', ruleset: 2, side: 'H' })).toBe(false)
  expect(sellsAt(home, { region: 'US', ruleset: 2, side: 'A' })).toBe(false)
  // A character the game has not told the house of: by the side of its race.
  const { countsAt } = ah
  expect(countsAt(undefined, 'Gnome', { region: 'EU', ruleset: 2, side: 'A' })).toEqual({ counts: true, guessed: true })
  expect(countsAt(undefined, 'Orc', { region: 'EU', ruleset: 2, side: 'A' })).toEqual({ counts: false, guessed: true })
  expect(countsAt(undefined, 'Orc', { region: 'EU', ruleset: 2, side: 'N' })).toEqual({ counts: true, guessed: true })
  expect(countsAt(home, 'Gnome', { region: 'EU', ruleset: 1, side: 'A' })).toEqual({ counts: false, guessed: false })
})

test('disenchanting: dust and essence by item level, swapped for a weapon; a shard for a rare; worth at the lowest prices', () => {
  const { disenchantOf, disenchantValue } = ah
  expect(disenchantOf({ cls: 4, quality: 2, itemLevel: 18 })).toEqual([[10940, 0.75, 2, 3], [10939, 0.2, 1, 2], [10978, 0.05, 1, 1]])
  expect(disenchantOf({ cls: 2, quality: 2, itemLevel: 18 })).toEqual([[10940, 0.2, 2, 3], [10939, 0.75, 1, 2], [10978, 0.05, 1, 1]])
  expect(disenchantOf({ cls: 2, quality: 3, itemLevel: 18 })).toEqual([[10978, 1, 1, 1]])
  expect(disenchantOf({ cls: 4, quality: 4, itemLevel: 66 })).toEqual([[20725, 1, 1, 2]])
  expect(disenchantOf({ cls: 7, quality: 2, itemLevel: 18 })).toBeNull()
  expect(disenchantOf({ cls: 4, quality: 1, itemLevel: 18 })).toBeNull()
  expect(disenchantOf({ cls: 4, quality: 2, itemLevel: 4 })).toBeNull()
  const listing: Listing = { ...LISTING, items: { 10940: [[100, 5]], 10939: [[1000, 2]], 10978: [[400, 1], [300, 9]] } }
  // 0.75 x 2.5 x 100 + 0.2 x 1.5 x 1000 + 0.05 x 1 x 300
  expect(disenchantValue(disenchantOf({ cls: 4, quality: 2, itemLevel: 18 }), listing)).toBe(503)
  expect(disenchantValue(disenchantOf({ cls: 4, quality: 2, itemLevel: 30 }), listing)).toBeNull()
})
