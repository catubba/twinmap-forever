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
