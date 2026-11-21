// node --test server/src/index.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { fenced, issueFor, LARGEST_LOG, LARGEST_SAMPLE, LONGEST, type Env } from './index.ts'

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
    delete: async (keys) => void [keys].flat().forEach((key) => kept.delete(key)),
    list: async ({ prefix = '' }) => ({ objects: [...kept].filter(([key]) => key.startsWith(prefix)).map(([key, one]) => ({ key, size: one.value.length })), truncated: false }),
  }
}
const env = (allowed = true, samples = bucket(), each = '5'): Env => {
  const limit = { limit: async () => ({ success: allowed }) }
  return { INBOX: 'someone/inbox', GITHUB_TOKEN: 'secret', LIMIT: limit, SAMPLE_LIMIT: limit, SAMPLES: samples, DAILY: '2', MAP_DAILY: each, LOG_DAILY: '2' }
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
  assert.deepEqual(count(samples), { all: 1, logs: 0, errors: 0, maps: { '36': [1, 0] }, bytes: png(238).length, apps: { '0.13.0': 1 }, refused: {} })
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
/** What is wanted of the minimap alone: the log has its own test. */
const mini = async (answer: Promise<Response>): Promise<unknown> => {
  const { log: _, errors: __, ...rest } = (await (await answer).json()) as Record<string, unknown>
  return rest
}

test('each dungeon has its own count for the day, of places found and of places not found, and says what it still wants', async () => {
  const samples = bucket(), e = { ...env(true, samples, '2'), DAILY: '100' }
  const found = { ...SAID, u: '10', v: '20', score: '0.9' }, followed = { ...SAID, u: '10', v: '20', score: '0.6' }
  assert.deepEqual(await mini(want('36', e)), { minimap: { found: 2, failed: 2 } })
  // Two with no sure place (one of them followed under SURE), then no more of those; the ones with a place still go.
  for (const [said, status] of [[{ ...SAID, n: '0' }, 201], [{ ...followed, n: '1' }, 201], [{ ...SAID, n: '2' }, 503], [{ ...found, n: '3' }, 201]] as const) assert.equal((await send(sample(said), e)).response.status, status)
  assert.deepEqual(await mini(want('36', e)), { minimap: { found: 1, failed: 0 } })
  // Another dungeon is not touched by it.
  assert.deepEqual(await mini(want('48', e)), { minimap: { found: 2, failed: 2 } })
  assert.equal((await send(sample({ ...SAID, map: '48' }), e)).response.status, 201)
  assert.deepEqual((count(samples) as { all: number; maps: unknown }).maps, { '36': [1, 2], '48': [0, 1] })
  assert.equal((count(samples) as { all: number }).all, 4)
  // The count of everyone caps what a dungeon may still want; a count kept as a bare number, as before, is read.
  assert.deepEqual(await mini(want('36', { ...e, DAILY: '4' })), { minimap: { found: 0, failed: 0 } })
  samples.kept.set(`count/${today}`, { value: '99' })
  assert.deepEqual(await mini(want('36', e)), { minimap: { found: 1, failed: 1 } })
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
  assert.deepEqual(await mini(want('36', e)), { minimap: { found: 2, failed: 2 } })
  // The kind off: the app is told it is not wanted, and one that sends all the same is refused and counted.
  for (const off of ['{"off":["minimap"]}', '{"off":["*"]}', '{"off":"minimap"}', 'not json', '[]']) {
    rules(off)
    assert.deepEqual(await mini(want('36', e)), {}, off)
    assert.equal(await taken(), 503, off)
  }
  assert.deepEqual(count(samples), { all: 0, logs: 0, errors: 0, maps: {}, bytes: 0, apps: {}, refused: { off: 5 } })
  // Another kind off leaves this one alone.
  rules('{"off":["trainers"]}')
  assert.deepEqual(await mini(want('36', e)), { minimap: { found: 2, failed: 2 } })
  // A dungeon left out, the others taken.
  rules('{"maps":[36]}')
  assert.deepEqual(await mini(want('36', e)), {})
  assert.equal(await taken(), 503)
  assert.deepEqual(await mini(want('48', e)), { minimap: { found: 2, failed: 2 } })
  assert.equal(await taken({ ...SAID, map: '48' }), 201)
  // An app older than asked for, and one that is not.
  rules('{"app":"0.13.1"}')
  assert.deepEqual(await mini(want('36', e)), {})
  assert.equal(await taken(), 503)
  assert.deepEqual(await mini(want('36', e, '0.13.1')), { minimap: { found: 1, failed: 1 } })
  assert.equal(await taken({ ...SAID, n: '8', app: '1.2.0' }), 201)
  assert.deepEqual(count(samples), { all: 2, logs: 0, errors: 0, maps: { '48': [0, 1], '36': [0, 1] }, bytes: 2 * png(238).length, apps: { '0.13.0': 1, '1.2.0': 1 }, refused: { off: 5, map: 1, app: 1 } })
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
  // Throwing away a day: only a day, only with the secret, and the count and the rules stay.
  samples.kept.set('rules', { value: '{}' })
  samples.kept.set('2026-01-01/0123456789abcdef/01.png', { value: 'another day' })
  for (const query of ['prefix=', 'prefix=count/', 'prefix=rules', `prefix=${today}`]) assert.equal((await kept(query, 'the-secret', 'DELETE')).status, 400)
  assert.equal((await kept(`prefix=${today}/`, undefined, 'DELETE')).status, 404)
  assert.deepEqual(await (await kept(`prefix=${today}/`, 'the-secret', 'DELETE')).json(), { deleted: 1 })
  assert.deepEqual([...samples.kept.keys()].sort(), ['2026-01-01/0123456789abcdef/01.png', `count/${today}`, 'rules'])
})

const GAME = { app: '0.14.0', build: '1.60.1.70938', locale: 'enUS' }
const SESSION = { log: 1, id: 'fedcba9876543210', v: '0.14.0', e: [['door', 12, 3065, 1455, 0.3012, 0.6243]] }
const logOf = (session: unknown = SESSION, said: Record<string, string> = GAME): Request => new Request(`https://api.twinmap.app/log?${new URLSearchParams(said)}`, { method: 'POST', body: typeof session === 'string' ? session : JSON.stringify(session) })
const wantLog = async (e: Env, query = 'app=0.14.0'): Promise<unknown> => (await worker.fetch(new Request(`https://api.twinmap.app/want?${query}`), e)).json()

test('a session of the log is kept under its day, written anew, and counted apart from the samples', async () => {
  const samples = bucket(), e = env(true, samples)
  assert.deepEqual(await wantLog(e), { log: { sessions: 2 }, errors: { reports: 0 } })
  assert.equal((await send(logOf(), e)).response.status, 201)
  const kept = samples.kept.get(`${today}/log/fedcba9876543210.json`)!
  assert.deepEqual(JSON.parse(String(kept.value)), SESSION)
  assert.deepEqual(kept.options, { httpMetadata: { contentType: 'application/json' }, customMetadata: GAME })
  assert.deepEqual(count(samples), { all: 0, logs: 1, errors: 0, maps: {}, bytes: JSON.stringify(SESSION).length, apps: { '0.14.0': 1 }, refused: {} })
  // With a dungeon in the asking, both kinds are answered for; the samples have their room whole.
  assert.deepEqual(await wantLog(e, 'map=36&app=0.14.0'), { minimap: { found: 2, failed: 2 }, log: { sessions: 1 }, errors: { reports: 0 } })
  // The same session again takes the place of the first; past the count of the day, refused.
  assert.equal((await send(logOf(), e)).response.status, 201)
  assert.equal((await send(logOf({ ...SESSION, id: '0000000000000001' }), e)).response.status, 503)
  assert.equal([...samples.kept.keys()].filter((key) => key.includes('/log/')).length, 1)
  assert.equal((await send(logOf(), env(false))).response.status, 429)
})

test('what is not a session of the log is refused: a text among the numbers, a name, anything more', async () => {
  for (const [i, [request, status]] of ([
    [logOf('not json'), 400],
    [logOf([SESSION]), 400],
    [logOf({ ...SESSION, e: [] }), 400],
    [logOf({ ...SESSION, e: [['door', 1, 'Someone']] }), 400],
    // A name only in a name entry, after two numbers, without quotes, backslashes or control characters, 64 at most.
    [logOf({ ...SESSION, e: [['npc', 1, 7464, 'Magma Totem II']] }), 400],
    [logOf({ ...SESSION, e: [['name', 1, 'Magma Totem II', 7464]] }), 400],
    [logOf({ ...SESSION, e: [['name', 1, 7464, 'Say "hi"']] }), 400],
    [logOf({ ...SESSION, e: [['name', 1, 7464, 'a\\b']] }), 400],
    [logOf({ ...SESSION, e: [['name', 1, 7464, 'line\nbreak']] }), 400],
    [logOf({ ...SESSION, e: [['name', 1, 7464, 'x'.repeat(65)]] }), 400],
    [logOf({ ...SESSION, e: [['name', 1, 7464, '']] }), 400],
    [logOf({ ...SESSION, e: [['name', 1, 7464, 'Magma Totem II', 2]] }), 400],
    [logOf({ ...SESSION, e: [['Door of Someone', 1, 2]] }), 400],
    [logOf({ ...SESSION, e: [['door', 1, [2]]] }), 400],
    [logOf({ ...SESSION, e: [['door']] }), 400],
    [logOf({ ...SESSION, e: [['door', ...Array<number>(20).fill(1)]] }), 400],
    [logOf({ ...SESSION, id: '../../count/x' }), 400],
    [logOf({ ...SESSION, v: 'new' }), 400],
    [logOf({ ...SESSION, log: 2 }), 400],
    [logOf({ ...SESSION, name: 'Someone' }), 400],
    [logOf(SESSION, { ...GAME, name: 'Someone' }), 400],
    [logOf(SESSION, { app: '0.14.0', build: '1.60.1.70938' }), 400],
    [logOf({ ...SESSION, e: Array(20000).fill(['door', 1, 123456.789]) }), 413],
  ] as const).entries()) {
    const samples = bucket()
    assert.equal((await send(request, env(true, samples))).response.status, status, `case ${i}`)
    assert.equal(samples.kept.size, 0)
  }
  assert.ok(JSON.stringify({ ...SESSION, e: Array(20000).fill(['door', 1, 123456.789]) }).length > LARGEST_LOG)
})

test('the log switched off in the rules leaves the samples of the minimap alone, and the other way round', async () => {
  const samples = bucket(), e = env(true, samples)
  const rules = (value: string): void => void samples.kept.set('rules', { value })
  rules('{"off":["log"]}')
  assert.deepEqual(await wantLog(e, 'map=36&app=0.14.0'), { minimap: { found: 2, failed: 2 }, errors: { reports: 0 } })
  assert.equal((await send(logOf(), e)).response.status, 503)
  assert.equal((await send(sample(), e)).response.status, 201)
  rules('{"off":["minimap"]}')
  assert.deepEqual(await wantLog(e, 'map=36&app=0.14.0'), { log: { sessions: 2 }, errors: { reports: 0 } })
  assert.equal((await send(logOf(), e)).response.status, 201)
  // A dungeon left out says nothing of the log, which is of no dungeon; an app too old is too old for both.
  rules('{"maps":[36],"app":"0.14.0"}')
  assert.deepEqual(await wantLog(e, 'map=36&app=0.14.0'), { log: { sessions: 1 }, errors: { reports: 0 } })
  assert.deepEqual(await wantLog(e, 'map=48&app=0.13.9'), {})
  assert.equal((await send(logOf(SESSION, { ...GAME, app: '0.13.9' }), e)).response.status, 503)
  assert.deepEqual((count(samples) as { refused: unknown }).refused, { off: 1, app: 1 })
})

test('a dungeon left out in the rules takes its bosses and rares out of a session of the log, and a session with nothing else is refused', async () => {
  const samples = bucket(), e = env(true, samples)
  samples.kept.set('rules', { value: '{"maps":[36]}' })
  const run = (map: number): unknown[][] => [['boss', 20, 2742, map, 1, 17066, 16748, 0.92], ['rare', 30, 3586, map, 0]]
  assert.equal((await send(logOf({ ...SESSION, e: [...SESSION.e, ...run(36), ...run(3065)] }), e)).response.status, 201)
  assert.deepEqual(JSON.parse(String(samples.kept.get(`${today}/log/fedcba9876543210.json`)!.value)).e, [...SESSION.e, ...run(3065)])
  assert.equal((await send(logOf({ ...SESSION, id: '0123456789abcdef', e: run(36) }), e)).response.status, 503)
  assert.equal(samples.kept.has(`${today}/log/0123456789abcdef.json`), false)
  assert.deepEqual((count(samples) as { refused: unknown; logs: number }).refused, { map: 1 })
})

const REPORT = { id: '00112233445566aa', errors: ['tiles: worker stopped: Cannot read properties of undefined (reading \'rows\')'], looks: 120, failed: 30, ms: [180, 420, 900] }
const reportOf = (report: unknown = REPORT, said: Record<string, string> = GAME): Request => new Request(`https://api.twinmap.app/errors?${new URLSearchParams(said)}`, { method: 'POST', body: typeof report === 'string' ? report : JSON.stringify(report) })

test("a report of the app's health is kept under its day, written anew, counted apart, and switched off on its own", async () => {
  const samples = bucket(), e = { ...env(true, samples), ERRORS_DAILY: '2' }
  assert.deepEqual(await wantLog(e), { log: { sessions: 2 }, errors: { reports: 2 } })
  assert.equal((await send(reportOf(), e)).response.status, 201)
  const kept = samples.kept.get(`${today}/errors/00112233445566aa.json`)!
  assert.deepEqual(JSON.parse(String(kept.value)), REPORT)
  assert.deepEqual((kept.options as { customMetadata: unknown }).customMetadata, GAME)
  assert.equal((count(samples) as { errors: number }).errors, 1)
  samples.kept.set('rules', { value: '{"off":["errors"]}' })
  assert.deepEqual(await wantLog(e), { log: { sessions: 2 } })
  assert.equal((await send(reportOf({ ...REPORT, id: '00112233445566bb' }), e)).response.status, 503)
  assert.equal((await send(logOf(), e)).response.status, 201)
})

test('what is not a report of the health is refused: a folder in a line, anything more, numbers that do not add up', async () => {
  const e = { ...env(), ERRORS_DAILY: '9' }
  for (const bad of [
    { ...REPORT, errors: ["ENOENT: no such file, open 'C:\\Games\\World of Warcraft\\_forever_\\x'"] },
    { ...REPORT, errors: ['at Object.<anonymous> (/Users/someone/app/main.js:1:1)'] },
    { ...REPORT, errors: ['open \\\\server\\share\\file'] },
    { ...REPORT, errors: ['a\nb'] },
    { ...REPORT, errors: ['x'.repeat(301)] },
    { ...REPORT, errors: Array(21).fill('x') },
    { ...REPORT, failed: 121 },
    { ...REPORT, ms: [] },
    { ...REPORT, looks: 0, failed: 0, ms: [], errors: [] },
    { ...REPORT, name: 'Catubbio' },
    { ...REPORT, id: 'someone' },
    'not json',
  ]) assert.equal((await send(reportOf(bad), e)).response.status, 400, JSON.stringify(bad))
  assert.equal((await send(reportOf(REPORT, { ...GAME, realm: 'x' }), e)).response.status, 400)
  assert.equal((await send(reportOf({ ...REPORT, looks: 0, failed: 0, ms: [] }), e)).response.status, 201)
})

test("a creature's name is the one text a session takes, in its own entry (M15-F24)", async () => {
  const samples = bucket(), e = env(true, samples)
  const named = { ...SESSION, e: [['name', 3, 268048, "Zul'jin's Herald (Forever)"], ['name', 4, 7464, 'Tótem de magma'], ['about', 3, 268048, 32, 1, 4, 7, 2]] }
  assert.equal((await send(logOf(named), e)).response.status, 201)
  assert.deepEqual(JSON.parse(String(samples.kept.get(`${today}/log/fedcba9876543210.json`)!.value)), named)
})

test('every hour the Worker asks GitHub to run the Action of the prices, and without its token asks nothing', async () => {
  const real = globalThis.fetch
  const asked: Request[] = []
  globalThis.fetch = async (url, init) => (asked.push(new Request(url as string, init)), new Response(null, { status: 204 }))
  try {
    await worker.scheduled(null, { ...env(), ACTIONS_TOKEN: 'actions' })
    assert.equal(asked.length, 1)
    assert.equal(asked[0]!.url, 'https://api.github.com/repos/catubba/twinmap-forever/actions/workflows/prices.yml/dispatches')
    assert.equal(asked[0]!.method, 'POST')
    assert.equal(asked[0]!.headers.get('authorization'), 'Bearer actions')
    assert.deepEqual(await asked[0]!.json(), { ref: 'main' })
    await worker.scheduled(null, env())
    assert.equal(asked.length, 1)
  } finally {
    globalThis.fetch = real
  }
})
