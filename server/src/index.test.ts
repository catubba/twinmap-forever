// node --test server/src/index.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { fenced, issueFor, LARGEST_SAMPLE, LONGEST, type Env } from './index.ts'

/** A bucket in memory, with what was put in it. */
function bucket(): Env['SAMPLES'] & { kept: Map<string, { value: string | Uint8Array; options?: unknown }> } {
  const kept = new Map<string, { value: string | Uint8Array; options?: unknown }>()
  return {
    kept,
    get: async (key) => {
      const one = kept.get(key)
      if (!one) return null
      const bytes = typeof one.value === 'string' ? new TextEncoder().encode(one.value) : one.value
      return { text: async () => String(one.value), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, customMetadata: (one.options as { customMetadata?: Record<string, string> } | undefined)?.customMetadata }
    },
    put: async (key, value, options) => kept.set(key, { value, options }),
    list: async ({ prefix = '' }) => ({ objects: [...kept].filter(([key]) => key.startsWith(prefix)).map(([key, one]) => ({ key, size: one.value.length })), truncated: false }),
  }
}
const env = (allowed = true, samples = bucket(), each = '5'): Env => {
  const limit = { limit: async () => ({ success: allowed }) }
  return { INBOX: 'someone/inbox', GITHUB_TOKEN: 'secret', LIMIT: limit, SAMPLE_LIMIT: limit, SAMPLES: samples, DAILY: '2', MAP_DAILY: each }
}
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

/** The head of a PNG of that size, and bytes after it up to `length`. */
function png(width: number, height = width, length = 1000): Uint8Array {
  const bytes = new Uint8Array(length)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}
const SAID = { run: '0123456789abcdef', n: '7', map: '36', zoom: '0', app: '0.13.0', build: '1.60.1.70938', locale: 'enUS' }
const sample = (said: Record<string, string> = SAID, body: Uint8Array | string = png(238)): Request => new Request(`https://api.twinmap.app/sample?${new URLSearchParams(said)}`, { method: 'POST', body })
const today = new Date().toISOString().slice(0, 10)
const count = (samples: ReturnType<typeof bucket>): unknown => JSON.parse(String(samples.kept.get(`count/${today}`)!.value))

test('a sample is kept under its day and its run, with what it says', async () => {
  const samples = bucket()
  const said = { ...SAID, u: '-120.5', v: '48', score: '0.8312' }
  const { response, asked } = await send(sample(said), env(true, samples))
  assert.equal(response.status, 201)
  assert.equal(asked, null)
  const kept = samples.kept.get(`${today}/0123456789abcdef/07.png`)!
  assert.deepEqual(kept.value, png(238))
  assert.deepEqual(kept.options, { httpMetadata: { contentType: 'image/png' }, customMetadata: said })
  assert.deepEqual(count(samples), { all: 1, maps: { '36': [1, 0] }, bytes: png(238).length, apps: { '0.13.0': 1 }, refused: {} })
})

test('what is not a sample is refused, and nothing is kept', async () => {
  const { map: _, ...short } = SAID
  for (const [request, status] of [
    [sample(SAID, 'not a picture, only some words to fill the place of one'), 400],
    [sample(SAID, png(238, 100)), 400],
    [sample(SAID, png(4000)), 400],
    [sample(SAID, png(238, 238, LARGEST_SAMPLE + 1)), 413],
    [sample(short), 400],
    [sample({ ...SAID, name: 'Someone' }), 400],
    [sample({ ...SAID, n: '100' }), 400],
    [sample({ ...SAID, run: '../../count/x' }), 400],
    [sample({ ...SAID, u: '1', v: '2' }), 400],
    [sample({ ...SAID, u: '1', v: '2', score: '7' }), 400],
    [new Request(`https://api.twinmap.app/sample?${new URLSearchParams(SAID)}&map=1`, { method: 'POST', body: png(238) }), 400],
  ] as const) {
    const samples = bucket()
    assert.equal((await send(request, env(true, samples))).response.status, status, request.url)
    assert.equal(samples.kept.size, 0)
  }
})

test('past the day\'s count, and in a burst from one address, a sample is refused', async () => {
  const samples = bucket()
  for (const [n, status] of [['0', 201], ['1', 201], ['2', 503]] as const) assert.equal((await send(sample({ ...SAID, n }), env(true, samples))).response.status, status)
  assert.equal(samples.kept.size, 3) // two samples and the count
  assert.equal((await send(sample(), env(false))).response.status, 429)
})

const want = (map: string, e: Env, app = '0.13.0'): Promise<Response> => worker.fetch(new Request(`https://api.twinmap.app/want?map=${map}&app=${app}`), e)

test('each dungeon has its own count for the day, of places found and of places not found, and says what it still wants', async () => {
  const samples = bucket(), e = { ...env(true, samples, '2'), DAILY: '100' }
  const found = { ...SAID, u: '10', v: '20', score: '0.9' }, followed = { ...SAID, u: '10', v: '20', score: '0.6' }
  assert.deepEqual(await (await want('36', e)).json(), { minimap: { found: 2, failed: 2 } })
  // Two with no sure place (one of them followed under SURE), then no more of those; the ones with a place still go.
  for (const [said, status] of [[{ ...SAID, n: '0' }, 201], [{ ...followed, n: '1' }, 201], [{ ...SAID, n: '2' }, 503], [{ ...found, n: '3' }, 201]] as const) assert.equal((await send(sample(said), e)).response.status, status)
  assert.deepEqual(await (await want('36', e)).json(), { minimap: { found: 1, failed: 0 } })
  // Another dungeon is not touched by it.
  assert.deepEqual(await (await want('48', e)).json(), { minimap: { found: 2, failed: 2 } })
  assert.equal((await send(sample({ ...SAID, map: '48' }), e)).response.status, 201)
  assert.deepEqual((count(samples) as { all: number; maps: unknown }).maps, { '36': [1, 2], '48': [0, 1] })
  assert.equal((count(samples) as { all: number }).all, 4)
  // The count of everyone caps what a dungeon may still want; a count kept as a bare number, as before, is read.
  assert.deepEqual(await (await want('36', { ...e, DAILY: '4' })).json(), { minimap: { found: 0, failed: 0 } })
  samples.kept.set(`count/${today}`, { value: '99' })
  assert.deepEqual(await (await want('36', e)).json(), { minimap: { found: 1, failed: 1 } })
  assert.equal((await want('x', e)).status, 400)
  assert.equal((await want('36', e, 'new')).status, 400)
  assert.equal((await want('36', env(false))).status, 429)
  assert.equal((await worker.fetch(new Request('https://api.twinmap.app/want?map=36', { method: 'POST' }), e)).status, 405)
})

test('the rules in the bucket switch a kind off, leave a dungeon out and ask for a newer app, with nothing published again', async () => {
  const samples = bucket(), e = env(true, samples, '5')
  const rules = (value: string): void => void samples.kept.set('rules', { value })
  const taken = async (said: Record<string, string> = SAID): Promise<number> => (await send(sample(said), e)).response.status
  // No rules: everything is taken.
  assert.deepEqual(await (await want('36', e)).json(), { minimap: { found: 2, failed: 2 } })
  // The kind off: the app is told it is not wanted, and one that sends all the same is refused and counted.
  for (const off of ['{"off":["minimap"]}', '{"off":["*"]}', '{"off":"minimap"}', 'not json', '[]']) {
    rules(off)
    assert.deepEqual(await (await want('36', e)).json(), {}, off)
    assert.equal(await taken(), 503, off)
  }
  assert.deepEqual(count(samples), { all: 0, maps: {}, bytes: 0, apps: {}, refused: { off: 5 } })
  // Another kind off leaves this one alone.
  rules('{"off":["trainers"]}')
  assert.deepEqual(await (await want('36', e)).json(), { minimap: { found: 2, failed: 2 } })
  // A dungeon left out, the others taken.
  rules('{"maps":[36]}')
  assert.deepEqual(await (await want('36', e)).json(), {})
  assert.equal(await taken(), 503)
  assert.deepEqual(await (await want('48', e)).json(), { minimap: { found: 2, failed: 2 } })
  assert.equal(await taken({ ...SAID, map: '48' }), 201)
  // An app older than asked for, and one that is not.
  rules('{"app":"0.13.1"}')
  assert.deepEqual(await (await want('36', e)).json(), {})
  assert.equal(await taken(), 503)
  assert.deepEqual(await (await want('36', e, '0.13.1')).json(), { minimap: { found: 1, failed: 1 } })
  assert.equal(await taken({ ...SAID, n: '8', app: '1.2.0' }), 201)
  assert.deepEqual(count(samples), { all: 2, maps: { '48': [0, 1], '36': [0, 1] }, bytes: 2 * png(238).length, apps: { '0.13.0': 1, '1.2.0': 1 }, refused: { off: 5, map: 1, app: 1 } })
  // Past the count of the day a refusal is counted too.
  assert.equal(await taken({ ...SAID, n: '9', app: '1.2.0' }), 503)
  assert.equal((count(samples) as { refused: Record<string, number> }).refused.enough, 1)
})

test('what is kept is listed and given to who has the secret, and to nobody else', async () => {
  const samples = bucket(), e = { ...env(true, samples), ADMIN_TOKEN: 'the-secret' }
  const said = { ...SAID, u: '1', v: '2', score: '0.9' }
  await send(sample(said), e)
  const kept = (query: string, token?: string, method = 'GET'): Promise<Response> => worker.fetch(new Request(`https://api.twinmap.app/kept?${query}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {} }), e)
  for (const refused of [await kept('prefix='), await kept('prefix=', 'another'), await kept('prefix=', 'the-secret', 'POST'), await worker.fetch(new Request('https://api.twinmap.app/kept?prefix=', { headers: { authorization: 'Bearer undefined' } }), env(true, samples))]) assert.equal(refused.status, 404)
  assert.deepEqual(await (await kept(`prefix=${today}/`, 'the-secret')).json(), { keys: [{ key: `${today}/0123456789abcdef/07.png`, size: png(238).length }], cursor: null })
  const one = await kept(`key=${today}/0123456789abcdef/07.png`, 'the-secret')
  assert.deepEqual(new Uint8Array(await one.arrayBuffer()), png(238))
  assert.deepEqual(JSON.parse(one.headers.get('x-fields')!), said)
  assert.equal((await kept('key=nothing', 'the-secret')).status, 404)
})
