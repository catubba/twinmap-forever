import { expect, test } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { feedbackDetails, feedbackLink, sendFeedback } from './feedback'

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

// A server on this computer plays api.twinmap.app: nothing in these tests leaves it.
async function withServer<T>(answer: (body: Record<string, string>) => { status: number; body?: unknown }, run: (to: string, got: Record<string, string>[]) => Promise<T>): Promise<T> {
  const got: Record<string, string>[] = []
  const server = createServer((request, response) => {
    let text = ''
    request.on('data', (chunk) => (text += chunk))
    request.on('end', () => {
      got.push(JSON.parse(text))
      const { status, body } = answer(got.at(-1)!)
      response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body ?? { ok: true }))
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  try {
    return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/feedback`, got)
  } finally {
    server.close()
  }
}

test('Send delivers the message with the details, and the log only when asked for', async () => {
  await withServer(() => ({ status: 201 }), async (to, got) => {
    const sent = { message: 'The arrow is wrong', email: ' me@example.com ', details: 'Twinmap 0.5.0', withLog: false }
    expect(await sendFeedback(sent, () => 'the log', to)).toBeNull()
    expect(got[0]).toEqual({ message: 'The arrow is wrong', email: 'me@example.com', details: 'Twinmap 0.5.0', log: '' })
    expect(await sendFeedback({ ...sent, withLog: true }, () => 'the log', to)).toBeNull()
    expect(got[1]!.log).toBe('the log')
  })
})

test('an empty or oversized message is refused here, and nothing is sent', async () => {
  await withServer(() => ({ status: 201 }), async (to, got) => {
    for (const message of ['', '   ', undefined, 42, 'x'.repeat(5001)]) expect(await sendFeedback({ message }, () => '', to)).toEqual(expect.any(String))
    expect(await sendFeedback(null, () => '', to)).toEqual(expect.any(String))
    expect(got).toEqual([])
  })
})

test('a failure is said in words, whatever it is', async () => {
  await withServer((body) => (body.email ? { status: 400, body: { error: 'not an email address' } } : { status: body.message === 'burst' ? 429 : 502 }), async (to) => {
    expect(await sendFeedback({ message: 'hi', email: 'nobody' }, () => '', to)).toMatch(/email address/)
    expect(await sendFeedback({ message: 'burst' }, () => '', to)).toMatch(/Wait a minute/)
    expect(await sendFeedback({ message: 'hi' }, () => '', to)).toMatch(/could not be delivered/)
  })
  expect(await sendFeedback({ message: 'hi' }, () => '', 'http://127.0.0.1:9/feedback'), 'no server there').toMatch(/No answer/)
})

test('the page that says what a message carries opens from the window', () => {
  expect(feedbackLink('privacy', 'x')).toBe('https://twinmap.app/privacy.html')
})
