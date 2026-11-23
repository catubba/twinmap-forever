// Names the app keeps in English that the game has in its own language: the bosses and the dungeons of the map's pins
// (dungeon-pins.ts, from One for All), and the professions and their ranks of the trainers (profession-trainers.ts). Made
// with the map (tiles-worker.ts) when the game is not in English: each table read twice, in English and in the game's
// language, and the two texts of the same row paired. English stays where the game has no other.

/** In the folder of the build: English -> the game's language. None for a game in English. */
export const GAME_NAMES_FILE = 'game-names.json'

// The same name as the pins and the game write it: "The Deadmines" and "Deadmines", "Dire Maul: East" and "Dire Maul - East".
const key = (name: string): string => name.toLowerCase().replace(/^the /, '').replace(/\s*(?::| - )\s*/g, ': ').trim()

let known = new Map<string, string>()

/** The names of this game, from its GAME_NAMES_FILE: for gameName. */
export function setGameNames(names: Record<string, string>): void {
  known = new Map(Object.entries(names).map(([english, own]) => [key(english), own]))
}

/** A name the app keeps in English, in the game's language where the game has it. */
export const gameName = (english: string): string => known.get(key(english)) ?? english

interface Rows {
  rows: { id: number; text(field: number): string }[]
}

/** Adds to names what the same field of the same row says in English and in the game's language; the first of a name stays. */
export function pairNames(english: Rows, own: Rows, field: number, names: Record<string, string>): void {
  const said = new Map<number, string>()
  for (const r of own.rows) {
    try {
      said.set(r.id, r.text(field))
    } catch {
      // a row with no text there
    }
  }
  for (const r of english.rows) {
    let name: string
    try {
      name = r.text(field)
    } catch {
      continue
    }
    const there = said.get(r.id)
    if (name && there && there !== name && !(name in names)) names[name] = there
  }
}

// The wings of Scarlet Monastery: the game names the monastery only. As the game's language would write them.
const WINGS: Record<string, [string, Record<string, string>]> = {
  frFR: [' : ', { Armory: 'Armurerie', Cathedral: 'Cathédrale', Graveyard: 'Cimetière', Library: 'Bibliothèque' }],
  deDE: [': ', { Armory: 'Waffenkammer', Cathedral: 'Kathedrale', Graveyard: 'Friedhof', Library: 'Bibliothek' }],
  esES: [': ', { Armory: 'Armería', Cathedral: 'Catedral', Graveyard: 'Cementerio', Library: 'Biblioteca' }],
  esMX: [': ', { Armory: 'Armería', Cathedral: 'Catedral', Graveyard: 'Cementerio', Library: 'Biblioteca' }],
  ptBR: [': ', { Armory: 'Arsenal', Cathedral: 'Catedral', Graveyard: 'Cemitério', Library: 'Biblioteca' }],
  ruRU: [': ', { Armory: 'Оружейная', Cathedral: 'Собор', Graveyard: 'Кладбище', Library: 'Библиотека' }],
  koKR: [': ', { Armory: '무기고', Cathedral: '대성당', Graveyard: '묘지', Library: '도서관' }],
  zhCN: ['：', { Armory: '武器库', Cathedral: '大教堂', Graveyard: '墓地', Library: '图书馆' }],
  zhTW: ['：', { Armory: '武器庫', Cathedral: '大教堂', Graveyard: '墓地', Library: '圖書館' }],
}

/** Adds the names of the wings ("Scarlet Monastery: Library") among these, from their place's name in names. */
export function wingNames(wings: string[], locale: string, names: Record<string, string>): void {
  const [between, words] = WINGS[locale] ?? [': ', {}]
  for (const wing of wings) {
    const m = /^(.+): (\w+)$/.exec(wing)
    const place = m && [...Object.entries(names)].find(([english]) => key(english) === key(m[1]!))?.[1]
    if (m && place && words[m[2]!]) names[wing] = `${place}${between}${words[m[2]!]}`
  }
}
