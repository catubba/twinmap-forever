import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { LinkStatus } from '../shared/link'
import { setupComplete, setupSteps } from '../shared/setup'
import { addonVersion, readSettings, setupStatus, writeSettings } from './setup'

const folder = (): string => mkdtempSync(join(tmpdir(), 'twinmap-setup-'))
const addons = (game: string, ...names: string[]): void => {
  for (const name of names) mkdirSync(join(game, '_forever_', 'Interface', 'AddOns', name), { recursive: true })
}
const CONNECTED: LinkStatus = { kind: 'connected', word: 'Connected', tone: 'done' }
const CLOSED: LinkStatus = { kind: 'closed', word: 'Game not running', tone: 'objective' }

test('the addon is found by its .toc, with its version; Questie by its folder', () => {
  const game = folder()
  expect(setupStatus(game, false)).toEqual({ gameFolder: game, addon: null, questie: false, done: false })
  addons(game, 'TwinmapForever', 'Questie')
  expect(addonVersion(game), 'a folder with no .toc is not the addon').toBeNull()
  writeFileSync(join(game, '_forever_', 'Interface', 'AddOns', 'TwinmapForever', 'TwinmapForever.toc'), '## Interface: 11508\r\n## Title: Twinmap Forever\r\n## Version: 0.1.0\r\nTwinmapForever.lua\r\n')
  expect(setupStatus(game, true)).toEqual({ gameFolder: game, addon: '0.1.0', questie: true, done: true })
  expect(setupStatus(null, false)).toEqual({ gameFolder: null, addon: null, questie: false, done: false })
})

test('settings come back as they were written, and a file that is not ours gives none', () => {
  const file = join(folder(), 'settings.json')
  expect(readSettings(file)).toEqual({})
  writeSettings(file, { gameFolder: 'D:\\Games\\WoW', setupDone: true })
  expect(readSettings(file)).toEqual({ gameFolder: 'D:\\Games\\WoW', setupDone: true })
  writeFileSync(file, '{"gameFolder": 7, "setupDone": "yes", "other": 1}')
  expect(readSettings(file)).toEqual({})
  writeFileSync(file, 'not json')
  expect(readSettings(file)).toEqual({})
})

test('the steps of the first run, from nothing to the arrow', () => {
  const states = (setup: Parameters<typeof setupSteps>[0], link: LinkStatus | null) => setupSteps(setup, link).map((s) => s.state)
  const none = { gameFolder: null, addon: null, questie: false, done: false }
  expect(states(none, CLOSED)).toEqual(['todo', 'waiting', 'waiting', 'waiting'])
  const found = { ...none, gameFolder: 'D:\\WoW' }
  expect(states(found, CLOSED)).toEqual(['done', 'todo', 'waiting', 'todo'])
  expect(setupSteps(found, CLOSED)[1]!.action).toBe('curseforge')
  const installed = { ...found, addon: '0.1.0' }
  expect(states(installed, CLOSED)).toEqual(['done', 'done', 'todo', 'todo'])
  expect(setupComplete(setupSteps(installed, CLOSED))).toBe(false)
  expect(states(installed, CONNECTED)).toEqual(['done', 'done', 'done', 'todo'])
  expect(setupComplete(setupSteps(installed, CONNECTED)), 'Questie is optional').toBe(true)
})

test('the third step says what is wrong: an addon to tick, or one of the two to update', () => {
  const installed = { gameFolder: 'D:\\WoW', addon: '0.1.0', questie: true, done: false }
  const lost = setupSteps(installed, { kind: 'lost', word: 'Link lost', tone: 'objective' })[2]!
  expect(lost.state).toBe('todo')
  expect(lost.lines.join(' ')).toContain('make sure Twinmap Forever is ticked')
  const old = setupSteps(installed, { kind: 'update-addon', word: 'Update the addon', tone: 'objective', line: 'Update the addon from CurseForge.' })[2]!
  expect(old).toMatchObject({ state: 'problem', lines: ['Update the addon from CurseForge.'] })
})
