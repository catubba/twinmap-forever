import { mkdtempSync, readFileSync, utimesSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { PricesTold } from '../shared/ah'
import { startPrices } from './prices'

const LISTING = { region: 'eu', house: 111, name: 'Alliance Auction House', snapshot: new Date().toISOString(), items: { 2589: [[12, 40]] } }

test('the prices of a house come from the bucket, stay on disk for when the network is gone, and are not fetched again unchanged', async () => {
  let up = true
  const asked: string[] = []
  const server = createServer((req, res) => {
    asked.push(`${req.url} ${req.headers['if-none-match'] ?? ''}`)
    if (!up) return void req.socket.destroy()
    if (req.url !== '/eu/111.json') return void res.writeHead(404).end()
    if (req.headers['if-none-match'] === '"one"') return void res.writeHead(304).end()
    res.writeHead(200, { etag: '"one"', 'content-type': 'application/json' }).end(JSON.stringify(LISTING))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-prices-'))
  // A file from more than 30 days ago is taken away at the start.
  writeFileSync(join(folder, 'eu-110.json'), '{}')
  utimesSync(join(folder, 'eu-110.json'), new Date(Date.now() - 31 * 86_400_000), new Date(Date.now() - 31 * 86_400_000))
  let told: PricesTold | null = null
  const until = async (ok: () => boolean): Promise<void> => {
    for (let t = 0; !ok(); t++) {
      if (t > 100) throw new Error('never')
      await new Promise((r) => setTimeout(r, 20))
    }
  }
  try {
    const prices = startPrices(folder, (t) => (told = t), base)
    expect(existsSync(join(folder, 'eu-110.json'))).toBe(false)
    prices.want('EU', 111)
    await until(() => !!told?.listing)
    expect(told!.listing).toEqual(LISTING)
    expect(JSON.parse(readFileSync(join(folder, 'eu-111.json'), 'utf8'))).toEqual(LISTING)
    prices.stop()

    // The next start: what is on disk at once, and the bucket asked whether it changed.
    told = null
    const again = startPrices(folder, (t) => (told = t), base)
    again.want('EU', 111)
    expect(told!.listing).toEqual(LISTING)
    await until(() => told!.checked !== null)
    expect(asked.at(-1)).toBe('/eu/111.json "one"')
    // Without the network: the prices kept, and what went wrong.
    up = false
    again.again()
    await until(() => told!.error !== null)
    expect(told!.error).toBe('Twinmap could not reach prices.twinmap.app.')
    expect(told!.listing).toEqual(LISTING)
    // A house the bucket has nothing for.
    up = true
    again.want('EU', 112)
    await until(() => told!.error !== null)
    expect([told!.house, told!.listing, told!.error]).toEqual([112, null, 'This house has no prices.'])
    again.stop()
  } finally {
    server.close()
  }
})

test('the history comes once: the hours once a snapshot, a past day once it is over, a day the bucket lacks kept as none; nothing past 8 days stays', async () => {
  const now = Date.parse('2026-11-21T19:30:00Z'), snapshot = '2026-11-21T18:23:00.000Z'
  const listing = { region: 'eu', house: 111, name: '', snapshot, items: { '2589': [[12, 40]] } }
  const hours = { hours: ['2026-11-21T17:23:00.000Z'], keys: { '2589': [[10, 11, 30]] } }
  const day20 = { day: '2026-11-20', hours: ['2026-11-20T12:23:00.000Z'], keys: { '2589': [9, 10, 20, 1] } }
  const asked: string[] = []
  const server = createServer((req, res) => {
    asked.push(req.url!)
    const body = req.url === '/eu/111.json' ? listing : req.url === '/eu/111/hours.json' ? hours : req.url === '/eu/111/2026-11-20.json' ? day20 : null
    if (!body) return void res.writeHead(404).end()
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-history-'))
  // From 9 days ago: a day's file fetched yesterday, and anything else.
  writeFileSync(join(folder, 'eu-111-2026-11-12.json'), '{}')
  writeFileSync(join(folder, 'eu-111-old.json'), '{}')
  utimesSync(join(folder, 'eu-111-old.json'), new Date(now - 9 * 86_400_000), new Date(now - 9 * 86_400_000))
  let told = null as PricesTold | null
  try {
    const prices = startPrices(folder, (t) => (told = t), base, () => now)
    expect([existsSync(join(folder, 'eu-111-2026-11-12.json')), existsSync(join(folder, 'eu-111-old.json'))]).toEqual([false, false])
    prices.want('EU', 111)
    while (!told?.listing) await new Promise((r) => setTimeout(r, 20))
    // The column: the hours alone, with the listing's own hour at the end.
    const column = await prices.history(['2589'], false)
    expect(column['2589']!.hours).toEqual([{ at: '2026-11-21T17:23:00.000Z', p: [10, 11, 30] }, { at: snapshot, p: [12, 12, 40] }])
    expect(asked.filter((u) => u !== '/eu/111.json')).toEqual(['/eu/111/hours.json'])
    // The chart: the six days before, from their files; the day of the snapshot from the hours.
    const chart = await prices.history(['2589'], true)
    expect(chart['2589']!.days).toEqual([{ day: '2026-11-20', p: [9, 10, 20, 1] }, { day: '2026-11-21', p: [10, 12, 35, 2] }])
    expect(asked.filter((u) => u.includes('-')).sort()).toEqual(['/eu/111/2026-11-15.json', '/eu/111/2026-11-16.json', '/eu/111/2026-11-17.json', '/eu/111/2026-11-18.json', '/eu/111/2026-11-19.json', '/eu/111/2026-11-20.json'])
    // The second time, and after a new start with what is on disk: nothing is asked.
    const before = asked.length
    expect(await prices.history(['2589'], true)).toEqual(chart)
    prices.stop()
    const again = startPrices(folder, (t) => (told = t), base, () => now)
    again.want('EU', 111)
    expect(await again.history(['2589'], true)).toEqual(chart)
    expect(asked.slice(before).filter((u) => u !== '/eu/111.json')).toEqual([])
    again.stop()
  } finally {
    server.close()
  }
})
