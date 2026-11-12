import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { startLog } from './log'

test('the record keeps what is said, says a subject again only when it changes, and gives back the latest lines without the account name', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'twinmap-log-')), 'twinmap.log')
  const log = startLog(file)
  log.say('started 0.1.0')
  log.note('map', 'looking')
  log.note('map', 'looking')
  log.note('map', "failed: EPERM open 'C:\\Users\\Someone\\AppData\\file'")
  const lines = log.read().split('\n')
  expect(lines).toHaveLength(3)
  expect(lines[0]).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z started 0\.1\.0$/)
  expect(lines[2]).toContain("C:\\Users\\...\\AppData\\file'")
  expect(readFileSync(file, 'utf8'), 'the file itself keeps the whole line').toContain('Someone')
  for (let i = 0; i < 300; i++) log.say(`line ${i}`)
  expect(log.read().split('\n')).toHaveLength(200)
  expect(log.read().endsWith('line 299')).toBe(true)
})

test('a record grown too big loses its older half at start', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'twinmap-log-')), 'twinmap.log')
  writeFileSync(file, Array.from({ length: 20000 }, (_, i) => `2026-01-01T00:00:00.000Z line ${i}`).join('\n') + '\n')
  const first = startLog(file).read().split('\n')
  expect(first.at(-1)).toContain('line 19999')
  expect(readFileSync(file, 'utf8').split('\n').length).toBeLessThan(10100)
})
