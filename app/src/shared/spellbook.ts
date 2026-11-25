// The Spellbook panel (M20-F11): the book as the game shows it, from the sheet's piece `book` (Sheet.lua: its tabs in order,
// each with its name, picture, spells and then passive ones) and the names, ranks and pictures of the game's files
// (spells.json). As the game's book with "Show all spell ranks" off: of the ranks of a spell, the highest alone, where the
// spell stands. The pet's tab comes as the game words it: its commands are no spells of the files.
import type { SpellFacts } from './spells'

export type BookSpell = { spell: number; name: string; rank: string; icon: number; passive: boolean }
export type BookTab = { name: string; icon: number; spells: BookSpell[] }

// The number in a rank as the game writes it ("Rank 3", "3 레벨"), 0 for none.
const rankNumber = (rank: string): number => Number(rank.match(/\d+/)?.[0] ?? 0)

/** The tabs of the book, none for a sheet the addon has not sent its book with; a spell the files do not name is left out. */
export function bookOf(pieces: Record<string, unknown>, facts: SpellFacts): BookTab[] {
  if (!Array.isArray(pieces.book)) return []
  const tabs: BookTab[] = []
  for (const tab of pieces.book as unknown[]) {
    if (!Array.isArray(tab) || typeof tab[0] !== 'string') continue
    const [name, icon, active, passive] = tab as [string, unknown, unknown, unknown]
    const spells: BookSpell[] = [], at = new Map<string, number>()
    const take = (entry: unknown, passive: boolean): void => {
      let s: BookSpell | undefined
      if (typeof entry === 'number') {
        const f = facts.spells[entry]
        if (f) s = { spell: entry, name: f[0], rank: f[1], icon: f[2], passive }
      } else if (Array.isArray(entry) && typeof entry[0] === 'string') s = { spell: 0, name: entry[0], rank: String(entry[1] ?? ''), icon: Number(entry[2]) || 0, passive }
      if (!s) return
      const i = at.get(s.name)
      if (i === undefined) at.set(s.name, spells.push(s) - 1)
      else if (rankNumber(s.rank) >= rankNumber(spells[i]!.rank)) spells[i] = s
    }
    for (const e of Array.isArray(active) ? active : []) take(e, false)
    for (const e of Array.isArray(passive) ? passive : []) take(e, true)
    if (spells.length) tabs.push({ name, icon: Number(icon) || spells[0]!.icon, spells })
  }
  return tabs
}
