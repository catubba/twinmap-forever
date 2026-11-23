import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import en from './en'
import { around, clock, day, langFor, LANGS, langTag, num, offerAll, offered, planned, pseudo, PSEUDO, setLang, t, type Key, type Table } from '.'

afterEach(() => setLang('enUS'))

test('a key gives its English, its names filled in', () => {
  expect(t('participate.title')).toBe('Help improve Twinmap')
  expect(t('common.close')).toBe('Close')
  expect(around('participate.later', 'none')).toEqual(['You can change your mind at any time in Settings.', ''])
})

test('the language: the one chosen, else the game\'s, else English; the pseudo-language only when chosen', () => {
  expect(langFor(undefined, 'enUS')).toBe('enUS')
  expect(langFor(undefined, 'xxXX')).toBe('enUS')
  expect(langFor('enUS', 'xxXX')).toBe('enUS')
  expect(langFor(PSEUDO, 'enUS')).toBe(PSEUDO)
  expect(langFor(undefined, PSEUDO)).toBe('enUS')
  expect(setLang('nothing')).toBe('enUS')
})

test('a language not offered yet is spoken only when chosen, never from the game', () => {
  expect(langFor(undefined, 'frFR')).toBe('enUS')
  expect(langFor('frFR', 'enUS')).toBe('frFR')
})

test('French writes numbers, hours and days as France does', () => {
  setLang('frFR')
  expect(t('common.close')).toBe('Fermer')
  expect(num(1234567)).toBe('1 234 567')
  expect(num(2.5)).toBe('2,5')
  const at = Date.UTC(2026, 10, 23, 14, 5)
  expect(clock(at + new Date(at).getTimezoneOffset() * 60000)).toBe('14:05')
  expect(day(at, { day: 'numeric', month: 'short', timeZone: 'UTC' })).toBe('23 nov.')
})

test('Spanish writes numbers as each game does: Spain with a decimal comma, Latin America with a decimal point', () => {
  const at = Date.UTC(2026, 10, 23, 14, 5)
  setLang('esES')
  expect(t('common.close')).toBe('Cerrar')
  expect(num(1234567)).toBe('1.234.567')
  expect(num(2.5)).toBe('2,5')
  expect(day(at, { day: 'numeric', month: 'short', timeZone: 'UTC' })).toBe('23 nov')
  setLang('esMX')
  expect(num(1234567)).toBe('1,234,567')
  expect(num(2.5)).toBe('2.5')
  expect(clock(at + new Date(at).getTimezoneOffset() * 60000)).toBe('14:05')
})

test('German writes numbers, hours and days as the German game does', () => {
  setLang('deDE')
  expect(t('common.close')).toBe('Schließen')
  expect(num(1234567)).toBe('1.234.567')
  expect(num(2.5)).toBe('2,5')
  const at = Date.UTC(2026, 10, 23, 14, 5)
  expect(clock(at + new Date(at).getTimezoneOffset() * 60000)).toBe('14:05')
  expect(day(at, { day: 'numeric', month: 'short', timeZone: 'UTC' })).toBe('23. Nov.')
})

test('English writes numbers, hours and days as the app always has', () => {
  expect(num(1234567)).toBe('1,234,567')
  const at = Date.UTC(2026, 10, 23, 14, 5)
  expect(clock(at + new Date(at).getTimezoneOffset() * 60000)).toBe('14:05')
  expect(day(at, { day: 'numeric', month: 'short', timeZone: 'UTC' })).toBe('23 Nov')
})

test('the pseudo-language marks every text, keeps its names, and is 40% longer', () => {
  expect(pseudo('Go to {zone}')).toBe('[Ĝö ţö {zone}·····]')
  setLang(PSEUDO)
  expect(t('participate.title')).toMatch(/^\[Ĥéĺþ .*·+\]$/)
})

test('the pseudo-languages of the other scripts: no Latin letter left, names kept, the page told its language', () => {
  expect(pseudo('Go to {zone}', 'pseudo-ru')).toBe('[Го то {zone}·····]')
  // Two letters a sign: G+o, t+o, and a letter alone gets its own.
  const sign = (from: number, a: string, b?: string): string => {
    const at = (c: string): number => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(c)
    return String.fromCodePoint(from + at(a) * 53 + (b ? at(b) : 52))
  }
  expect(pseudo('Go to {zone} a', 'pseudo-ko')).toBe(`[${sign(0xac00, 'G', 'o')} ${sign(0xac00, 't', 'o')} {zone} ${sign(0xac00, 'a')}]`)
  expect(pseudo('Go to {zone}', 'pseudo-zh')).toBe(`[${sign(0x4e00, 'G', 'o')}的${sign(0x4e00, 't', 'o')}的{zone}]`)
  for (const [code, tag] of [['pseudo-ru', 'ru-RU'], ['pseudo-ko', 'ko-KR'], ['pseudo-zh', 'zh-CN']] as const) {
    expect(setLang(code)).toBe(code)
    expect(langTag()).toBe(tag)
    expect(t('participate.title').replace(/\{\w+\}/g, '')).not.toMatch(/[a-zA-Z]/)
  }
  expect(langFor(undefined, 'pseudo-ru')).toBe('enUS')
})

// The texts of a table by key, plurals as one entry per form.
function texts(table: Table, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(table)) {
    if (typeof value === 'string') out.set(prefix + key, value)
    else if (typeof value.other === 'string') for (const [form, text] of Object.entries(value)) out.set(`${prefix}${key}#${form}`, text as string)
    else for (const [k, v] of texts(value as Table, `${prefix}${key}.`)) out.set(k, v)
  }
  return out
}
const names = (text: string): string => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

test('every language has the keys of English, no more, with the same {names}, and every plural form it needs', () => {
  const english = texts(en)
  const base = new Set([...english.keys()].map((k) => k.split('#')[0]))
  for (const [code, { intl, table }] of Object.entries(LANGS)) {
    if (code === 'enUS') continue
    const own = texts(table)
    expect([...new Set([...own.keys()].map((k) => k.split('#')[0]))].sort(), code).toEqual([...base].sort())
    const forms = new Intl.PluralRules(intl).resolvedOptions().pluralCategories
    for (const key of base) {
      const plural = english.has(`${key}#other`)
      const want = plural ? names(english.get(`${key}#other`)!) : names(english.get(key)!)
      for (const [k, text] of own) if (k.split('#')[0] === key) expect(names(text), `${code} ${k}`).toBe(want)
      if (plural) for (const form of forms) expect(own.has(`${key}#${form}`), `${code} ${key}#${form}`).toBe(true)
    }
  }
})

test('no long or middle dash in any language', () => {
  for (const [code, { table }] of Object.entries(LANGS)) for (const [key, text] of texts(table)) expect(/[\u2013\u2014]/.test(text), `${code} ${key}`).toBe(false)
})

// The words that stay as they are in every language: names of the app, of the game and of other addons and sites.
const NAMES = /\b(Twinmap Forever|Twinmap|World of Warcraft: Forever|World of Warcraft|Forever|CurseForge|GitHub|QuestieDB|Questie|Shortest Path Forever|Shortest Path|Battle\.net|Blizzard Entertainment|Blizzard|Electron|Ctrl|Esc)\b/g
// Pages the player never sees: the trial page of the controls.
const UNSEEN = new Set(['Kit.svelte'])
const RENDERER = join(__dirname, '..', '..', 'renderer', 'src')

// What is left of a page once its code is out: script, style, comments and every {expression}.
function markup(source: string): string {
  let out = source.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ')
  let depth = 0, kept = ''
  for (const c of out) {
    if (c === '{') depth++
    if (depth === 0) kept += c
    if (c === '}') depth = Math.max(0, depth - 1)
  }
  return kept
}

test('no English written by hand in what a page shows', () => {
  const found: string[] = []
  for (const file of readdirSync(RENDERER).filter((f) => f.endsWith('.svelte') && !UNSEEN.has(f))) {
    const page = markup(readFileSync(join(RENDERER, file), 'utf8'))
    const shown = [
      ...[...page.matchAll(/>([^<>]+)</g)].map((m) => m[1]!),
      ...[...page.matchAll(/\b(?:title|placeholder|aria-label|alt|label)="([^"]*)"/g)].map((m) => m[1]!),
    ]
    for (const text of shown) {
      const left = text.replace(NAMES, '').replace(/&\w+;/g, ' ')
      if (/[A-Za-z]{2,}/.test(left)) found.push(`${file}: ${text.trim()}`)
    }
  }
  expect(found).toEqual([])
})

// Where a page or a message for the player is put together in code: the scripts of the pages, and these modules.
const SHARED = join(__dirname, '..')
const SPOKEN = ['link.ts', 'setup.ts', 'tiles-status.ts', 'send.ts', 'feedback.ts', 'layers.ts', 'point-label.ts', 'now.ts', 'death.ts', 'journey.ts', 'items.ts', 'characters.ts', 'ah.ts', 'saved.ts', 'game.ts']
// Lines that may hold English: what goes to the log, errors and details for the developer (marked so at the end of
// the line), imports, comments, files fetched, fonts, CSS classes and selectors, Leaflet events, codes compared.
const QUIET = /^\s*(\/\/|\*|\/\*|import )|record\.say|\bsay\(|console\.|throw new|new Error|log\(|querySelector|\.toBe\(|matchMedia|\/\/ for the developer\s*$|fetch\(|fonts\.load|className|\.matches\(|\.on\('|[!=]== '|charCodeAt|names: \[/
test('no English written by hand in the scripts that speak to the player', () => {
  const found: string[] = []
  const scripts = [
    ...readdirSync(RENDERER).filter((f) => f.endsWith('.svelte') && !UNSEEN.has(f)).map((f) => [f, (readFileSync(join(RENDERER, f), 'utf8').match(/<script[\s\S]*?<\/script>/g) ?? []).join('\n')]),
    ...SPOKEN.map((f) => [f, readFileSync(join(SHARED, f), 'utf8')]),
  ]
  for (const [file, code] of scripts) {
    for (const line of code!.split('\n')) {
      if (QUIET.test(line)) continue
      // Keys built at run time (t(`area.${id}`)) are not text.
      for (const m of line.replace(/\bt\(`[^`]*`/g, 't(').matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`]*)`|"([^"\\]*)"/g)) {
        const text = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ').replace(/(https?|data):\S+|<\/?\w+[^>]*>/g, ' ').replace(NAMES, '')
        if (/[A-Za-z]{2,}[ ,.:]+[A-Za-z]{2,}/.test(text) && !/^[\w.@-]+$/.test(text)) found.push(`${file}: ${line.trim().slice(0, 140)}`)
      }
    }
  }
  expect(found).toEqual([])
})

// Every key named in the code is one of English: the types say it, this says it of keys built at run time.
test('the keys are typed', () => {
  const key: Key = 'participate.title'
  expect(t(key)).toBe(en.participate.title)
})

test('every language planned is listed, in its own words; the ones not out yet are coming, until a trial offers them', () => {
  expect(planned().map((l) => l.code)).toEqual(['enUS', 'frFR', 'deDE', 'esES', 'esMX', 'ruRU', 'koKR', 'zhCN'])
  expect(planned().filter((l) => l.ready).map((l) => l.code)).toEqual(['enUS'])
  expect(planned().find((l) => l.code === 'deDE')!.name).toBe('Deutsch')
  expect(planned().find((l) => l.code === 'deDE')!.soon, 'coming, in its own words').toBe('Deutsch (demnächst)')
  offerAll()
  try {
    expect(offered('frFR')).toBe(true)
    expect(offered('esES') && offered('esMX'), 'written, both').toBe(true)
    expect(offered('deDE'), 'written').toBe(true)
    expect(offered('ruRU'), 'not written').toBe(false)
    expect(langFor(undefined, 'frFR'), 'the game language, now offered').toBe('frFR')
  } finally {
    offerAll(false)
  }
  expect(offered('frFR')).toBe(false)
})
