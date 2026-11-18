// The character sheets the app keeps, one for each character it has seen: who the character is,
// money, bags, bank and what is worn (Sheet.lua). The addon sends on the strip only the pieces that
// changed after the revision the app holds, and the app tells that revision back (its part "sheet"),
// so the addon stops sending; whatever changed while the app was closed comes when it opens again.

/** One character's sheet. code: drawn by the addon with the sheet; another code is another sheet, taken whole. */
export interface Sheet {
  code: string
  rev: number
  /** The pieces by name (who, money, bags, bank, gear), as the addon tells them. */
  pieces: Record<string, unknown>
  /** When each piece last came, in milliseconds: the bank is as it was when last open. */
  at: Record<string, number>
}

/** By the character's full name, name and surname. */
export type Sheets = Record<string, Sheet>

/** What the strip says: the pieces newer than what the app holds. */
export interface SheetNews {
  key: string
  code: string
  rev: number
  p: Record<string, unknown>
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isRev = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

/** The section as the strip gives it, checked; null when it is not a sheet. */
export function sheetNewsFrom(v: unknown): SheetNews | null {
  if (!isObject(v)) return null
  const { key, code, rev, p } = v
  if (typeof key !== 'string' || !key || typeof code !== 'string' || !code || !isRev(rev) || !isObject(p)) return null
  return { key, code, rev, p }
}

/** The sheets as the file gives them, checked: one that is not readable was never kept. */
export function sheetsFrom(read: unknown): Sheets {
  const out: Sheets = {}
  if (!isObject(read)) return out
  for (const [key, s] of Object.entries(read)) {
    if (isObject(s) && typeof s.code === 'string' && isRev(s.rev) && isObject(s.pieces) && isObject(s.at)) out[key] = s as unknown as Sheet
  }
  return out
}

/**
 * The sheets with news taken in. Pieces go on top of the same sheet; another code starts the
 * character's sheet over with what came. News no newer than what is held changes nothing: the same
 * sheet back.
 */
export function mergeSheet(sheets: Sheets, news: SheetNews, now: number): Sheets {
  const had = sheets[news.key]
  const same = had?.code === news.code
  if (same && news.rev <= had.rev) return sheets
  const at = Object.fromEntries(Object.keys(news.p).map((piece) => [piece, now]))
  const sheet: Sheet = same ? { code: news.code, rev: news.rev, pieces: { ...had.pieces, ...news.p }, at: { ...had.at, ...at } } : { code: news.code, rev: news.rev, pieces: { ...news.p }, at }
  return { ...sheets, [news.key]: sheet }
}

/** What the app tells the addon it holds: the code and revision of each character's sheet. */
export function heldOf(sheets: Sheets): Record<string, { code: string; rev: number }> {
  return Object.fromEntries(Object.entries(sheets).map(([key, s]) => [key, { code: s.code, rev: s.rev }]))
}
