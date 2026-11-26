// What's new (WhatsNew.svelte): the sections of CHANGELOG.md, read as the app is built, so they need no network. From the
// release that brought this window on, each release has a file in news/ (named for its version) with the same section in
// every other language the app speaks, and where the button of an entry leads. The release (skill twinmap-release) writes it.
// A release with no file, and every one before, shows in English.
import changelog from '../../../CHANGELOG.md?raw'
import { after } from './setup'

export type Kind = 'New' | 'Changed' | 'Fixed'
/** Where the button of an entry leads: a tab, Settings, or the Layers menu of the map. */
export type Go = 'now' | 'items' | 'ah' | 'settings' | 'layers'
export interface Entry {
  kind: Kind
  /** Its words in bold, as "Ore and herbs by kind." */
  title: string
  text: string
  go?: Go
  /** A picture under it: the name of its file in docs/images/news, from a line `![words](.../name.png)` right after the entry. */
  picture?: string
}
export interface Release {
  version: string
  /** As the CHANGELOG writes it: 2026-11-24. */
  date: string
  entries: Entry[]
  /** The lines of a section that are no entry: "The addon is the same as in 0.12.1". */
  notes: string[]
}
/** A file of news/: each language's section, by the game's code for it, as the CHANGELOG writes one (### New, - **Title.** text), and the
 *  buttons, by the English title of their entry. */
export interface News {
  langs: Record<string, string>
  go?: Record<string, Go>
}

const KINDS: Kind[] = ['New', 'Changed', 'Fixed']

/** The entries and notes of one section, from the line after its heading. */
function entriesOf(body: string): { entries: Entry[]; notes: string[] } {
  const entries: Entry[] = [], notes: string[] = []
  let kind: Kind = 'New'
  for (const line of body.split(/\r?\n/)) {
    const head = /^###\s+(\w+)/.exec(line)
    if (head) {
      if (KINDS.includes(head[1] as Kind)) kind = head[1] as Kind
      continue
    }
    const entry = /^-\s+\*\*(.+?)\*\*\s*(.*)$/.exec(line)
    const picture = /^\s*!\[[^\]]*\]\((?:[^)]*\/)?([^/)]+)\)\s*$/.exec(line)
    if (entry) entries.push({ kind, title: entry[1]!, text: entry[2]! })
    else if (picture && entries.length) entries[entries.length - 1]!.picture = picture[1]!
    else if (line.trim() && !line.startsWith('#')) notes.push(line.trim())
  }
  return { entries, notes }
}

/** The releases a changelog tells, newest first as it writes them. */
export function releasesOf(markdown: string): Release[] {
  const out: Release[] = []
  for (const part of markdown.split(/^## /m).slice(1)) {
    const [head = '', ...rest] = part.split(/\r?\n/)
    const at = /^(\d+\.\d+\.\d+)\s+-\s+(\d{4}-\d{2}-\d{2})/.exec(head)
    if (at) out.push({ version: at[1]!, date: at[2]!, ...entriesOf(rest.join('\n')) })
  }
  return out
}

/** The releases in a language: its own section where a file of news/ has it, else the English. The buttons and the pictures go on the
 *  entry at the same place among those of its kind as the English one they belong to: a section is translated entry by entry, in the same order. */
export function releasesIn(lang: string, english: Release[], news: Record<string, News>): Release[] {
  return english.map((release) => {
    const file = news[release.version]
    const own = file?.langs[lang]
    const shown = own ? { ...release, ...entriesOf(own) } : release
    if (!own && !file?.go) return shown
    const go = file?.go ?? {}
    const counted: Record<string, number> = {}
    const entries = shown.entries.map((entry) => {
      const place = (counted[entry.kind] = (counted[entry.kind] ?? -1) + 1)
      const english = release.entries.filter((e) => e.kind === entry.kind)[place]
      const to = english && go[english.title], picture = english?.picture
      return { ...entry, ...(to ? { go: to } : {}), ...(picture ? { picture } : {}) }
    })
    return { ...shown, entries }
  })
}

/**
 * The releases to show: since, the version the player last saw them at ('' when not known, as for one who updated from before this
 * window: then only this version), up to this one; or every release with 'all' (Settings, What's new).
 */
export function newsFor(lang: string, since: string | 'all', version: string, english = releasesOf(changelog), news = NEWS): Release[] {
  const all = releasesIn(lang, english, news)
  if (since === 'all') return all
  return all.filter((r) => !after(r.version, version) && (since === '' ? r.version === version : after(r.version, since)))
}

/** The files of news/, by version. */
const NEWS: Record<string, News> = Object.fromEntries(
  Object.entries(import.meta.glob<{ default: News }>('./news/*.ts', { eager: true })).map(([file, mod]) => [/([\d.]+)\.ts$/.exec(file)![1]!, mod.default]),
)
