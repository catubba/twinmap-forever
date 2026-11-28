import { expect, test } from 'vitest'
import { DUNGEON_PINS } from './dungeon-pins'
import { DUNGEON_ROUTES } from './dungeon-routes'
import { nameOfBoss } from './inside'
import { NEW_DUNGEON_PINS } from './new-dungeon-pins'

const pins = [...DUNGEON_PINS, ...NEW_DUNGEON_PINS]

test('every route is of a dungeon the map shows, and lies on it', () => {
  expect(DUNGEON_ROUTES).toHaveLength(41)
  for (const r of DUNGEON_ROUTES) {
    // The raids have no pins of ours: their routes show with discs of their own, and nothing to hold them to here.
    const here = pins.filter((p) => p.map === r.map)
    if (!here.length) continue
    // A floor laid with the wrong rectangle or the wrong fit lands far out of the dungeon.
    const [u1, v1, u2, v2] = here.reduce((a, d) => [Math.min(a[0], d.bounds[0]), Math.min(a[1], d.bounds[1]), Math.max(a[2], d.bounds[2]), Math.max(a[3], d.bounds[3])], [Infinity, Infinity, -Infinity, -Infinity])
    for (const line of r.lines) {
      expect(line.at.length % 2, r.key).toBe(0)
      expect(line.at.length, r.key).toBeGreaterThanOrEqual(4)
      for (let i = 0; i < line.at.length; i += 2) {
        const out = Math.max(u1 - line.at[i]!, line.at[i]! - u2, v1 - line.at[i + 1]!, line.at[i + 1]! - v2)
        expect(out, `${r.key}: a point ${Math.round(out)} yards out of the dungeon`).toBeLessThan(250)
      }
    }
    expect(r.lines.some((l) => !l.side), r.key).toBe(true)
    expect(r.stops.length, r.key).toBeGreaterThan(0)
  }
})

test('the bosses of the routes stand where our skulls are', () => {
  const off: number[] = []
  for (const r of DUNGEON_ROUTES) {
    const skulls = pins.filter((p) => p.map === r.map).flatMap((p) => p.bosses)
    for (const [, name, u, v] of r.stops) {
      const skull = skulls.find((b) => nameOfBoss(b[0]) === nameOfBoss(name))
      if (skull) off.push(Math.hypot(skull[1] - u, skull[2] - v))
    }
  }
  off.sort((a, b) => a - b)
  expect(off.length).toBeGreaterThan(200)
  expect(off[off.length >> 1]).toBeLessThan(20) // 15.6 yards with Forever Dungeon Routes 1.3.16
  expect(off[Math.floor(off.length * 0.75)]).toBeLessThan(50)
})

test('the Deadmines: from the door to VanCleef, on two floors, Miner Johnson a rare on a side way', () => {
  const r = DUNGEON_ROUTES.find((r) => r.key === 'deadmines')!, door = DUNGEON_PINS.find((p) => p.map === 36)!.entrance!
  expect(r.rough).toBeUndefined()
  expect(r.stops.filter((s) => s[0] !== 'rare').map((s) => s[1])).toEqual(["Rhahk'Zor", "Sneed's Shredder", 'Gilnid', 'Mr. Smite', 'Captain Greenskin', 'Cookie', 'Edwin VanCleef'])
  expect(r.stops.find((s) => s[1] === 'Miner Johnson')?.[0]).toBe('rare')
  expect(r.lines.filter((l) => l.side)).toHaveLength(2)
  const start = r.lines.find((l) => !l.side)!.at
  expect(Math.hypot(start[0]! - door[0], start[1]! - door[1])).toBeLessThan(60)
  // The dungeons Forever added are told approximate, as the addon tells them.
  expect(DUNGEON_ROUTES.find((r) => r.key === 'hallofthanes')?.rough).toBe(true)
})
