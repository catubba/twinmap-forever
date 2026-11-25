// The game's spells (spells.json, made beside the map by tiles-worker.ts just after the map is ready), for the panels that
// name spells: Professions and Spellbook. Asked for once the map is ready, and again every few seconds until the file is
// there: at the first start of a build it takes a few seconds more.
import { SPELLS_FILE, type SpellFacts } from '../../shared/spells'
import { TILES } from './web'

export const spellFacts = $state({ facts: null as SpellFacts | null })

let asked = false
// A file not made yet comes back empty (204) or missing.
function ask(left: number): void {
  const again = (): unknown => left > 0 && setTimeout(() => ask(left - 1), 3000)
  void fetch(`${TILES}/${SPELLS_FILE}`)
    .then((r) => (r.status === 200 ? r.json() : null))
    .then((read: SpellFacts | null) => (read ? (spellFacts.facts = read) : again()))
    .catch(again)
}

/** Asks for the file, once: call it when the map is ready. */
export function askSpellFacts(): void {
  if (asked) return
  asked = true
  ask(40)
}
