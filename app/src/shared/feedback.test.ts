import { expect, test } from 'vitest'
import { feedbackDetails, feedbackLink } from './feedback'

const setup = { gameFolder: 'C:\Users\Someone\Games\WoW', addon: '0.1.0', questie: true, shortestPath: false, done: true, version: '0.1.0', onTop: false }

test('the details say what the app knows about itself, and nothing of the player', () => {
  const details = feedbackDetails(setup, { state: 'no-game' }, 'Game not running')
  expect(details).toContain('Twinmap 0.1.0')
  expect(details).toContain('Twinmap Forever addon: 0.1.0')
  expect(details).toContain('Link: Game not running')
  expect(details).toContain('QuestieDB: installed')
  expect(details).toContain('Shortest Path: not installed')
  expect(details, 'no folder of the player').not.toContain('Someone')
  expect(feedbackDetails(setup, { state: 'failed', message: "EPERM: open 'C:\\Users\\Someone\\AppData\\x'" }, null)).toContain("'C:\\Users\\...\\AppData\\x'")
  expect(feedbackDetails({ ...setup, addon: null, gameFolder: null }, null, null)).toContain('Twinmap Forever addon: not installed')
})

test('a report opens on GitHub or as a letter, and nowhere else', () => {
  const github = feedbackLink('github', 'Twinmap 0.1.0\nLink: Connected')!
  expect(github.startsWith('https://github.com/catubba/twinmap-forever/issues/new?body=')).toBe(true)
  expect(decodeURIComponent(github)).toContain('---\nTwinmap 0.1.0\nLink: Connected')
  const email = feedbackLink('email', 'Twinmap 0.1.0')!
  expect(email.startsWith('mailto:dev@twinmap.app?subject=Twinmap%20feedback&body=')).toBe(true)
  for (const way of ['https://example.com', undefined, 'toString']) expect(feedbackLink(way, 'x')).toBeNull()
  expect(feedbackLink('github', { toString: () => 'x' }), 'details that are not text are left out').not.toBeNull()
  expect(feedbackLink('email', 'a&b=c d'.repeat(1000))!.length, 'long details are cut').toBeLessThan(8000)
  expect(feedbackLink('email', 'a&b=c')).toContain('a%26b%3Dc')
})
