// node --test server/src/index.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { fenced, issueFor, LONGEST, type Env } from './index.ts'

const env = (allowed = true): Env => ({ INBOX: 'someone/inbox', GITHUB_TOKEN: 'secret', LIMIT: { limit: async () => ({ success: allowed }) } })
const post = (body: string, path = '/feedback'): Request => new Request(`https://api.twinmap.app${path}`, { method: 'POST', body })

/** Runs the worker with GitHub played by `github`, and says what GitHub was asked. */
async function send(request: Request, e = env(), github = new Response('{}', { status: 201 })): Promise<{ response: Response; asked: Request | null }> {
  const real = globalThis.fetch
  let asked: Request | null = null
  globalThis.fetch = async (url, init) => ((asked = new Request(url as string, init)), github)
  try {
    return { response: await worker.fetch(request, e), asked }
  } finally {
    globalThis.fetch = real
  }
}

test('a message becomes an issue in the inbox', async () => {
  const { response, asked } = await send(post(JSON.stringify({ message: 'The arrow is wrong\nin Deadmines', email: 'me@example.com', details: 'Twinmap 0.5.0' })))
  assert.equal(response.status, 201)
  assert.equal(asked!.url, 'https://api.github.com/repos/someone/inbox/issues')
  assert.equal(asked!.headers.get('authorization'), 'Bearer secret')
  const issue = await asked!.json()
  assert.equal(issue.title, 'The arrow is wrong')
  assert.match(issue.body, /in Deadmines/)
  assert.match(issue.body, /me@example\.com/)
  assert.match(issue.body, /Twinmap 0\.5\.0/)
})

test('what is not a message is refused, and GitHub is not asked', async () => {
  const long = 'x'.repeat(LONGEST.message + 1)
  for (const [body, status] of [
    ['', 400],
    ['not json', 400],
    ['"a string"', 400],
    [JSON.stringify({ message: '   ' }), 400],
    [JSON.stringify({ message: long }), 400],
    [JSON.stringify({ message: 'hi', email: 'nobody' }), 400],
    [JSON.stringify({ message: 'hi', log: 42 }), 400],
    ['x'.repeat(100_001), 413],
  ] as const) {
    const { response, asked } = await send(post(body))
    assert.equal(response.status, status, body.slice(0, 40))
    assert.equal(asked, null)
  }
})

test('a burst from one address is refused', async () => {
  const { response, asked } = await send(post(JSON.stringify({ message: 'hi' })), env(false))
  assert.equal(response.status, 429)
  assert.equal(asked, null)
})

test('other paths and methods are refused', async () => {
  assert.equal((await send(post('{}', '/'))).response.status, 404)
  assert.equal((await send(new Request('https://api.twinmap.app/feedback'))).response.status, 405)
})

test('a failure of GitHub is said, without its words', async () => {
  const { response } = await send(post(JSON.stringify({ message: 'hi' })), env(), new Response('Bad credentials', { status: 401 }))
  assert.equal(response.status, 502)
  assert.doesNotMatch(await response.text(), /credentials/)
})

test('a message cannot leave its code fence', () => {
  const text = 'look ```` @someone\n```\n# title'
  const block = fenced(text)
  assert.ok(block.startsWith('`````\n') && block.endsWith('\n`````'))
  const issue = issueFor({ message: text })
  assert.ok(!('error' in issue) && issue.body === block)
})
