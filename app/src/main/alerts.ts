// Alerts on prices (M18-F10): kept in a file beside the settings, each with the character it belongs
// to, and checked against every new listing the app fetches (main/prices.ts). A met alert is told to
// the window and, when asked, to the game: a part "alert" and its name, which the addon says in chat
// to that character only (Alerts.lua). Only while the app is open: nothing checks with it closed.
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { alertAfter, alertFrom, type Alert, type Listing } from '../shared/ah'

/** What the game is told of a met alert. */
export type AlertNews = { who: string; t: number; name: string; at: number; when: Alert['when']; price: number; h: string }

export function startAlerts(file: string, tell: (alerts: Alert[]) => void, send: (parts: Record<string, AlertNews | false>) => void, now = Date.now): { all: () => Alert[]; set: (asked: unknown, listing: Listing | null) => void; remove: (t: unknown) => void; check: (listing: Listing | null) => void } {
  let alerts: Alert[] = []
  try {
    const read: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (Array.isArray(read)) alerts = read.map(alertFrom).filter((a): a is Alert => a !== null)
  } catch {
    // none kept yet
  }
  const keep = (next: Alert[]): void => {
    alerts = next
    try {
      writeFileSync(`${file}.new`, JSON.stringify(alerts))
      renameSync(`${file}.new`, file)
    } catch {
      // kept for this run only
    }
    tell(alerts)
  }
  const hour = (snapshot: string): string => new Date(snapshot).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  function check(listing: Listing | null): void {
    if (!listing) return
    const parts: Record<string, AlertNews> = {}
    let changed = false
    const next = alerts.map((a) => {
      const after = alertAfter(a, listing)
      if (after === a) return a
      changed = true
      if (after.met && after.at !== null && a.game) parts[`alert${a.t}`] = { who: a.who, t: a.t, name: a.name, at: after.at, when: a.when, price: a.price, h: hour(after.met) }
      return after
    })
    if (!changed) return
    if (Object.keys(parts).length) send(parts)
    keep(next)
  }

  return {
    all: () => alerts,
    // A new alert, checked at once against the listing on show: a price already past the line is met now.
    set(asked, listing) {
      const a = alertFrom({ ...(typeof asked === 'object' && asked ? asked : {}), t: Math.max(now(), ...alerts.map((x) => x.t + 1)), met: null, at: null, away: false })
      if (!a) return
      keep([...alerts, a])
      check(listing)
    },
    remove(t) {
      const gone = alerts.find((a) => a.t === t)
      if (!gone) return
      if (gone.met && gone.game) send({ [`alert${gone.t}`]: false }) // the game forgets it too
      keep(alerts.filter((a) => a !== gone))
    },
    check,
  }
}
