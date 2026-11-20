import { expect, test } from 'vitest'
import { logFor } from '../../../server/src/index'
import { startBosses } from './bosses'
import type { InsideReport } from './minimap'

const THANES = 3065
const at = (u: number, v: number, score = 0.9): InsideReport => ({ dungeon: THANES, pictures: 3, picture: 1, place: { u, v, score } })
const lost: InsideReport = { dungeon: THANES, pictures: 3, why: 'not sure' }
const kills = (ids: number[], rares: number[] = [], map = THANES): unknown => ({ map, list: [], ids, rares })

test('a kill in a run is kept where the minimap was, and the run goes out as a session of the log when the character leaves', () => {
  const bosses = startBosses(() => true, '0.14.0')
  bosses.kills(kills([3493]), 0) // the app opens in a run under way: Faldrim was killed before
  bosses.take(at(17068.04, 16738.26), 1000)
  bosses.kills(kills([3493]), 1500)
  bosses.take(lost, 2000)
  bosses.kills(kills([3493, 3496], [3586]), 4000)
  bosses.take(lost, 20_000)
  bosses.kills(kills([3493, 3494, 3496], [3586]), 20_000) // the place is older than ten seconds: none
  expect(bosses.take(at(17000, 17000), 21_000)).toBeNull()
  const session = bosses.take(null, 30_000)!
  const read = JSON.parse(session.text)
  expect(read).toEqual({ log: 1, id: session.id, v: '0.14.0', e: [['boss', 3, 3496, THANES, 1, 17068, 16738.3, 0.9], ['boss', 19, 3494, THANES], ['rare', 29, 3586, THANES]] })
  expect(session.id).toMatch(/^[0-9a-f]{16}$/)
  expect('error' in logFor(new URLSearchParams({ app: '0.14.0', build: '1.60.1.70938', locale: 'enUS' }), session.text)).toBe(false)
})

test('a run with nothing killed and no rare met gives nothing; with the choice off nothing is kept', () => {
  const quiet = startBosses(() => true, '0.14.0')
  quiet.kills(kills([]), 0)
  quiet.take(at(1, 1), 1000)
  expect(quiet.take(null, 2000)).toBeNull()

  let on = false
  const off = startBosses(() => on, '0.14.0')
  off.kills(kills([]), 0)
  off.take(at(1, 1), 1000)
  off.kills(kills([3496]), 2000)
  on = true
  expect(off.take(null, 3000)).toBeNull()
})

test('a fight of another dungeon is not of this run', () => {
  const bosses = startBosses(() => true, '0.14.0')
  bosses.take(at(1, 1), 0)
  bosses.kills(kills([], [], 36), 0)
  bosses.kills(kills([1], [7], 36), 500)
  expect(bosses.take(null, 1000)).toBeNull()
})
