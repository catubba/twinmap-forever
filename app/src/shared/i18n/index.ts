// Every text the player sees comes from here: t('key', { values }) gives it in the language chosen.
// English (en.ts) is where every key starts, with a note on where its text shows; the rules for the other
// languages are in the design notes (l10n.md). A key a language has not got shows its English, never the key.
// The language is set once as a page or the main process starts (setLang): a new choice reloads the page.
import en from './en'
import fr from './fr'
import esES from './es-ES'
import esMX from './es-MX'
import de from './de'
import ru from './ru'
import ko from './ko'
import zh from './zh'

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
export const LANGS: Record<string, { name: string; intl: string; table: Table; soon?: true }> = {
  enUS: { name: 'English', intl: 'en-US', table: en },
  // soon (none today): written, not offered yet. Spoken only when chosen by hand in settings.json, never from the game's language,
  // until all the languages come out together (design notes, M17-F15). Trials offer them with TWINMAP_LANGS=all.
  frFR: { name: 'Français', intl: 'fr-FR', table: fr },
  esES: { name: 'Español (España)', intl: 'es-ES', table: esES },
  esMX: { name: 'Español (Latinoamérica)', intl: 'es-MX', table: esMX },
  deDE: { name: 'Deutsch', intl: 'de-DE', table: de },
  ruRU: { name: 'Русский', intl: 'ru-RU', table: ru },
  koKR: { name: '한국어', intl: 'ko-KR', table: ko },
  zhCN: { name: '简体中文', intl: 'zh-CN', table: zh },
}
/** Every language planned (design notes, l10n.md), in its own words, in the order they are offered. The ones not in
 *  LANGS, or there but soon, show as coming, said in their own words too: the player who reads it is one who speaks it. */
export const PLANNED: { code: string; name: string; soon: string }[] = [
  { code: 'enUS', name: 'English', soon: 'English (coming soon)' },
  { code: 'frFR', name: 'Français', soon: 'Français (bientôt)' },
  { code: 'deDE', name: 'Deutsch', soon: 'Deutsch (demnächst)' },
  { code: 'esES', name: 'Español (España)', soon: 'Español (España) (próximamente)' },
  { code: 'esMX', name: 'Español (Latinoamérica)', soon: 'Español (Latinoamérica) (próximamente)' },
  { code: 'ruRU', name: 'Русский', soon: 'Русский (скоро)' },
  { code: 'koKR', name: '한국어', soon: '한국어 (출시 예정)' },
  { code: 'zhCN', name: '简体中文', soon: '简体中文 (即将推出)' },
]
let all = false
/** For trials (TWINMAP_LANGS=all): the languages written but not out yet are offered too. */
export const offerAll = (on = true): void => void (all = on)
/** Whether the player may have this language: written, and out (or a trial). */
export const offered = (code: unknown): boolean => typeof code === 'string' && code in LANGS && (!LANGS[code]!.soon || all)
/** The languages planned, each with whether it can be had yet. */
export const planned = (): { code: string; name: string; soon: string; ready: boolean }[] => PLANNED.map((l) => ({ ...l, ready: offered(l.code) }))

/** For trials only, never offered: every text marked, accented and 40% longer, so one left in the code shows at a glance.
 *  pseudo-ru, pseudo-ko and pseudo-zh are the same in the letters of the other scripts (FAKES). */
export const PSEUDO = 'pseudo'

let lang = 'enUS'
let table: Table = en
let intl = 'en-US'
let plurals = new Intl.PluralRules(intl)

/** The language to speak: the one chosen, else the game's, else English. */
export function langFor(chosen: unknown, game: unknown): string {
  for (const code of [chosen, game]) if (typeof code === 'string' && ((code in LANGS && (offered(code) || code === chosen)) || (code in FAKES && code === chosen))) return code
  return 'enUS'
}

/** Speaks this language from now on; an unknown one is English. Gives the language set. */
export function setLang(code: unknown): string {
  lang = langFor(code, null)
  table = lang in FAKES ? pseudoTable(en, lang) : LANGS[lang]!.table
  intl = FAKES[lang]?.intl ?? LANGS[lang]!.intl
  plurals = new Intl.PluralRules(intl)
  return lang
}

export const langNow = (): string => lang
/** The language spoken as the web names it (lang of the page): the fonts and the line breaks of its script go by it. */
export const langTag = (): string => intl

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

// Distances: always the game's own unit in the code, as the game and the addons count them. Its clients in a metric
// language write m beside the very same numbers, so metres are a label, never a conversion. The languages whose game
// writes yards (English, Chinese) may show m instead; the game's other languages already do.
const YARDS = new Set(['enUS', 'zhCN', PSEUDO])
let metres = false
/** Whether the language spoken may show metres: it is the game's own yards otherwise. */
export const metricOffered = (): boolean => YARDS.has(lang)
/** Shows metres from now on, where the language may (the player's choice in Settings). */
export const setMetres = (on: boolean): void => void (metres = on)
export const metresOn = (): boolean => metres && metricOffered()
/** A distance as the player reads it: a whole number, and its unit. The number is the game's either way. */
export const distance = (yards: number): string => t(metresOn() ? 'units.metres' : 'units.yards', { n: num(Math.round(yards)) })
// English shows dates and hours the British way, as it always has: 23 Nov, 14:05.
const dates = (): string => (lang === 'enUS' || lang === PSEUDO ? 'en-GB' : intl)
/** An hour of the day, on 24 hours. */
export const clock = (ms: number): string => new Date(ms).toLocaleTimeString(dates(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
/** A day, as the options ask. */
export const day = (ms: number, options: Intl.DateTimeFormatOptions): string => new Date(ms).toLocaleDateString(dates(), options)

// The pseudo-languages: letters swapped, {names} kept, in brackets, with a tail of dots for the length. Every swap can be
// undone (design/l10n/screens.js does, to find a button by its English). Accented Latin and Cyrillic are 40% longer, as
// French and Russian can be. Hangul and Han give one sign for two letters (a letter alone at the end of a word: one sign
// too), about as wide as the English; Han without spaces, as Chinese is written (a space is 的).
const PLAIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ACCENTED = [...'àƀçđéƒĝĥîĵķĺɱñöþǫŕšţûṽŵẋýžÀƁÇĐÉƑĜĤÎĴĶĹṀÑÖÞǪŔŠŢÛṼŴẊÝŽ']
const CYRILLIC = [...'абцдефгхийклмнопярстувшжызАБЦДЕФГХИЙКЛМНОПЯРСТУВШЖЫЗ']
const letters = (to: string[]) => (part: string): string => [...part].map((c) => to[PLAIN.indexOf(c)] ?? c).join('')
const pairs = (from: number) => (part: string): string =>
  part.replace(/[a-zA-Z]{1,2}/g, (two) => String.fromCodePoint(from + PLAIN.indexOf(two[0]!) * 53 + (two[1] ? PLAIN.indexOf(two[1]) : 52)))
const FAKES: Record<string, { intl: string; swap: (part: string) => string; tail: number }> = {
  [PSEUDO]: { intl: 'en-US', swap: letters(ACCENTED), tail: 0.4 },
  'pseudo-ru': { intl: 'ru-RU', swap: letters(CYRILLIC), tail: 0.4 },
  'pseudo-ko': { intl: 'ko-KR', swap: pairs(0xac00), tail: 0 },
  'pseudo-zh': { intl: 'zh-CN', swap: (part) => pairs(0x4e00)(part).replace(/ /g, '的'), tail: 0 },
}
export function pseudo(text: string, code = PSEUDO): string {
  const { swap, tail } = FAKES[code]!
  const swapped = text
    .split(/(\{\w+\})/)
    .map((part) => (part.startsWith('{') ? part : swap(part)))
    .join('')
  return `[${swapped}${'·'.repeat(Math.ceil(text.length * tail))}]`
}
function pseudoTable(from: Table, code: string): Table {
  const out: Table = {}
  for (const [key, value] of Object.entries(from)) {
    out[key] = typeof value === 'string' ? pseudo(value, code) : isPlural(value) ? Object.fromEntries(Object.entries(value).map(([form, text]) => [form, pseudo(text!, code)])) as Plural : pseudoTable(value, code)
  }
  return out
}
