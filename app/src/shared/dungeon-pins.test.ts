import { expect, test } from 'vitest'
import { DUNGEON_PINS } from './dungeon-pins'
import { NEW_DUNGEON_PINS } from './new-dungeon-pins'

test('the list covers the 24 dungeon maps, each entry once', () => {
  expect(new Set(DUNGEON_PINS.map((d) => d.map)).size).toBe(24)
  expect(new Set(DUNGEON_PINS.map((d) => d.name)).size).toBe(DUNGEON_PINS.length)
})

test('the dungeons Forever added last have their own list: five maps, none of them in the other', () => {
  expect(NEW_DUNGEON_PINS.map((d) => d.map)).toEqual([2970, 2974, 2994, 3001, 3039])
  expect(NEW_DUNGEON_PINS.every((d) => d.entrance && !DUNGEON_PINS.some((old) => old.map === d.map))).toBe(true)
  // The bosses of The Drowned City by the names the game tells a kill with.
  expect(NEW_DUNGEON_PINS[0]!.bosses.map((b) => b[0])).toEqual(["Zul'Alai", "Var'Taka", 'Primeval Elemental', 'Captain Dreadrise', 'Deathless Guardians', "Min'loth the Serpent"])
})

test('every boss and entrance lies inside what its dungeon shows', () => {
  for (const d of [...DUNGEON_PINS, ...NEW_DUNGEON_PINS]) {
    const [u1, v1, u2, v2] = d.bounds
    expect(u1 < u2 && v1 < v2, d.name).toBe(true)
    expect(d.bosses.length, d.name).toBeGreaterThan(0)
    for (const [name, u, v] of [...d.bosses, ...(d.entrance ? [['entrance', ...d.entrance] as [string, number, number]] : [])]) {
      expect(u >= u1 - 1 && u <= u2 + 1 && v >= v1 - 1 && v <= v2 + 1, `${d.name}: ${name}`).toBe(true)
    }
  }
})

test('a map shared by several dungeons is split in wings that do not overlap', () => {
  const byMap = new Map<number, typeof DUNGEON_PINS>()
  for (const d of DUNGEON_PINS) byMap.set(d.map, [...(byMap.get(d.map) ?? []), d])
  const shared = [...byMap.values()].filter((list) => list.length > 1)
  expect(shared.map((list) => list[0]!.map)).toEqual([189, 229, 429])
  // The monastery: four wings, each with its own part of the map.
  const wings = byMap.get(189)!
  expect(wings.every((w) => w.part)).toBe(true)
  for (const a of wings) for (const b of wings) {
    if (a === b) continue
    const apart = a.part![2] <= b.part![0] || b.part![2] <= a.part![0] || a.part![3] <= b.part![1] || b.part![3] <= a.part![1]
    expect(apart, `${a.name} and ${b.name}`).toBe(true)
  }
})
