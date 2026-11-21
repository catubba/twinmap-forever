// The prices of the auction houses of WoW: Forever, once an hour (.github/workflows/prices.yml). For each region it
// asks Blizzard's API for every house, and where a house has a new snapshot writes to the bucket twinmap-prices
// (served as prices.twinmap.app, the app reads it from there):
//   prices/<region>/<house>.json             what is on sale: per item and kind, its prices and how many at each
//   prices/<region>/<house>/hours.json       the last 24 snapshots: per item and kind, lowest, typical, how many
//   prices/<region>/<house>/<YYYY-MM-DD>.json  the day so far (UTC): lowest, mean typical, mean count, hours seen
//   prices/<region>/index.json               the houses and the time of their snapshot
// An item's key is its number, and the bonus lists of its kind after a colon ("6567:12718": of the Eagle).
// The API's terms keep any of its data 30 days at most: the bucket drops what is older than 8 days.
//   node --env-file=<file with BNET_CLIENT_ID, BNET_CLIENT_SECRET and the R2_ values> server/prices/prices.ts
//   DRY=<folder> node --env-file=<file with the BNET_ values> server/prices/prices.ts   (a folder in place of the bucket)
import { createHash, createHmac } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const REGIONS = ['eu', 'us', 'kr', 'tw'] // every region Forever is played in; China has an API of its own
const RULESET = 1 // every ruleset lists the same houses with the same auctions (seen 21 November 2026)
const HOURS = 24
const CACHE = 'public, max-age=300'

export interface Auction {
  item: { id: number; bonus_lists?: number[] }
  quantity: number
  buyout?: number
  unit_price?: number
}
/** Per key, prices in copper each and how many at that price, cheapest first. */
export type Listing = Record<string, [number, number][]>
/** Per key: lowest, typical (the median of what is on sale, by count), how many. */
export type Point = [number, number, number]
export interface Hours { hours: string[]; keys: Record<string, (Point | null)[]> }
/** Per key: lowest of the day, mean typical, mean count, hours seen. */
export interface Day { day: string; hours: string[]; keys: Record<string, [number, number, number, number]> }

export const keyOf = (item: Auction['item']): string => (item.bonus_lists?.length ? `${item.id}:${item.bonus_lists.join('.')}` : String(item.id))

/** What is on sale, from the auctions of a house and its commodities. Bids alone are left out: they have no price yet. */
export function listingOf(auctions: Auction[]): Listing {
  const at = new Map<string, Map<number, number>>()
  for (const a of auctions) {
    const each = a.unit_price ?? (a.buyout ? Math.round(a.buyout / a.quantity) : 0)
    if (!each || !a.quantity) continue
    const key = keyOf(a.item)
    const prices = at.get(key) ?? at.set(key, new Map()).get(key)!
    prices.set(each, (prices.get(each) ?? 0) + a.quantity)
  }
  const out: Listing = {}
  for (const [key, prices] of at) out[key] = [...prices].sort((a, b) => a[0] - b[0])
  return out
}

/** Lowest, typical and how many, from the prices of one key. Typical: the price of the middle one, counting each unit. */
export function pointOf(prices: [number, number][]): Point {
  const count = prices.reduce((s, [, n]) => s + n, 0)
  let seen = 0
  for (const [price, n] of prices) if ((seen += n) * 2 >= count) return [prices[0][0], price, count]
  return [prices[0][0], prices[0][0], count]
}

/** The last 24 snapshots with this one at the end. A key not on sale in a snapshot has null there. */
export function nextHours(old: Hours | null, at: string, listing: Listing): Hours {
  if (old?.hours.at(-1) === at) return old
  const before = old ?? { hours: [], keys: {} }
  const drop = Math.max(0, before.hours.length + 1 - HOURS)
  const hours = [...before.hours.slice(drop), at]
  const keys: Hours['keys'] = {}
  for (const key of new Set([...Object.keys(before.keys), ...Object.keys(listing)])) {
    const row = [...(before.keys[key] ?? before.hours.map(() => null)).slice(drop), listing[key] ? pointOf(listing[key]) : null]
    if (row.some(Boolean)) keys[key] = row
  }
  return { hours, keys }
}

/** The day with this snapshot in it; a snapshot already in the day changes nothing. */
export function nextDay(old: Day | null, day: string, at: string, listing: Listing): Day {
  const base: Day = old?.day === day ? old : { day, hours: [], keys: {} }
  if (base.hours.includes(at)) return base
  const keys = { ...base.keys }
  for (const [key, prices] of Object.entries(listing)) {
    const [low, typical, count] = pointOf(prices)
    const was = keys[key]
    if (!was) keys[key] = [low, typical, count, 1]
    else {
      const n = was[3]
      keys[key] = [Math.min(was[0], low), Math.round((was[1] * n + typical) / (n + 1)), Math.round((was[2] * n + count) / (n + 1)), n + 1]
    }
  }
  return { day, hours: [...base.hours, at], keys }
}

// Storage: the bucket through R2's S3 interface, or a folder for a trial.
export interface Store { get(key: string): Promise<string | null>; put(key: string, body: string): Promise<void> }

const sha256 = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex')
const hmac = (key: string | Buffer, data: string): Buffer => createHmac('sha256', key).update(data).digest()

/** The headers that sign a request for AWS's Signature Version 4, which R2 speaks. `headers` are signed too. */
export function signed(o: { method: string; url: string; headers?: Record<string, string>; body?: string; id: string; secret: string; region: string; now: Date }): Record<string, string> {
  const u = new URL(o.url)
  const amzDate = o.now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const date = amzDate.slice(0, 8)
  const hash = sha256(o.body ?? '')
  const all: Record<string, string> = { ...o.headers, host: u.host, 'x-amz-content-sha256': hash, 'x-amz-date': amzDate }
  const names = Object.keys(all).map((n) => n.toLowerCase()).sort()
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), v.trim()]))
  const path = u.pathname.split('/').map((s) => encodeURIComponent(decodeURIComponent(s))).join('/')
  const query = [...u.searchParams].map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).sort().join('&')
  const request = [o.method, path, query, names.map((n) => `${n}:${lower[n]}\n`).join(''), names.join(';'), hash].join('\n')
  const scope = `${date}/${o.region}/s3/aws4_request`
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(request)].join('\n')
  const key = hmac(hmac(hmac(hmac(`AWS4${o.secret}`, date), o.region), 's3'), 'aws4_request')
  const signature = createHmac('sha256', key).update(toSign).digest('hex')
  const { host: _host, ...sent } = all
  return { ...sent, authorization: `AWS4-HMAC-SHA256 Credential=${o.id}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` }
}

export function r2(account: string, id: string, secret: string, bucket = 'twinmap-prices'): Store {
  const url = (key: string) => `https://${account}.r2.cloudflarestorage.com/${bucket}/${key}`
  const sign = (method: string, key: string, headers: Record<string, string> = {}, body?: string) => signed({ method, url: url(key), headers, body, id, secret, region: 'auto', now: new Date() })
  return {
    async get(key) {
      const r = await fetch(url(key), { headers: sign('GET', key) })
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`R2 GET ${key}: ${r.status}`)
      return r.text()
    },
    async put(key, body) {
      const headers = sign('PUT', key, { 'content-type': 'application/json', 'cache-control': CACHE }, body)
      const r = await fetch(url(key), { method: 'PUT', headers, body })
      if (!r.ok) throw new Error(`R2 PUT ${key}: ${r.status} ${await r.text()}`)
    },
  }
}

export function folder(root: string): Store {
  return {
    async get(key) { try { return readFileSync(join(root, key), 'utf8') } catch { return null } },
    async put(key, body) { mkdirSync(dirname(join(root, key)), { recursive: true }); writeFileSync(join(root, key), body) },
  }
}

// Blizzard's API.
async function token(id: string, secret: string): Promise<string> {
  const r = await fetch('https://oauth.battle.net/token', { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') }, body: new URLSearchParams({ grant_type: 'client_credentials' }) })
  if (!r.ok) throw new Error(`Battle.net token: ${r.status}`)
  return ((await r.json()) as { access_token: string }).access_token
}
async function api(region: string, bearer: string, path: string): Promise<{ json: { auctions?: Auction[] & { id?: number; name?: string }[] }; modified: string }> {
  const r = await fetch(`https://${region}.api.blizzard.com${path}?namespace=dynamic-forever-${region}&locale=en_US`, { headers: { authorization: `Bearer ${bearer}` } })
  if (!r.ok) throw new Error(`${region} ${path}: ${r.status}`)
  return { json: (await r.json()) as never, modified: new Date(r.headers.get('last-modified') ?? Date.now()).toISOString() }
}

interface Index { region: string; made: string; houses: { id: number; name: string; snapshot: string; items: number }[] }

/** One region: every house with a new snapshot, written to the store; one line of the log per house. */
export async function region(name: string, bearer: string, store: Store, log: (line: string) => void): Promise<void> {
  const old = JSON.parse((await store.get(`prices/${name}/index.json`)) ?? 'null') as Index | null
  const seen = new Map(old?.houses.map((h) => [h.id, h]))
  const { json } = await api(name, bearer, `/data/wow/ruleset/${RULESET}/auctions/`)
  const houses: Index['houses'] = []
  for (const h of (json.auctions ?? []) as unknown as { id: number; name: string }[]) {
    const sold = await api(name, bearer, `/data/wow/ruleset/${RULESET}/auctions/${h.id}`)
    const was = seen.get(h.id)
    if (was && was.snapshot === sold.modified) { houses.push(was); log(`${name} ${h.id} unchanged since ${sold.modified}`); continue }
    const commodities = await api(name, bearer, `/data/wow/ruleset/${RULESET}/auctions/${h.id}/commodities`)
    const listing = listingOf([...(sold.json.auctions ?? []), ...(commodities.json.auctions ?? [])])
    const items = Object.keys(listing).length
    if (!items) { log(`${name} ${h.id} empty`); continue }
    const at = sold.modified, day = at.slice(0, 10), base = `prices/${name}/${h.id}`
    const hours = nextHours(JSON.parse((await store.get(`${base}/hours.json`)) ?? 'null'), at, listing)
    const dayFile = nextDay(JSON.parse((await store.get(`${base}/${day}.json`)) ?? 'null'), day, at, listing)
    const files: [string, string][] = [
      [`${base}.json`, JSON.stringify({ region: name, house: h.id, name: h.name, snapshot: at, items: listing })],
      [`${base}/hours.json`, JSON.stringify(hours)],
      [`${base}/${day}.json`, JSON.stringify(dayFile)],
    ]
    for (const [key, body] of files) await store.put(key, body)
    houses.push({ id: h.id, name: h.name, snapshot: at, items })
    log(`${name} ${h.id} ${h.name}: snapshot ${at}, ${items} keys; ${files.map(([k, b]) => `${k.split('/').at(-1)} ${Math.round(b.length / 1024)} KB`).join(', ')}; ${hours.hours.length} hours, ${dayFile.hours.length} of the day`)
  }
  await store.put(`prices/${name}/index.json`, JSON.stringify({ region: name, made: new Date().toISOString(), houses } satisfies Index))
}

if (import.meta.main) {
  const e = process.env
  if (!e.BNET_CLIENT_ID || !e.BNET_CLIENT_SECRET) throw new Error('BNET_CLIENT_ID and BNET_CLIENT_SECRET are wanted')
  const store = e.DRY ? folder(e.DRY) : r2(e.R2_ACCOUNT_ID ?? '', e.R2_ACCESS_KEY_ID ?? '', e.R2_SECRET_ACCESS_KEY ?? '')
  if (!e.DRY && (!e.R2_ACCOUNT_ID || !e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY)) throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are wanted, or DRY')
  const bearer = await token(e.BNET_CLIENT_ID, e.BNET_CLIENT_SECRET)
  for (const name of REGIONS) await region(name, bearer, store, (line) => console.log(line))
}
