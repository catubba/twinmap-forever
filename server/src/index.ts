// api.twinmap.app: where the app sends what a player writes in the Feedback form. Each message
// becomes an issue in a private repository, read by hand. Nothing is kept here: no address of
// the sender, no copy of the message.
//
// What arrives is a stranger's text. It goes into the issue inside a code fence, so nothing in
// it is read as markdown: no mention, no link, no picture.
//
// It also takes the samples of the participation programme: a picture of the minimap inside a
// dungeon with a few figures about it, kept in a bucket that deletes them after twelve months.
// A sample says nothing of who sent it. Each dungeon has its own count for the day, so that many
// players in one dungeon do not take the room of the others; the app asks what is still wanted
// (/want) before it sends anything.
//
// What is taken can be narrowed without publishing this again: a file named rules in the bucket
// (Rules) switches a kind of data off, leaves a dungeon out, or asks for a newer app. The count of
// the day says what was taken and what was refused, and /kept, for us alone, lists and gives what
// is in the bucket.
//
// And it takes the sessions of the addon's log (/log): what the addon wrote down by itself, a kind
// and numbers an entry, read by the app from the game's saved settings. Kept in the same bucket,
// under the same rules as a kind of data of its own, "log".
//
// And the app's own reports of its health (/errors): the lines of its errors and how long its looks at
// the minimap took, with no place and no name. A kind of data of its own too, "errors".

export interface Env {
  INBOX: string // owner/name of the private repository
  GITHUB_TOKEN: string // a secret: may write issues in INBOX and nothing else
  LIMIT: Limit
  SAMPLE_LIMIT: Limit
  SAMPLES: Bucket
  DAILY: string // samples taken in a day, from everyone; 0 takes none
  MAP_DAILY: string // of them, from one dungeon: this many where the app found the place, and as many where it did not
  LOG_DAILY: string // sessions of the addon's log taken in a day, from everyone; 0 takes none
  ERRORS_DAILY?: string // reports of the app's health taken in a day, from everyone; 0 or none takes none
  ADMIN_TOKEN?: string // a secret: who has it may list and read the bucket (/kept); without it nobody may
  ACTIONS_TOKEN?: string // a secret: may run the workflows of PRICES and nothing else; without it the hour does nothing
}

// The prices of the auction houses: once an hour (the cron of wrangler.toml) this asks GitHub to run the Action
// that writes them (.github/workflows/prices.yml). GitHub's own schedule never ran it (21 November 2026).
export const PRICES = 'catubba/twinmap-forever/prices.yml'

export async function runPrices(env: Env): Promise<void> {
  if (!env.ACTIONS_TOKEN) return void console.error('prices: no ACTIONS_TOKEN')
  const [owner, repo, workflow] = PRICES.split('/')
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.ACTIONS_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'twinmap-api' },
    body: JSON.stringify({ ref: 'main' }),
  })
  if (r.status !== 204) console.error(`prices: GitHub answered ${r.status} ${await r.text()}`)
}
interface Limit {
  limit(options: { key: string }): Promise<{ success: boolean }>
}
/** What is used of an R2 bucket. */
export interface Bucket {
  get(key: string): Promise<{ text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer>; customMetadata?: Record<string, string> } | null>
  list(options: { prefix?: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string; size: number }[]; truncated: boolean; cursor?: string }>
  put(key: string, value: string | Uint8Array, options?: { httpMetadata?: { contentType: string }; customMetadata?: Record<string, string> }): Promise<unknown>
  delete(keys: string | string[]): Promise<unknown>
}

const LARGEST = 100_000 // bytes of a request
export const LONGEST = { message: 5000, email: 200, details: 1500, log: 50_000 } as const // characters; an issue holds 65,536

export const LARGEST_SAMPLE = 200_000 // bytes: a minimap cut wider than needed came to 144,000 as a PNG
export const LARGEST_LOG = 200_000 // bytes of a session: LARGEST of the addon's Log.lua, which keeps no more than that

const place = /^-?\d{1,6}(\.\d{1,2})?$/
/** What a sample may say, and nothing else: a name not here is refused. */
const FIELDS: Record<string, RegExp> = {
  run: /^[0-9a-f]{16}$/, // drawn anew at each dungeon entered
  n: /^\d{1,2}$/, // its number in the run: a run holds a hundred
  map: /^\d{1,5}$/,
  zoom: /^[0-5]$/,
  app: /^\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  build: /^\d{1,3}(\.\d{1,6}){3}$/,
  locale: /^[a-z]{2}[A-Z]{2}$/,
}
/** Where the app put the character and how sure it was: all three, or none when it found no place. */
const FOUND: Record<string, RegExp> = { u: place, v: place, score: /^(0(\.\d{1,4})?|1)$/ }
export const SURE = 0.75 // SURE of app/src/shared/minimap.ts: a likeness under this is a place not found
/** Whether a sample is one where the app found no sure place. */
const lost = (fields: Record<string, string>): boolean => !(Number(fields.score) >= SURE)

/** What was taken today: all the samples, for each dungeon those with a place found and those without, the sessions of the log, the bytes of everything, how many from each version of the app, and how many were refused and why. */
interface Counts {
  all: number
  logs: number
  errors: number
  maps: Record<string, [number, number]>
  bytes: number
  apps: Record<string, number>
  refused: Record<string, number>
}

/**
 * What is switched off without publishing the worker again, in the file rules of the bucket:
 *   { "off": ["minimap"], "maps": [36], "app": "0.14.0" }
 * off: the kinds of data not taken, "minimap", "log" or "errors" ("*" for all of them); maps: the dungeons not taken, their samples and the bosses and rares of the log alike; app: the
 * oldest version of the app still taken. No file, or a part left out, switches nothing off. A file
 * or a part that cannot be read switches that part off for everyone: a slip of the hand while
 * closing must not leave it open.
 */
export interface Rules {
  off?: unknown
  maps?: unknown
  app?: unknown
}
type Kind = 'minimap' | 'log' | 'errors'
async function rulesOf(env: Env): Promise<Rules> {
  try {
    const kept: unknown = JSON.parse((await (await env.SAMPLES.get('rules'))?.text()) ?? '{}')
    return typeof kept === 'object' && kept !== null && !Array.isArray(kept) ? kept : { off: '*' }
  } catch {
    return { off: '*' }
  }
}
const older = (a: string, b: string): boolean => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! < y[i]!
  return false
}
const REFUSED = { off: 'not taken for now', map: 'not taken from this dungeon', app: 'this version of Twinmap is too old', enough: 'enough samples for today' } as const
/** Why the rules leave out this kind of data from this version of the app, or null when they do not. map: the dungeon a sample is of; the log is of no dungeon. */
function ruledOut(rules: Rules, kind: Kind, map: string | null, app: string): keyof typeof REFUSED | null {
  const off = rules.off === undefined ? [] : Array.isArray(rules.off) ? rules.off.map(String) : ['*']
  if (off.includes('*') || off.includes(kind)) return 'off'
  if (map !== null && rules.maps !== undefined && (!Array.isArray(rules.maps) || rules.maps.map(String).includes(map))) return 'map'
  if (rules.app !== undefined && (typeof rules.app !== 'string' || !FIELDS.app!.test(rules.app) || older(app, rules.app))) return 'app'
  return null
}
/** The kinds of entry of the log that are of a dungeon, its map their fourth value: the bosses and the rares the app saw in a run. */
const OF_A_DUNGEON = new Set(['boss', 'rare'])
/** A session less the entries of the dungeons the rules leave out; null when nothing is left. A dungeon switched off takes its bosses with it. */
function withoutRuledMaps(body: string, rules: Rules): string | null {
  const session = JSON.parse(body) as { e: unknown[][] }
  const e = session.e.filter((entry) => !OF_A_DUNGEON.has(entry[0] as string) || ruledOut({ maps: rules.maps }, 'log', String(entry[3]), '0.0.0') !== 'map')
  return e.length > 0 ? JSON.stringify({ ...session, e }) : null
}
const today = (): string => new Date().toISOString().slice(0, 10)
async function countsOf(env: Env, day: string): Promise<Counts> {
  let kept: unknown = null
  try {
    kept = JSON.parse((await (await env.SAMPLES.get(`count/${day}`))?.text()) ?? 'null')
  } catch {
    // not ours: counted from nothing
  }
  if (typeof kept === 'number') kept = { all: kept } // as it was kept before the dungeons had their own counts
  const { all, logs, errors, maps, bytes, apps, refused } = (typeof kept === 'object' && kept !== null ? kept : {}) as Partial<Counts>
  const table = <T>(value: T | undefined): T => (typeof value === 'object' && value !== null ? value : {}) as T
  return { all: typeof all === 'number' ? all : 0, logs: typeof logs === 'number' ? logs : 0, errors: typeof errors === 'number' ? errors : 0, maps: table(maps), bytes: typeof bytes === 'number' ? bytes : 0, apps: table(apps), refused: table(refused) }
}
/** One refusal more in the count of the day, and the answer that says why. */
async function refuse(env: Env, day: string, counts: Counts, why: keyof typeof REFUSED): Promise<Response> {
  await env.SAMPLES.put(`count/${day}`, JSON.stringify({ ...counts, refused: { ...counts.refused, [why]: (counts.refused[why] ?? 0) + 1 } }))
  return answer(503, REFUSED[why])
}
/** How many more reports of the app's health are taken today. */
const wantedErrors = (counts: Counts, env: Env): number => Math.max(0, Number(env.ERRORS_DAILY ?? 0) - counts.errors) || 0

/** How many more sessions of the log are taken today. */
const wantedLogs = (counts: Counts, env: Env): number => Math.max(0, Number(env.LOG_DAILY) - counts.logs) || 0
/** How many more samples of a dungeon are taken today, of each kind. */
function wanted(counts: Counts, env: Env, map: string): { found: number; failed: number } {
  const room = Number(env.DAILY) - counts.all, each = Number(env.MAP_DAILY), [found, failed] = counts.maps[map] ?? [0, 0]
  const left = (taken: number): number => Math.max(0, Math.min(room, each - taken)) || 0
  return { found: left(found), failed: left(failed) }
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]

/** What is kept of a sample, or the reason it is refused. */
// ponytail: only the head of the PNG is read, so the rest may be anything under LARGEST_SAMPLE.
// Nothing here opens a sample; whoever reads them (design/) decodes with care.
export function sampleFor(said: URLSearchParams, bytes: Uint8Array): { key: string; fields: Record<string, string> } | { error: string } {
  const fields = Object.fromEntries(said)
  const found = Object.keys(FOUND).filter((name) => name in fields).length
  if ([...said.keys()].length !== Object.keys(fields).length || (found !== 0 && found !== 3)) return { error: 'not a sample' }
  if (Object.keys(fields).length !== Object.keys(FIELDS).length + found) return { error: 'not a sample' }
  for (const [name, value] of Object.entries(fields)) if (!(FIELDS[name] ?? FOUND[name])?.test(value)) return { error: 'not a sample' }
  if (bytes.length < 24 || PNG.some((byte, i) => bytes[i] !== byte)) return { error: 'not a picture' }
  const sizes = new DataView(bytes.buffer, bytes.byteOffset), width = sizes.getUint32(16), height = sizes.getUint32(20)
  if (width !== height || width < 32 || width > 1024) return { error: 'not a minimap' }
  return { key: `${fields.run}/${fields.n!.padStart(2, '0')}.png`, fields }
}

const SAID = ['app', 'build', 'locale'] as const // what the app says of the game a session comes from
const ENTRY_KIND = /^[a-z]{1,12}$/
/** The one text an entry may hold: a creature's name, in a "name" entry (M15-F24). No control character, no quote, no backslash. */
const CREATURE_NAME = /^[^\p{C}"\\]{1,64}$/u
/**
 * What is kept of a session of the addon's log, or the reason it is refused. A session is
 * { "log": 1, "id": 16 hex digits, "v": version of the addon, "e": entries }, an entry a kind and
 * numbers: nothing else gets in, so no text a player wrote. The one text taken is a creature's name,
 * the game server's own, in an entry ["name", second, creature, name] (M15-F24). What is kept is
 * written anew from what was read.
 */
export function logFor(said: URLSearchParams, text: string): { key: string; fields: Record<string, string>; body: string } | { error: string } {
  const fields = Object.fromEntries(said)
  if ([...said.keys()].length !== SAID.length || SAID.some((name) => !FIELDS[name]!.test(fields[name] ?? ''))) return { error: 'not a log' }
  let read: unknown
  try {
    read = JSON.parse(text)
  } catch {
    return { error: 'not a log' }
  }
  if (typeof read !== 'object' || read === null || Array.isArray(read)) return { error: 'not a log' }
  const { log, id, v, e, ...more } = read as Record<string, unknown>
  if (log !== 1 || Object.keys(more).length > 0 || typeof id !== 'string' || !FIELDS.run!.test(id) || typeof v !== 'string' || !FIELDS.app!.test(v) || !Array.isArray(e) || e.length < 1) return { error: 'not a log' }
  for (const entry of e as unknown[]) {
    if (!Array.isArray(entry) || entry.length < 2 || entry.length > 20 || typeof entry[0] !== 'string' || !ENTRY_KIND.test(entry[0])) return { error: 'not a log' }
    const named = entry[0] === 'name' && entry.length === 4 && typeof entry[3] === 'string' && CREATURE_NAME.test(entry[3])
    if ((named ? entry.slice(1, 3) : entry.slice(1)).some((n) => typeof n !== 'number' || !Number.isFinite(n))) return { error: 'not a log' }
  }
  return { key: `log/${id}.json`, fields, body: JSON.stringify({ log, id, v, e }) }
}

const answer = (status: number, error?: string): Response => Response.json(error ? { error } : { ok: true }, { status })

/** A text as a code block whose fence is longer than any run of backticks inside it. */
export function fenced(text: string): string {
  const fence = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((run) => run[0].length + 1)))
  return `${fence}\n${text}\n${fence}`
}

/** The issue for a message, or the reason it is refused. */
export function issueFor(sent: unknown): { title: string; body: string } | { error: string } {
  if (typeof sent !== 'object' || sent === null) return { error: 'not a message' }
  const part = (name: keyof typeof LONGEST): string | null => {
    const value = (sent as Record<string, unknown>)[name] ?? ''
    return typeof value === 'string' && value.length <= LONGEST[name] ? value.trim() : null
  }
  const message = part('message'), email = part('email'), details = part('details'), log = part('log')
  if (message === null || email === null || details === null || log === null) return { error: 'too long' }
  if (!message) return { error: 'empty message' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'not an email address' }
  const first = message.split('\n')[0]
  return {
    title: first.length > 80 ? `${first.slice(0, 77)}...` : first,
    body: [
      fenced(message),
      ...(email ? ['Reply to:', fenced(email)] : []),
      ...(details ? ['Details:', fenced(details)] : []),
      ...(log ? ['Log:', fenced(log)] : []),
    ].join('\n\n'),
  }
}

async function feedback(request: Request, env: Env, address: string): Promise<Response> {
  const { success } = await env.LIMIT.limit({ key: address })
  if (!success) return answer(429, 'too many messages, try again in a minute')
  const text = await request.text()
  if (text.length > LARGEST) return answer(413, 'too long')
  let sent: unknown
  try {
    sent = JSON.parse(text)
  } catch {
    return answer(400, 'not a message')
  }
  const issue = issueFor(sent)
  if ('error' in issue) return answer(400, issue.error)
  const made = await fetch(`https://api.github.com/repos/${env.INBOX}/issues`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'twinmap-api' },
    body: JSON.stringify(issue),
  })
  return made.ok ? answer(201) : answer(502, 'the message could not be delivered')
}

/** The picture is the body, what is said of it is in the address: /sample?run=...&n=0&map=36&... */
async function sample(request: Request, env: Env, address: string): Promise<Response> {
  const { success } = await env.SAMPLE_LIMIT.limit({ key: address })
  if (!success) return answer(429, 'too many samples, try again in a minute')
  if (Number(request.headers.get('content-length')) > LARGEST_SAMPLE) return answer(413, 'too large')
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length > LARGEST_SAMPLE) return answer(413, 'too large')
  const kept = sampleFor(new URL(request.url).searchParams, bytes)
  if ('error' in kept) return answer(400, kept.error)
  // ponytail: read, then write: two samples at the same instant count as one, so a day may take a
  // few over DAILY. A Durable Object counts exactly, if that ever matters.
  const day = today(), counts = await countsOf(env, day), map = kept.fields.map!, app = kept.fields.app!, kind = lost(kept.fields) ? 1 : 0
  const why = ruledOut(await rulesOf(env), 'minimap', map, app) ?? (wanted(counts, env, map)[kind ? 'failed' : 'found'] > 0 ? null : 'enough')
  // The app asks before it sends, so a refusal here is rare: an app that did not ask, or a rule changed meanwhile.
  if (why) return refuse(env, day, counts, why)
  const of = counts.maps[map] ?? [0, 0]
  of[kind]++
  await env.SAMPLES.put(`count/${day}`, JSON.stringify({ ...counts, all: counts.all + 1, maps: { ...counts.maps, [map]: of }, bytes: counts.bytes + bytes.length, apps: { ...counts.apps, [app]: (counts.apps[app] ?? 0) + 1 } }))
  await env.SAMPLES.put(`${day}/${kept.key}`, bytes, { httpMetadata: { contentType: 'image/png' }, customMetadata: kept.fields })
  return answer(201)
}

/** The session is the body, what is said of the game it comes from is in the address: /log?app=...&build=...&locale=... A session sent twice is kept once. */
async function log(request: Request, env: Env, address: string): Promise<Response> {
  const { success } = await env.SAMPLE_LIMIT.limit({ key: address })
  if (!success) return answer(429, 'too many samples, try again in a minute')
  if (Number(request.headers.get('content-length')) > LARGEST_LOG) return answer(413, 'too large')
  const text = await request.text()
  if (text.length > LARGEST_LOG) return answer(413, 'too large')
  const kept = logFor(new URL(request.url).searchParams, text)
  if ('error' in kept) return answer(400, kept.error)
  const day = today(), counts = await countsOf(env, day), app = kept.fields.app!, rules = await rulesOf(env)
  const body = withoutRuledMaps(kept.body, rules)
  const why = ruledOut(rules, 'log', null, app) ?? (body === null ? 'map' : null) ?? (wantedLogs(counts, env) > 0 ? null : 'enough')
  if (why || body === null) return refuse(env, day, counts, why ?? 'map')
  await env.SAMPLES.put(`count/${day}`, JSON.stringify({ ...counts, logs: counts.logs + 1, bytes: counts.bytes + body.length, apps: { ...counts.apps, [app]: (counts.apps[app] ?? 0) + 1 } }))
  await env.SAMPLES.put(`${day}/${kept.key}`, body, { httpMetadata: { contentType: 'application/json' }, customMetadata: kept.fields })
  return answer(201)
}

const MOST_LINES = 20, LONGEST_LINE = 300
// A folder, as it would be written on Windows or elsewhere: a drive, a share, a home. The app takes them out; one that is still here refuses the report.
const FOLDER = /[A-Za-z]:[\\/]|\\\\|(^|[\s('"=])\/(Users|home|mnt|Volumes|var|tmp|private)\/|[\\/]Users[\\/]/i
/**
 * What is kept of a report of the app's health, or the reason it is refused. The address says
 * app, build and locale and nothing else; the body is { "id": 16 hex digits drawn anew,
 * "errors": [lines], "looks": n, "failed": n, "ms": [middle, 95 in 100, longest] } and nothing else:
 * at most twenty lines of printable text with no folder in them, whole numbers, and the times only
 * when there were looks.
 */
export function errorsFor(said: URLSearchParams, text: string): { key: string; fields: Record<string, string>; body: string } | { error: string } {
  const SAID = ['app', 'build', 'locale'], fields = Object.fromEntries(said)
  if ([...said.keys()].length !== SAID.length || SAID.some((name) => !FIELDS[name]!.test(fields[name] ?? ''))) return { error: 'not a report' }
  let read: unknown
  try {
    read = JSON.parse(text)
  } catch {
    return { error: 'not a report' }
  }
  if (typeof read !== 'object' || read === null || Array.isArray(read)) return { error: 'not a report' }
  const { id, errors, looks, failed, ms, ...more } = read as Record<string, unknown>
  const whole = (n: unknown, most: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= most
  if (Object.keys(more).length > 0 || typeof id !== 'string' || !FIELDS.run!.test(id) || !Array.isArray(errors) || errors.length > MOST_LINES) return { error: 'not a report' }
  if (!whole(looks, 10_000_000) || !whole(failed, looks) || !Array.isArray(ms) || ms.length !== (looks > 0 ? 3 : 0) || !ms.every((n) => whole(n, 600_000))) return { error: 'not a report' }
  for (const line of errors) if (typeof line !== 'string' || line.length < 1 || line.length > LONGEST_LINE || /[\u0000-\u001f\u007f]/.test(line) || FOLDER.test(line)) return { error: 'not a report' }
  if (errors.length === 0 && looks === 0) return { error: 'not a report' }
  return { key: `errors/${id}.json`, fields, body: JSON.stringify({ id, errors, looks, failed, ms }) }
}

/** The report is the body, what is said of the app and the game is in the address: /errors?app=...&build=...&locale=... A report sent twice is kept once. */
async function errorsReport(request: Request, env: Env, address: string): Promise<Response> {
  const { success } = await env.SAMPLE_LIMIT.limit({ key: address })
  if (!success) return answer(429, 'too many samples, try again in a minute')
  if (Number(request.headers.get('content-length')) > LARGEST) return answer(413, 'too large')
  const text = await request.text()
  if (text.length > LARGEST) return answer(413, 'too large')
  const kept = errorsFor(new URL(request.url).searchParams, text)
  if ('error' in kept) return answer(400, kept.error)
  const day = today(), counts = await countsOf(env, day), app = kept.fields.app!
  const why = ruledOut(await rulesOf(env), 'errors', null, app) ?? (wantedErrors(counts, env) > 0 ? null : 'enough')
  if (why) return refuse(env, day, counts, why)
  await env.SAMPLES.put(`count/${day}`, JSON.stringify({ ...counts, errors: counts.errors + 1, bytes: counts.bytes + kept.body.length, apps: { ...counts.apps, [app]: (counts.apps[app] ?? 0) + 1 } }))
  await env.SAMPLES.put(`${day}/${kept.key}`, kept.body, { httpMetadata: { contentType: 'application/json' }, customMetadata: kept.fields })
  return answer(201)
}

/**
 * What is still wanted today from this version of the app, by kind of data:
 * /want?map=36&app=0.14.0 answers { "minimap": { "found": 3, "failed": 100 }, "log": { "sessions": 990 } }.
 * A kind that is not in the answer is not wanted at all. Without a map the samples of the minimap,
 * which are of a dungeon, are not answered for. Asked by the app before it sends; nothing is kept of the asking.
 */
async function want(request: Request, env: Env, address: string): Promise<Response> {
  const { success } = await env.SAMPLE_LIMIT.limit({ key: address })
  if (!success) return answer(429, 'too many samples, try again in a minute')
  const asked = new URL(request.url).searchParams, map = asked.get('map'), app = asked.get('app') ?? ''
  if (map !== null && !FIELDS.map!.test(map)) return answer(400, 'not a map')
  if (!FIELDS.app!.test(app)) return answer(400, 'not an app')
  const rules = await rulesOf(env), counts = await countsOf(env, today())
  return Response.json({
    ...(map !== null && !ruledOut(rules, 'minimap', map, app) ? { minimap: wanted(counts, env, map) } : {}),
    ...(!ruledOut(rules, 'log', null, app) ? { log: { sessions: wantedLogs(counts, env) } } : {}),
    ...(!ruledOut(rules, 'errors', null, app) ? { errors: { reports: wantedErrors(counts, env) } } : {}),
  })
}

const same = (a: string, b: string): boolean => {
  let differ = a.length ^ b.length
  for (let i = 0; i < a.length; i++) differ |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1))
  return differ === 0
}
/**
 * For us alone, with the secret: what the bucket holds under a prefix, a thousand at a time
 * (/kept?prefix=2026-11-20/), or one thing of it (/kept?key=...), with what was said of it in the
 * header x-fields. DELETE /kept?prefix=2026-11-20/ throws away what was kept on that day; only a day,
 * so the rules and the counts cannot go with it. To anyone else this path is not there.
 */
async function kept(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_TOKEN || !same(request.headers.get('authorization') ?? '', `Bearer ${env.ADMIN_TOKEN}`)) return answer(404, 'not found')
  const asked = new URL(request.url).searchParams, key = asked.get('key')
  if (request.method === 'DELETE') {
    const prefix = asked.get('prefix') ?? ''
    if (!/^\d{4}-\d\d-\d\d\/$/.test(prefix)) return answer(400, 'a day only, as 2026-11-20/')
    let deleted = 0
    for (;;) {
      const keys = (await env.SAMPLES.list({ prefix, limit: 1000 })).objects.map((one) => one.key)
      if (!keys.length) return Response.json({ deleted })
      await env.SAMPLES.delete(keys)
      deleted += keys.length
    }
  }
  if (key !== null) {
    const one = await env.SAMPLES.get(key)
    return one ? new Response(await one.arrayBuffer(), { headers: { 'content-type': 'application/octet-stream', 'x-fields': JSON.stringify(one.customMetadata ?? {}) } }) : answer(404, 'not found')
  }
  const listed = await env.SAMPLES.list({ prefix: asked.get('prefix') ?? '', cursor: asked.get('cursor') ?? undefined, limit: 1000 })
  return Response.json({ keys: listed.objects.map(({ key, size }) => ({ key, size })), cursor: listed.truncated ? listed.cursor : null })
}

export default {
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await runPrices(env)
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path !== '/feedback' && path !== '/sample' && path !== '/log' && path !== '/errors' && path !== '/want' && path !== '/kept') return answer(404, 'not found')
    if (path === '/kept') return request.method === 'GET' || request.method === 'DELETE' ? kept(request, env) : answer(404, 'not found')
    // The address is the key of the limit and is not written anywhere.
    const address = request.headers.get('cf-connecting-ip') ?? 'unknown'
    if (path === '/want') return request.method === 'GET' ? want(request, env, address) : answer(405, 'GET only')
    if (request.method !== 'POST') return answer(405, 'POST only')
    return path === '/sample' ? sample(request, env, address) : path === '/log' ? log(request, env, address) : path === '/errors' ? errorsReport(request, env, address) : feedback(request, env, address)
  },
}
