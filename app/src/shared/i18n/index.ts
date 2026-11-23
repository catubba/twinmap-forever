// Every text the player sees comes from here: t('key', { values }) gives it in the language chosen.
// English (en.ts) is where every key starts, with a note on where its text shows; the rules for the other
// languages are in the design notes (l10n.md). A key a language has not got shows its English, never the key.
// The language is set once as a page or the main process starts (setLang): a new choice reloads the page.
import en from './en'

/** A text that changes with a number, `count` among its values: the forms Intl.PluralRules names for the language. */
export type Plural = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>
export interface Table {
  [key: string]: string | Plural | Table
}
// The keys of a table, as dotted paths to its texts. A group never has a key named `other`: that is what marks a Plural.
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends { other: string } ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]
export type Key = Leaves<typeof en>

/** The languages the app speaks, by the game's codes for them (textLocale in Config.wtf). */
export const LANGS: Record<string, { name: string; intl: string; table: Table }> = {
  enUS: { name: 'English', intl: 'en-US', table: en },
}
/** For trials only, never offered: every text marked, accented and 40% longer, so one left in the code shows at a glance. */
export const PSEUDO = 'pseudo'

let lang = 'enUS'
let table: Table = en
let intl = 'en-US'
let plurals = new Intl.PluralRules(intl)

/** The language to speak: the one chosen, else the game's, else English. */
export function langFor(chosen: unknown, game: unknown): string {
  for (const code of [chosen, game]) if (typeof code === 'string' && (code in LANGS || (code === PSEUDO && code === chosen))) return code
  return 'enUS'
}

/** Speaks this language from now on; an unknown one is English. Gives the language set. */
export function setLang(code: unknown): string {
  lang = langFor(code, null)
  table = lang === PSEUDO ? pseudoTable(en) : LANGS[lang]!.table
  intl = lang === PSEUDO ? 'en-US' : LANGS[lang]!.intl
  plurals = new Intl.PluralRules(intl)
  return lang
}

export const langNow = (): string => lang

function find(from: Table, key: string): string | Plural | Table | undefined {
  let at: string | Plural | Table | undefined = from
  for (const part of key.split('.')) at = typeof at === 'object' ? (at as Table)[part] : undefined
  return at
}
const isPlural = (x: unknown): x is Plural => typeof x === 'object' && x !== null && typeof (x as Plural).other === 'string'

/** The text of a key in the language spoken, its {names} filled from values. Numbers go in as given: num() formats them. */
export function t(key: Key, values: Record<string, string | number> = {}): string {
  let said = find(table, key)
  if (said === undefined) said = find(en, key)
  if (isPlural(said)) said = said[plurals.select(Number(values.count))] ?? said.other
  if (typeof said !== 'string') return key
  return said.replace(/\{(\w+)\}/g, (all, name: string) => (name in values ? String(values[name]) : all))
}

/** A text cut at one of its {names}: what comes before and after it, for a link or a control put in the middle of a sentence. */
export function around(key: Key, name: string, values: Record<string, string | number> = {}): [string, string] {
  const [before = '', after = ''] = t(key, { ...values, [name]: '\u0000' }).split('\u0000')
  return [before, after]
}

/** A number as the language writes it. */
export const num = (n: number, options?: Intl.NumberFormatOptions): string => n.toLocaleString(intl, options)
// English shows dates and hours the British way, as it always has: 23 Nov, 14:05.
const dates = (): string => (lang === 'enUS' || lang === PSEUDO ? 'en-GB' : intl)
/** An hour of the day, on 24 hours. */
export const clock = (ms: number): string => new Date(ms).toLocaleTimeString(dates(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
/** A day, as the options ask. */
export const day = (ms: number, options: Intl.DateTimeFormatOptions): string => new Date(ms).toLocaleDateString(dates(), options)

// The pseudo-language: letters swapped for accented ones, {names} kept, and a tail that makes it 40% longer, in brackets.
const PLAIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ACCENTED = 'àƀçđéƒĝĥîĵķĺɱñöþǫŕšţûṽŵẋýžÀƁÇĐÉƑĜĤÎĴĶĹṀÑÖÞǪŔŠŢÛṼŴẊÝŽ'
export function pseudo(text: string): string {
  const swapped = text
    .split(/(\{\w+\})/)
    .map((part) => (part.startsWith('{') ? part : [...part].map((c) => [...ACCENTED][PLAIN.indexOf(c)] ?? c).join('')))
    .join('')
  return `[${swapped}${'·'.repeat(Math.ceil(text.length * 0.4))}]`
}
function pseudoTable(from: Table): Table {
  const out: Table = {}
  for (const [key, value] of Object.entries(from)) {
    out[key] = typeof value === 'string' ? pseudo(value) : isPlural(value) ? Object.fromEntries(Object.entries(value).map(([form, text]) => [form, pseudo(text!)])) as Plural : pseudoTable(value)
  }
  return out
}
