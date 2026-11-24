import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { newsFor, releasesIn, releasesOf, type News } from './news'

const changelog = readFileSync(join(__dirname, '..', '..', '..', 'CHANGELOG.md'), 'utf8')

test('the CHANGELOG reads as releases, newest first, each entry with its kind, its title and its text', () => {
  const all = releasesOf(changelog)
  expect(all.length).toBeGreaterThan(20)
  expect(all.at(-1)).toMatchObject({ version: '0.1.0', date: '2026-11-13' })
  const r161 = all.find((r) => r.version === '0.16.1')!
  expect(r161.date).toBe('2026-11-24')
  expect(r161.entries.map((e) => e.kind)).toEqual(['New', 'New', 'New', 'Fixed'])
  expect(r161.entries[0]).toMatchObject({ title: 'Ore and herbs by kind.', text: expect.stringMatching(/^In Layers, the arrow/) })
  // A line of a section that is no entry is kept as a note.
  expect(all.find((r) => r.version === '0.13.0')?.notes).toContain('The addon is the same as in 0.12.1, with the new number.')
})

const SAMPLE = `## 0.17.0 - 2026-12-01

### New

- **First.** One.
- **Second.** Two.

### Fixed

- **Third.** Three.

## 0.16.1 - 2026-11-24

### New

- **Old.** Before the window.

## 0.16.0 - 2026-11-23

### New

- **Older.** Before that.
`
const NEWS: Record<string, News> = {
  '0.17.0': { langs: { frFR: '### New\n\n- **Premier.** Un.\n- **Deuxième.** Deux.\n\n### Fixed\n\n- **Troisième.** Trois.' }, go: { 'Second.': 'layers', 'Third.': 'settings' } },
}

test('a release is shown in the language of its file of news/, its links on the entries at the same places; one with none, in English', () => {
  const fr = releasesIn('frFR', releasesOf(SAMPLE), NEWS)
  expect(fr[0]!.entries).toEqual([
    { kind: 'New', title: 'Premier.', text: 'Un.' },
    { kind: 'New', title: 'Deuxième.', text: 'Deux.', go: 'layers' },
    { kind: 'Fixed', title: 'Troisième.', text: 'Trois.', go: 'settings' },
  ])
  expect(fr[1]!.entries[0]!.title, 'no file: English').toBe('Old.')
  expect(releasesIn('deDE', releasesOf(SAMPLE), NEWS)[0]!.entries[1], 'no German: English, with its link').toEqual({ kind: 'New', title: 'Second.', text: 'Two.', go: 'layers' })
})

test('the versions shown: those since the one seen up to this one, only this one when not known, every one from Settings', () => {
  const versions = (since: string, version: string): string[] => newsFor('enUS', since, version, releasesOf(SAMPLE), NEWS).map((r) => r.version)
  expect(versions('0.16.0', '0.17.0')).toEqual(['0.17.0', '0.16.1'])
  expect(versions('', '0.17.0')).toEqual(['0.17.0'])
  expect(versions('all', '0.17.0')).toEqual(['0.17.0', '0.16.1', '0.16.0'])
  expect(versions('0.16.0', '0.16.1'), 'a release written in the CHANGELOG but not out in this app').toEqual(['0.16.1'])
  expect(versions('', '0.0.0'), 'an app built from the sources').toEqual([])
})
