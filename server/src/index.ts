// api.twinmap.app: where the app sends what a player writes in the Feedback form. Each message
// becomes an issue in a private repository, read by hand. Nothing is kept here: no address of
// the sender, no copy of the message.
//
// What arrives is a stranger's text. It goes into the issue inside a code fence, so nothing in
// it is read as markdown: no mention, no link, no picture.
//
// It also takes the samples of the participation programme: a picture of the minimap inside a
// dungeon with a few figures about it, kept in a bucket that deletes them after twelve months.
// A sample says nothing of who sent it.

export interface Env {
  INBOX: string // owner/name of the private repository
  GITHUB_TOKEN: string // a secret: may write issues in INBOX and nothing else
  LIMIT: Limit
  SAMPLE_LIMIT: Limit
  SAMPLES: Bucket
  DAILY: string // samples taken in a day, from everyone; 0 takes none
}
interface Limit {
  limit(options: { key: string }): Promise<{ success: boolean }>
}
/** What is used of an R2 bucket. */
export interface Bucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>
  put(key: string, value: string | Uint8Array, options?: { httpMetadata?: { contentType: string }; customMetadata?: Record<string, string> }): Promise<unknown>
}

const LARGEST = 100_000 // bytes of a request
export const LONGEST = { message: 5000, email: 200, details: 1500, log: 50_000 } as const // characters; an issue holds 65,536

export const LARGEST_SAMPLE = 200_000 // bytes: a minimap cut wider than needed came to 144,000 as a PNG

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
  const day = new Date().toISOString().slice(0, 10)
  const taken = Number((await (await env.SAMPLES.get(`count/${day}`))?.text()) ?? 0)
  if (!(taken < Number(env.DAILY))) return answer(503, 'enough samples for today')
  await env.SAMPLES.put(`count/${day}`, String(taken + 1))
  await env.SAMPLES.put(`${day}/${kept.key}`, bytes, { httpMetadata: { contentType: 'image/png' }, customMetadata: kept.fields })
  return answer(201)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path !== '/feedback' && path !== '/sample') return answer(404, 'not found')
    if (request.method !== 'POST') return answer(405, 'POST only')
    // The address is the key of the limit and is not written anywhere.
    const address = request.headers.get('cf-connecting-ip') ?? 'unknown'
    return path === '/sample' ? sample(request, env, address) : feedback(request, env, address)
  },
}
