// api.twinmap.app: where the app sends what a player writes in the Feedback form. Each message
// becomes an issue in a private repository, read by hand. Nothing is kept here: no address of
// the sender, no copy of the message.
//
// What arrives is a stranger's text. It goes into the issue inside a code fence, so nothing in
// it is read as markdown: no mention, no link, no picture.

export interface Env {
  INBOX: string // owner/name of the private repository
  GITHUB_TOKEN: string // a secret: may write issues in INBOX and nothing else
  LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

const LARGEST = 100_000 // bytes of a request
export const LONGEST = { message: 5000, email: 200, details: 1500, log: 50_000 } as const // characters; an issue holds 65,536

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/feedback') return answer(404, 'not found')
    if (request.method !== 'POST') return answer(405, 'POST only')
    // The address is the key of the limit and is not written anywhere.
    const { success } = await env.LIMIT.limit({ key: request.headers.get('cf-connecting-ip') ?? 'unknown' })
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
  },
}
