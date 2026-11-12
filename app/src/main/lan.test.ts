import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, test } from 'vitest'
import { isHome, startLan } from './lan'

test('only the addresses of a home network and of this computer are let in', () => {
  for (const a of ['192.168.1.20', '10.0.0.7', '172.16.0.1', '172.31.255.1', '127.0.0.1', '::ffff:192.168.1.20', '::1', 'fe80::1c2a:3bff:fe4d:5e6f', 'fd12:3456::1']) expect(isHome(a), a).toBe(true)
  for (const a of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.1.1', '::ffff:93.184.216.34', '2001:db8::1', 'fe00::1', '', undefined]) expect(isHome(a), String(a)).toBe(false)
})

const PORT = 18765, at = `http://127.0.0.1:${PORT}`
const page = mkdtempSync(join(tmpdir(), 'twinmap-lan-'))
writeFileSync(join(page, 'index.html'), '<p>the map</p>')
writeFileSync(join(tmpdir(), 'twinmap-lan-outside.html'), 'not for anyone')
const lan = startLan(
  PORT,
  {
    code: 'right-code',
    page,
    tile: (path) => Promise.resolve(path === '/maps.json' ? { status: 200, type: 'application/json', bytes: Buffer.from('[]') } : { status: 404 }),
    calls: { search: (typed) => [`found ${String(typed)}`] },
  },
  (message) => {
    throw new Error(message)
  },
)
afterAll(() => lan.stop())
const held = { cookie: 'k=right-code' }

test('nothing is given without the code, the page with it', async () => {
  expect((await fetch(at)).status).toBe(403)
  expect((await fetch(`${at}/?k=wrong-code`)).status).toBe(403)
  expect((await fetch(`${at}/events`)).status).toBe(403)
  expect((await fetch(`${at}/call/search`, { method: 'POST', body: '["x"]' })).status).toBe(403)

  // The address with the code gives the page at once, and the code to the browser to keep. Lax: a
  // visit that began in another app (the camera of a phone) must carry it too.
  const first = await fetch(`${at}/?k=right-code`, { redirect: 'manual' })
  expect(await first.text()).toBe('<p>the map</p>')
  expect(first.headers.get('set-cookie')).toMatch(/^k=right-code; .*HttpOnly; SameSite=Lax$/)
  expect(await (await fetch(at, { headers: held })).text()).toBe('<p>the map</p>')
})

test('files outside the page are not given', async () => {
  expect((await fetch(`${at}/..%2Ftwinmap-lan-outside.html`, { headers: held })).status).toBe(404)
  expect((await fetch(`${at}/nothing.js`, { headers: held })).status).toBe(404)
})

test('the map, the askings and the news', async () => {
  expect(await (await fetch(`${at}/tiles/maps.json`, { headers: held })).json()).toEqual([])
  expect((await fetch(`${at}/tiles/secret`, { headers: held })).status).toBe(404)
  expect(await (await fetch(`${at}/call/search`, { method: 'POST', headers: held, body: '["boar"]' })).json()).toEqual(['found boar'])
  expect((await fetch(`${at}/call/choose-game-folder`, { method: 'POST', headers: held, body: '[]' })).status).toBe(404)
  expect((await fetch(`${at}/call/toString`, { method: 'POST', headers: held, body: '[]' })).status).toBe(404)

  // Who comes later is told the latest at once, then what changes.
  lan.tell('link', { n: 1 })
  const events = await fetch(`${at}/events`, { headers: held })
  const reader = events.body!.getReader(), read = async (): Promise<string> => new TextDecoder().decode((await reader.read()).value)
  expect(await read()).toMatch(/^id: \d{13}\nevent: link\ndata: {"n":1}\n\n$/)
  lan.tell('link', { n: 1 }) // the same again: not told
  lan.tell('link', { n: 2 })
  expect(await read()).toMatch(/^id: \d{13}\nevent: link\ndata: {"n":2}\n\n$/)
  await reader.cancel()
})
