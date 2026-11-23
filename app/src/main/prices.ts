// The prices of the auction house the window asks for (M18-F7): from prices.twinmap.app when it is
// asked, then about once an hour (when the hourly Action has written the next snapshot), kept on
// disk so they show without the network. Only the listing of one house is fetched, never anything
// about the player. Their history for the chart (M18-F9) only when the window asks for it: the last
// 24 hours once a snapshot, a past day once. Files older than KEEP_DAYS are taken away at the start.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chartDays, dayFrom, historyOf, hoursFrom, KEEP_DAYS, listingFrom, nextPrices, PRICES_URL, withListing, type DayFile, type History, type HoursFile, type PricesTold } from '../shared/ah'
import { t } from '../shared/i18n'

const AGAIN_SOON = 15 * 60_000 // the next snapshot is late: asked again this much later
const AFTER_FAILURE = 5 * 60_000
const WAIT = 30_000 // the longest one asking waits for
const DAY_DONE = 2 * 3_600_000 // a day's file fetched this long after the day is over has all of it

export function startPrices(folder: string, tell: (told: PricesTold) => void, base = PRICES_URL, now = Date.now): { want: (region: unknown, house: unknown) => void; again: () => void; told: () => PricesTold; history: (keys: unknown, days?: unknown) => Promise<Record<string, History>>; stop: () => void } {
  mkdirSync(folder, { recursive: true })
  for (const name of readdirSync(folder))
    try {
      const day = name.match(/-(\d{4}-\d\d-\d\d)\.json$/)?.[1] // a day's file goes by its day, whenever it was fetched
      if (now() - Math.min(statSync(join(folder, name)).mtimeMs, day ? Date.parse(day) : Infinity) > KEEP_DAYS * 86_400_000) rmSync(join(folder, name))
    } catch {
      // gone already
    }
  let told: PricesTold = { region: null, house: null, listing: null, checked: null, error: null }
  let timer: ReturnType<typeof setTimeout> | undefined
  let asking = 0 // which asking is the latest: an answer to an older one is thrown away
  const fileOf = (region: string, house: number): string => join(folder, `${region.toLowerCase()}-${house}.json`)
  const say = (next: Partial<PricesTold>): void => tell((told = { ...told, ...next }))

  async function ask(region: string, house: number): Promise<void> {
    clearTimeout(timer)
    const mine = ++asking, file = fileOf(region, house)
    let tag: string | null = null
    try {
      tag = readFileSync(`${file}.tag`, 'utf8')
    } catch {
      // never fetched
    }
    let wait = AFTER_FAILURE
    try {
      const answer = await fetch(`${base}/${region.toLowerCase()}/${house}.json`, { headers: tag && told.listing ? { 'if-none-match': tag } : {}, signal: AbortSignal.timeout(WAIT) })
      if (mine !== asking) return
      if (answer.status === 304) say({ checked: now(), error: null })
      else if (!answer.ok) throw new Error(answer.status === 404 ? t('auction.errors.noHouse') : t('auction.errors.answered', { status: answer.status }))
      else {
        const text = await answer.text(), listing = listingFrom(JSON.parse(text))
        if (mine !== asking) return
        if (!listing || listing.house !== house) throw new Error(t('auction.errors.notPrices'))
        try {
          writeFileSync(`${file}.new`, text)
          renameSync(`${file}.new`, file)
          const etag = answer.headers.get('etag')
          if (etag) writeFileSync(`${file}.tag`, etag)
        } catch {
          // kept for this run only
        }
        say({ listing, checked: now(), error: null })
      }
      const next = told.listing ? nextPrices(told.listing.snapshot) - now() : AGAIN_SOON
      wait = next > 0 ? next : AGAIN_SOON
    } catch (e) {
      if (mine !== asking) return
      say({ error: e instanceof Error && !(e instanceof SyntaxError) && e.name !== 'TimeoutError' && !/fetch failed/i.test(e.message) ? e.message : t('auction.errors.unreachable') })
    }
    timer = setTimeout(() => void ask(region, house), wait)
  }

  // The history, kept on disk beside the listing and in memory.
  const files = new Map<string, { data: unknown; at: number }>() // by file name: what it holds, when it was fetched
  const fetching = new Map<string, Promise<void>>()
  let merged: { file: unknown; listing: unknown; hours: HoursFile | null } = { file: null, listing: null, hours: null } // the hours with the listing, made once for both
  function keptOf(name: string): { data: unknown; at: number } | undefined {
    if (!files.has(name))
      try {
        const file = join(folder, name)
        files.set(name, { data: JSON.parse(readFileSync(file, 'utf8')), at: statSync(file).mtimeMs })
      } catch {
        // not kept
      }
    return files.get(name)
  }
  // One file of the bucket to the disk; a file the bucket does not have kept as none. Two askings for it share one fetch.
  function fetchKept(name: string, path: string, none: unknown): Promise<void> {
    const going = fetching.get(name)
    if (going) return going
    const done = (async (): Promise<void> => {
      try {
        const answer = await fetch(`${base}/${path}`, { signal: AbortSignal.timeout(WAIT) })
        if (!answer.ok && answer.status !== 404) return
        const text = answer.ok ? await answer.text() : JSON.stringify(none)
        files.set(name, { data: JSON.parse(text) as unknown, at: now() })
        try {
          writeFileSync(join(folder, `${name}.new`), text)
          renameSync(join(folder, `${name}.new`), join(folder, name))
        } catch {
          // kept for this run only
        }
      } catch {
        // no network: what is kept, or nothing
      } finally {
        fetching.delete(name)
      }
    })()
    fetching.set(name, done)
    return done
  }

  async function history(keys: unknown, withDays: unknown): Promise<Record<string, History>> {
    const { region, house, listing } = told
    if (!region || !house || !listing || !Array.isArray(keys)) return {}
    const r = region.toLowerCase(), stem = `${r}-${house}`
    // The last 24 hours: fetched again when the listing is newer than the hours kept, once after its snapshot.
    // Hours still behind then (the bucket's cache) take the listing's own hour at their end.
    const hoursName = `${stem}-hours.json`, kept = keptOf(hoursName)
    if ((hoursFrom(kept?.data)?.hours.at(-1) ?? '') < listing.snapshot && (kept?.at ?? 0) < Date.parse(listing.snapshot)) await fetchKept(hoursName, `${r}/${house}/hours.json`, { hours: [], keys: {} })
    const file = keptOf(hoursName)?.data
    if (merged.file !== file || merged.listing !== listing) merged = { file, listing, hours: withListing(hoursFrom(file), listing) }
    const hours = merged.hours
    // The days before the day of the snapshot: each fetched until it is fetched after its end.
    const days: Record<string, DayFile | null> = {}
    const today = listing.snapshot.slice(0, 10)
    if (withDays) {
      const past = chartDays(listing.snapshot).filter((d) => d !== today)
      const name = (d: string): string => `${stem}-${d}.json`
      await Promise.all(past.filter((d) => (keptOf(name(d))?.at ?? 0) < Date.parse(d) + 86_400_000 + DAY_DONE).map((d) => fetchKept(name(d), `${r}/${house}/${d}.json`, { day: d, hours: [], keys: {} })))
      for (const d of past) days[d] = dayFrom(keptOf(name(d))?.data, d)
      days[today] = null
    }
    return Object.fromEntries(keys.filter((k): k is string => typeof k === 'string').map((k) => [k, historyOf(k, hours, days, today)]))
  }

  return {
    history,
    want(region, house) {
      if (typeof region !== 'string' || !/^[a-z]{2}$/i.test(region) || !Number.isInteger(house)) return
      if (region === told.region && house === told.house) return
      let listing = null
      try {
        listing = listingFrom(JSON.parse(readFileSync(fileOf(region, house as number), 'utf8')))
      } catch {
        // not kept yet
      }
      say({ region, house: house as number, listing, checked: null, error: null })
      void ask(region, house as number)
    },
    // Try again, now: the window's button when the network was not there.
    again: () => {
      if (told.region && told.house) void ask(told.region, told.house)
    },
    told: () => told,
    stop: () => {
      asking++
      clearTimeout(timer)
    },
  }
}
