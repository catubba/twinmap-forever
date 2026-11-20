import { expect, test } from 'vitest'
import { errorsFor } from '../../../server/src/index'
import { clean, fault, look, report, startHealth } from './health'

const GAME = 'C:\\Users\\sebas\\Games\\World of Warcraft'
const PLACES: [string, string][] = [[GAME, '<game>'], ['C:\\Users\\sebas', '<home>']]
const NAMES = ['sebas', 'DESKTOP-K2', 'Catubbio', 'Sucameli']

test('a line leaves with no folder and no name in it, or not at all', () => {
  expect(clean(`ENOENT: no such file or directory, open '${GAME}\\_forever_\\Interface\\AddOns\\QuestieDB\\QuestieDB_Forever.toc'`, PLACES, NAMES)).toBe("ENOENT: no such file or directory, open '<game>\\_forever_\\Interface\\AddOns\\QuestieDB\\QuestieDB_Forever.toc'")
  expect(clean('read C:/Users/sebas/Games/World of Warcraft/Data/data.000', PLACES, NAMES)).toBe('read <game>/Data/data.000')
  expect(clean('at readTable (D:\\Other\\twinmap\\out\\main\\index.js:12:5)', PLACES, NAMES)).toBe('at readTable (index.js:12:5)')
  expect(clean('at x (/home/someone/app/main.js:1:1)', PLACES, NAMES)).toBe('at x (main.js:1:1)')
  expect(clean('the sheet of Catubbio Sucameli on DESKTOP-K2 could not be read', PLACES, NAMES)).toBe('the sheet of <name> <name> on <name> could not be read')
  expect(clean('Catubbios and 1/2 stay', PLACES, NAMES)).toBe('Catubbios and 1/2 stay')
  expect(clean('two\nlines', PLACES, NAMES)).toBe('two lines')
  expect(clean('x'.repeat(400), PLACES, NAMES)).toHaveLength(300)
  expect(clean('\\\\server\\share', PLACES, NAMES)).toBe('share')
})

test('a report holds what was kept while the choice was on, and the server takes it as it is', () => {
  let on = false
  const stop = startHealth(() => on, () => null, () => [], () => [], () => {}).stop
  fault('kept while off')
  look(10, true)
  expect(report(PLACES, NAMES)).toBeNull()
  on = true
  fault(`map: cannot open ${GAME}\\Data`)
  fault(`map: cannot open ${GAME}\\Data`)
  for (const ms of [100, 200, 300, 400, 5000]) look(ms, ms < 400)
  const kept = report(PLACES, NAMES)!
  expect(kept).toEqual({ id: kept.id, errors: ['map: cannot open <game>\\Data'], looks: 5, failed: 2, ms: [300, 5000, 5000] })
  expect('error' in errorsFor(new URLSearchParams({ app: '0.14.0', build: '1.60.1.70938', locale: 'enUS' }), JSON.stringify(kept))).toBe(false)
  expect(report(PLACES, NAMES), 'taken away').toBeNull()
  stop()
})
