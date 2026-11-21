// The prices of the auction house the window asks for (M18-F7): from prices.twinmap.app when it is
// asked, then about once an hour (when the hourly Action has written the next snapshot), kept on
// disk so they show without the network. Only the listing of one house is fetched, never anything
// about the player. Files older than the API's terms allow (KEEP_DAYS) are taken away at the start.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { KEEP_DAYS, listingFrom, nextPrices, PRICES_URL, type PricesTold } from '../shared/ah'

const AGAIN_SOON = 15 * 60_000 // the next snapshot is late: asked again this much later
const AFTER_FAILURE = 5 * 60_000
const WAIT = 30_000 // the longest one asking waits for

export function startPrices(folder: string, tell: (told: PricesTold) => void, base = PRICES_URL, now = Date.now): { want: (region: unknown, house: unknown) => void; again: () => void; told: () => PricesTold; stop: () => void } {
  mkdirSync(folder, { recursive: true })
  for (const name of readdirSync(folder))
    try {
      if (now() - statSync(join(folder, name)).mtimeMs > KEEP_DAYS * 86_400_000) rmSync(join(folder, name))
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
      else if (!answer.ok) throw new Error(answer.status === 404 ? 'This house has no prices.' : `prices.twinmap.app answered ${answer.status}.`)
      else {
        const text = await answer.text(), listing = listingFrom(JSON.parse(text))
        if (mine !== asking) return
        if (!listing || listing.house !== house) throw new Error('prices.twinmap.app sent something else than prices.')
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
      say({ error: e instanceof Error && !(e instanceof SyntaxError) && e.name !== 'TimeoutError' && !/fetch failed/i.test(e.message) ? e.message : 'Twinmap could not reach prices.twinmap.app.' })
    }
    timer = setTimeout(() => void ask(region, house), wait)
  }

  return {
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
