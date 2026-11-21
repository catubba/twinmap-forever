import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { Alert, Listing } from '../shared/ah'
import { startAlerts, type AlertNews } from './alerts'

const at = (snapshot: string, items: Listing['items']): Listing => ({ region: 'eu', house: 111, name: '', snapshot, items })
const ask = (more: Partial<Alert>): Partial<Alert> => ({ who: 'Catubbio Sucameli', region: 'EU', house: 111, item: 2589, key: null, name: 'Linen Cloth', when: 'below', price: 10, game: true, ...more })

test('alerts are met once by a listing past their line, told to the game, and kept for the next run', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'twinmap-alerts-')), 'alerts.json')
  const sent: Record<string, AlertNews | false>[] = []
  let told: Alert[] = []
  let t = 1000
  const alerts = startAlerts(file, (all) => (told = all), (parts) => sent.push(parts), () => t++)
  const first = at('2026-11-21T16:23:00Z', { 2589: [[12, 40]], 9776: [[600, 1]], '9776:6567': [[500, 1]] })
  alerts.set(ask({}), first) // 12c: not below 10c
  alerts.set(ask({ when: 'above', price: 15 }), first)
  alerts.set(ask({ item: 9776, key: '9776:6567', name: 'Axe of the Bear', price: 400, game: false }), first)
  alerts.set(ask({ item: 9776, when: 'appears', price: 0 }), first) // on sale now: waits for an hour with none
  alerts.set(ask({ key: '9776' }), first) // a kind of another item: refused
  alerts.set(ask({ when: 'below', price: 0 }), first) // no line: refused
  expect(told.map((a) => a.met)).toEqual([null, null, null, null])
  expect(sent).toEqual([])

  alerts.check(at('2026-11-21T17:23:00Z', { 2589: [[9, 5], [11, 3]], '9776:6567': [[350, 1]] }))
  expect(told.map((a) => [a.met, a.at])).toEqual([['2026-11-21T17:23:00Z', 9], [null, null], ['2026-11-21T17:23:00Z', 350], [null, null]])
  expect(sent).toHaveLength(1)
  expect(Object.keys(sent[0]!)).toEqual(['alert1000']) // the axe's alert is not for the game
  expect(sent[0]!.alert1000).toMatchObject({ who: 'Catubbio Sucameli', name: 'Linen Cloth', at: 9, when: 'below', price: 10 })

  // A listing of another house, and a met alert again under its line, change nothing.
  alerts.check({ ...at('2026-11-21T18:23:00Z', { 2589: [[1, 1]] }), house: 110 })
  alerts.check(at('2026-11-21T18:23:00Z', { 2589: [[8, 1]] }))
  expect(sent).toHaveLength(1)
  expect(told[3]!.away).toBe(true) // no axe at all at 18:23
  alerts.check(at('2026-11-21T19:23:00Z', { 2589: [[20, 1]], '9776:1': [[700, 1]] }))
  expect(told.map((a) => !!a.met)).toEqual([true, true, true, true])
  expect(sent.flatMap((s) => Object.keys(s))).toEqual(['alert1000', 'alert1001', 'alert1003'])

  // Kept: a new run has them as they were. Removing a met one takes it from the game too.
  const again = startAlerts(file, (all) => (told = all), (parts) => sent.push(parts))
  expect(again.all()).toEqual(told)
  again.remove(1000)
  expect(sent.at(-1)).toEqual({ alert1000: false })
  expect(startAlerts(file, () => {}, () => {}).all().map((a) => a.t)).toEqual([1001, 1002, 1003])
})
