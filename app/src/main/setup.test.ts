import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { LinkStatus } from '../shared/link'
import { setupComplete, setupPages, timeLeft, type SetupStatus } from '../shared/setup'
import type { TilesStatus } from '../shared/tiles-status'
import { addonVersion, readSettings, setupStatus, writeSettings } from './setup'

const folder = (): string => mkdtempSync(join(tmpdir(), 'twinmap-setup-'))
const addons = (game: string, ...names: string[]): void => {
  for (const name of names) mkdirSync(join(game, '_forever_', 'Interface', 'AddOns', name), { recursive: true })
}
const CONNECTED: LinkStatus = { kind: 'connected', word: 'Connected', tone: 'done' }
const CLOSED: LinkStatus = { kind: 'closed', word: 'Game not running', tone: 'objective' }
const READY: TilesStatus = { state: 'ready', folder: 'x', version: '1.60.1', tiles: 9302, missing: 0, seconds: 16, converted: true }

test('the addon is found by its .toc, with its version; Questie by its folder', () => {
  const game = folder()
  expect(setupStatus(game, {}, '0.1.0')).toEqual({ gameFolder: game, addon: null, questie: false, done: false, version: '0.1.0', onTop: false })
  addons(game, 'TwinmapForever', 'Questie')
  expect(addonVersion(game), 'a folder with no .toc is not the addon').toBeNull()
  writeFileSync(join(game, '_forever_', 'Interface', 'AddOns', 'TwinmapForever', 'TwinmapForever.toc'), '## Interface: 11508\r\n## Title: Twinmap Forever\r\n## Version: 0.1.0\r\nTwinmapForever.lua\r\n')
  expect(setupStatus(game, { setupDone: true, onTop: true }, '0.1.0')).toEqual({ gameFolder: game, addon: '0.1.0', questie: true, done: true, version: '0.1.0', onTop: true })
  expect(setupStatus(null, {}, '0.1.0')).toMatchObject({ gameFolder: null, addon: null, questie: false })
})

test('settings come back as they were written, and a file that is not ours gives none', () => {
  const file = join(folder(), 'settings.json')
  expect(readSettings(file)).toEqual({})
  writeSettings(file, { gameFolder: 'D:\\Games\\WoW', setupDone: true, onTop: true })
  expect(readSettings(file)).toEqual({ gameFolder: 'D:\\Games\\WoW', setupDone: true, onTop: true })
  writeFileSync(file, '{"gameFolder": 7, "setupDone": "yes", "other": 1}')
  expect(readSettings(file)).toEqual({})
  writeFileSync(file, 'not json')
  expect(readSettings(file)).toEqual({})
})

const states = (setup: SetupStatus, tiles: TilesStatus | null, link: LinkStatus | null) => Object.fromEntries(setupPages(setup, tiles, link).map((p) => [p.id, p.state]))

test('the pages of the first run, from nothing to the arrow', () => {
  const none = { gameFolder: null, addon: null, questie: false, done: false, version: '0.1.0', onTop: false }
  expect(states(none, { state: 'no-game' }, CLOSED)).toEqual({ game: 'todo', map: 'todo', addon: 'todo', extras: 'done', play: 'todo' })
  const found = { ...none, gameFolder: 'D:\\WoW' }
  expect(states(found, { state: 'converting', percent: 40 }, CLOSED)).toMatchObject({ game: 'done', map: 'working' })
  expect(setupPages(found, { state: 'converting', percent: 40 }, CLOSED)[1]!.progress).toBe(40)
  expect(setupPages(found, READY, CLOSED)[1]!.lines).toEqual(['The map is ready.', '9,302 tiles from game version 1.60.1.'])
  expect(setupPages(found, READY, CLOSED)[2]!.action).toBe('curseforge')
  const installed = { ...found, addon: '0.1.0' }
  expect(setupComplete(setupPages(installed, READY, CLOSED))).toBe(false)
  expect(setupComplete(setupPages(installed, { state: 'converting', percent: 99 }, CONNECTED)), 'not before the map is built').toBe(false)
  expect(setupComplete(setupPages(installed, READY, CONNECTED)), 'Questie is optional').toBe(true)
})

test('what went wrong is said on its page: a map not built, an addon to tick, one of the two to update', () => {
  const installed = { gameFolder: 'D:\\WoW', addon: '0.1.0', questie: true, done: false, version: '0.1.0', onTop: false }
  expect(setupPages(installed, { state: 'failed', message: 'disk full' }, CLOSED)[1]).toMatchObject({ state: 'problem', lines: ['The map could not be built.', 'disk full'], action: 'retry' })
  const lost = setupPages(installed, READY, { kind: 'lost', word: 'Link lost', tone: 'objective' })[4]!
  expect(lost.state).toBe('todo')
  expect(lost.lines.join(' ')).toContain('make sure Twinmap Forever is ticked')
  // The warning about the flickering strip is on its two pages whatever their state.
  expect(setupPages(installed, READY, CLOSED).filter((p) => p.warning?.startsWith('Photosensitivity warning')).map((p) => p.id)).toEqual(['addon', 'play'])
  const old = setupPages(installed, READY, { kind: 'update-addon', word: 'Update the addon', tone: 'objective', line: 'Update the addon from CurseForge.' })[4]!
  expect(old).toMatchObject({ state: 'problem', lines: ['Update the addon from CurseForge.'] })
})

test('the time left is said once there is something to tell it from, in round numbers', () => {
  expect(timeLeft(0, 0, 2000, 20), 'too early').toBe('')
  expect(timeLeft(0, 10, 5000, 10), 'nothing moved').toBe('')
  expect(timeLeft(0, 0, 10_000, 50)).toBe('about 10 seconds left')
  expect(timeLeft(0, 20, 8000, 40)).toBe('about 25 seconds left')
  expect(timeLeft(0, 0, 30_000, 10)).toBe('about 5 min left')
  expect(timeLeft(0, 0, 30_000, 100)).toBe('')
})
