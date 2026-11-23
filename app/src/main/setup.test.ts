import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { LinkStatus } from '../shared/link'
import { setupComplete, setupPages, timeLeft, type SetupStatus, pageOf } from '../shared/setup'
import type { TilesStatus } from '../shared/tiles-status'
import { addonVersion, askLangOf, readSettings, setupStatus, writeSettings } from './setup'

const folder = (): string => mkdtempSync(join(tmpdir(), 'twinmap-setup-'))
const addons = (game: string, ...names: string[]): void => {
  for (const name of names) mkdirSync(join(game, '_forever_', 'Interface', 'AddOns', name), { recursive: true })
}
const CONNECTED: LinkStatus = { kind: 'connected', word: 'Connected', tone: 'done' }
const CLOSED: LinkStatus = { kind: 'closed', word: 'Game not running', tone: 'objective' }
const READY: TilesStatus = { state: 'ready', folder: 'x', version: '1.60.1', tiles: 9302, missing: 0, seconds: 16, converted: true }

test('the addon is found by its .toc, with its version; Questie by the file of its data', () => {
  const game = folder()
  expect(setupStatus(game, {}, '0.1.0')).toEqual({ gameFolder: game, addon: null, questie: false, shortestPath: false, done: false, version: '0.1.0', onTop: false, participate: null })
  addons(game, 'TwinmapForever', 'Questie', 'QuestieDB')
  expect(setupStatus(game, {}, '0.1.0').questie, 'Questie with no data to read').toBe(false)
  writeFileSync(join(game, '_forever_', 'Interface', 'AddOns', 'QuestieDB', 'QuestieDB_Forever.toc'), '## Version: 1.0.13\r\n')
  expect(addonVersion(game), 'a folder with no .toc is not the addon').toBeNull()
  writeFileSync(join(game, '_forever_', 'Interface', 'AddOns', 'TwinmapForever', 'TwinmapForever.toc'), '## Interface: 11508\r\n## Title: Twinmap Forever\r\n## Version: 0.1.0\r\nTwinmapForever.lua\r\n')
  expect(setupStatus(game, { setupDone: true, onTop: true, participate: false }, '0.1.0')).toEqual({ gameFolder: game, addon: '0.1.0', questie: true, shortestPath: false, done: true, version: '0.1.0', onTop: true, participate: false })
  addons(game, 'ShortestPathForever')
  expect(setupStatus(game, {}, '0.1.0').shortestPath, 'Shortest Path by its folder').toBe(true)
  expect(setupStatus(null, {}, '0.1.0')).toMatchObject({ gameFolder: null, addon: null, questie: false })
})

test('settings come back as they were written, and a file that is not ours gives none', () => {
  const file = join(folder(), 'settings.json')
  expect(readSettings(file)).toEqual({})
  writeSettings(file, { gameFolder: 'D:\\Games\\WoW', setupDone: true, onTop: true })
  expect(readSettings(file)).toEqual({ gameFolder: 'D:\\Games\\WoW', setupDone: true, onTop: true })
  // A no to Help improve Twinmap is kept too: it is what tells the question was asked.
  writeSettings(file, { participate: false })
  expect(readSettings(file)).toEqual({ participate: false })
  writeSettings(file, { zoom: 1.25 })
  expect(readSettings(file)).toEqual({ zoom: 1.25 })
  writeSettings(file, { noGpu: true })
  expect(readSettings(file)).toEqual({ noGpu: true })
  writeSettings(file, { noGpu: false })
  expect(readSettings(file)).toEqual({})
  writeFileSync(file, '{"gameFolder": 7, "setupDone": "yes", "zoom": 9, "other": 1}')
  expect(readSettings(file)).toEqual({})
  writeFileSync(file, 'not json')
  expect(readSettings(file)).toEqual({})
})

const states = (setup: SetupStatus, tiles: TilesStatus | null, link: LinkStatus | null) => Object.fromEntries(setupPages(setup, tiles, link).map((p) => [p.id, p.state]))

test('the pages of the first run, from nothing to the arrow', () => {
  const none = { gameFolder: null, addon: null, questie: false, shortestPath: false, done: false, version: '0.1.0', onTop: false, participate: false }
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
  const installed = { gameFolder: 'D:\\WoW', addon: '0.1.0', questie: true, shortestPath: false, done: false, version: '0.1.0', onTop: false, participate: false }
  expect(setupPages(installed, { state: 'failed', message: 'disk full' }, CLOSED)[1]).toMatchObject({ state: 'problem', lines: ['The map could not be built.', 'disk full', expect.stringContaining('try again')], action: 'retry' })
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

test('an optional addon that is missing gets a button to its own page, and no other page can be asked for', () => {
  const setup = { gameFolder: 'D:\WoW', addon: '0.1.0', questie: true, shortestPath: false, done: false, version: '0.1.0', onTop: false, participate: false }
  const extras = (s: typeof setup): unknown => setupPages(s, { state: 'looking' }, null).find((p) => p.id === 'extras')!.get
  expect(extras(setup)).toEqual(['shortestPath'])
  expect(extras({ ...setup, questie: false })).toEqual(['questie', 'shortestPath'])
  expect(extras({ ...setup, shortestPath: true })).toEqual([])
  expect(pageOf('questie')).toBe('https://www.curseforge.com/wow/addons/questiedb')
  expect(pageOf('shortestPath')).toBe('https://www.curseforge.com/wow/addons/shortest-path-forever')
  for (const other of [undefined, 'toString', 'https://example.com', 7]) expect(pageOf(other)).toBe('https://www.curseforge.com/wow/addons/twinmap-forever')
})

test('the language is asked once after the update, only to a player whose game speaks one the app speaks now', () => {
  const french = (code: string): boolean => code === 'frFR'
  expect(askLangOf({ setupDone: true }, 'frFR', french), 'had Twinmap before, game in French').toBe(true)
  expect(askLangOf({}, 'frFR', french), 'a new player: the first run asks').toBe(false)
  expect(askLangOf({ setupDone: true, langAsked: true }, 'frFR', french), 'asked already').toBe(false)
  expect(askLangOf({ setupDone: true, lang: 'enUS' }, 'frFR', french), 'chose one already').toBe(false)
  expect(askLangOf({ setupDone: true }, 'enUS', french), 'game in English').toBe(false)
  expect(askLangOf({ setupDone: true }, 'deDE', french), 'game in a language not out yet').toBe(false)
  expect(askLangOf({ setupDone: true }, null, french), 'game folder not found').toBe(false)
})

test('the language asked is kept between runs', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'twinmap-')), 'settings.json')
  writeSettings(file, { setupDone: true, langAsked: true, lang: 'frFR' })
  expect(readSettings(file)).toEqual({ setupDone: true, langAsked: true, lang: 'frFR' })
  writeSettings(file, { lang: 'pseudo-ko' }) // a pseudo-language of a script, for trials
  expect(readSettings(file)).toEqual({ lang: 'pseudo-ko' })
})
