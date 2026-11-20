import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { logFor } from '../../../server/src/index'
import { logFiles, sendLog, sessionsIn, startGameLog, withoutPlaced } from './gamelog'

const SAID = { app: '0.14.0', build: '1.60.1.70938', locale: 'enUS' }
const session = (id: string): string => JSON.stringify({ log: 1, id, v: '0.14.0', e: [['door', 3, 3065, 1455, 0.3012, 0.62]] })
// The file as the game writes it, with other texts around the sessions.
const saved = (...ids: string[]): string => `\nTwinmapForeverDB = {\n\t["position"] = "TOP",\n\t["log"] = {\n${ids.map((id, i) => `\t\t${JSON.stringify(session(id))}, -- [${i + 1}]\n`).join('')}\t},\n\t["inbox"] = {\n\t\t["id"] = "ab\\"cd",\n\t},\n}\n`
const A = '00000000000000aa', B = '00000000000000bb'

test('the sessions are taken out of the file the game writes, as the server takes them', () => {
  const read = sessionsIn(saved(A, B))
  expect(read.map((s) => s.id)).toEqual([A, B])
  expect(read[0]!.text).toBe(session(A))
  expect('error' in logFor(new URLSearchParams(SAID), read[0]!.text)).toBe(false)
  expect(sessionsIn(saved())).toEqual([])
  expect(sessionsIn(saved(A).slice(0, 120))).toEqual([]) // a file cut short while the game writes it
  expect(sessionsIn('x = "{\\"log\\":1,\\"id\\":\\"someone\\"}"')).toEqual([])
})

/** A server here that plays api.twinmap.app: answers[n] is the status of the n-th session posted (201 past the end), wanted what /want says. */
async function served(wanted: unknown, answers: number[] = []): Promise<{ to: string; asked: string[]; posted: string[]; close: () => void }> {
  const asked: string[] = [], posted: string[] = []
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', (piece) => (body += piece))
    request.on('end', () => {
      asked.push(`${request.method} ${request.url}`)
      if (request.method === 'GET') return void response.end(JSON.stringify(wanted))
      const status = answers[posted.length] ?? 201
      posted.push(body)
      response.writeHead(status).end('{}')
    })
  })
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
  return { to: `http://127.0.0.1:${(server.address() as AddressInfo).port}/log`, asked, posted, close: () => server.close() }
}
const both = [{ id: A, text: session(A) }, { id: B, text: session(B) }]

test('the server is asked first, and only what it wants is sent', async () => {
  const some = await served({ log: { sessions: 1 } })
  expect(await sendLog(both, SAID, () => true, some.to)).toEqual([A])
  expect(some.asked).toEqual(['GET /want?app=0.14.0', `POST /log?${new URLSearchParams(SAID)}`])
  expect(some.posted).toEqual([session(A)])
  some.close()
  // The kind switched off on the server, the samples of the minimap still wanted: nothing of the log leaves.
  const none = await served({ minimap: { found: 5, failed: 5 } })
  expect(await sendLog(both, SAID, () => true, none.to)).toEqual([])
  expect(none.posted).toEqual([])
  none.close()
})

test('a send that fails stops there, and one the server calls no session is not tried again', async () => {
  const failing = await served({ log: { sessions: 9 } }, [400, 503])
  expect(await sendLog(both, SAID, () => true, failing.to)).toEqual([A])
  expect(failing.posted.length).toBe(2)
  failing.close()
  expect(await sendLog(both, SAID, () => true, 'http://127.0.0.1:9/log')).toEqual([])
})

test('a session goes once; one whose send failed goes at the next read; with the choice off the file is not read', async () => {
  const root = mkdtempSync(join(tmpdir(), 'twinmap-gamelog-')), folder = join(root, '_forever_', 'WTF', 'Account', 'ACCOUNT', 'SavedVariables')
  mkdirSync(folder, { recursive: true })
  const file = join(folder, 'TwinmapForever.lua'), sentFile = join(root, 'log-sent.json')
  let stamp = 1_700_000_000
  const write = (...ids: string[]): void => (writeFileSync(file, saved(...ids)), utimesSync(file, stamp, ++stamp))
  write(A)
  expect(logFiles(root)).toEqual([file])
  const server = await served({ log: { sessions: 9 } }, [503])
  let on = false
  const said: string[] = []
  const settle = async (lines: number): Promise<void> => {
    for (let i = 0; i < 100 && said.length < lines; i++) await new Promise((next) => setTimeout(next, 20))
  }
  const start = (): { stop: () => void } => startGameLog(() => root, sentFile, () => SAID, () => on, (line) => said.push(line), server.to)
  // Off: nothing is asked.
  start().stop()
  await new Promise((next) => setTimeout(next, 100))
  expect(server.asked).toEqual([])
  // On: the first send fails (503), and nothing is marked as sent.
  on = true
  start().stop()
  await settle(1)
  expect(said).toEqual(['log: 0 of 1 sessions sent'])
  // The next read, at the next start of the app: it goes.
  start().stop()
  await settle(2)
  expect(said[1]).toBe('log: 1 of 1 sessions sent')
  expect(JSON.parse(readFileSync(sentFile, 'utf8'))).toEqual([A])
  // Another start, and the game saving the same session with a new one: only the new one goes.
  start().stop()
  await new Promise((next) => setTimeout(next, 100))
  write(A, B)
  start().stop()
  await settle(3)
  expect(said[2]).toBe('log: 1 of 1 sessions sent')
  expect(server.posted).toEqual([session(A), session(A), session(B)])
  server.close()
  rmSync(root, { recursive: true, force: true })
})

test('what QuestieDB has with a place is taken out of a session, the rest kept as written; nothing left, nothing to send', async () => {
  const e = [['door', 1, 3065, 1455, 0.3, 0.6], ['npc', 2, 5111, 1455, 0.3, 0.6], ['npc', 3, 99999, 1455, 0.3, 0.6], ['quest', 4, 26, 2, 1455, 0.3, 0.6], ['object', 5, 2843, 1455, 0.3, 0.6]]
  const text = JSON.stringify({ log: 1, id: A, v: '0.14.0', e })
  const asked: [string, number][][] = []
  const known = new Set(['npc 5111', 'object 2843'])
  const placed = (asks: [string, number][]): Promise<boolean[]> => (asked.push(asks), Promise.resolve(asks.map(([kind, id]) => known.has(`${kind} ${id}`))))
  const kept = await withoutPlaced(text, placed)
  expect(asked).toEqual([[['npc', 5111], ['npc', 99999], ['quest', 26], ['object', 2843]]])
  expect(JSON.parse(kept!).e).toEqual([e[0], e[2], e[3]])
  expect('error' in logFor(new URLSearchParams(SAID), kept!)).toBe(false)
  expect(await withoutPlaced(session(B), placed)).toBe(session(B)) // nothing to ask: as written
  expect(await withoutPlaced(JSON.stringify({ log: 1, id: A, v: '0.14.0', e: [e[1]] }), placed)).toBeNull()
})
