// Reads the QuestieDB addon the player has installed: quests, NPCs, objects, items and where they
// are. Nothing of it is copied or shipped: without Questie the app has no such data and says so.
// QuestieDB keeps every entity in its .toc, as base64 CBOR, one metadata line per field.
import { readFileSync } from 'node:fs'
import type { GameMap } from '../shared/maps'
import { join } from 'node:path'
import type { GameQuest, LogQuest, ObjectiveKind, QuestIcon, QuestieShown, QuestPin } from '../shared/quests'
import { best, fold, wordsMatch, type Found } from '../shared/search'
import type { ItemSources } from '../shared/tips'
import { resourceOf, servicesOf, type FixedPin, type ServiceLayer } from '../shared/services'

/** The file of QuestieDB this app reads, in a game folder. Questie without it gives the app nothing. */
export const questieFile = (gameFolder: string): string => join(gameFolder, '_forever_', 'Interface', 'AddOns', 'QuestieDB', 'QuestieDB_Forever.toc')

// Field numbers, from QuestieDB's src/meta/*Meta.lua.
export const QUEST = { name: 1, startedBy: 2, finishedBy: 3, reqLevel: 4, level: 5, triggerEnd: 9, objectives: 10 } as const
export const NPC = { name: 1, spawns: 7, waypoints: 8, zone: 9, friendly: 13, sub: 14, flags: 15 } as const
export const OBJECT = { name: 1, spawns: 4 } as const
export const ITEM = { name: 1, npcDrops: 2, objectDrops: 3, vendors: 14 } as const

const SAME_SPOT = 0.02 // percent of a zone's map: the addon rounds a place to a hundredth

export type Kind = 'Quest' | 'Npc' | 'Object' | 'Item'
/** Places by zone (the game's area number, as text): x and y in percent of the zone. */
export type Places = Record<string, [number, number][]>

export interface Questie {
  /** QuestieDB's own version, as its .toc says. */
  version: string
  ids: { Quest: number[]; Npc: number[]; Object: number[]; Item: number[] }
  /** One field of one entity, as QuestieDB holds it; undefined when it has none. */
  get: (kind: Kind, id: number, field: number) => unknown
  /** Where an NPC or an object is. A patrol has no spawn: it is where its path starts. */
  places: (kind: 'Npc' | 'Object', id: number) => Places
  /** The NPCs and the objects of each zone. */
  zoneIndex: { Npc: Map<string, number[]>; Object: Map<string, number[]> }
}

function half(h: number): number {
  const exp = (h >> 10) & 31, frac = h & 1023, sign = h >> 15 ? -1 : 1
  if (exp === 0) return sign * frac * 2 ** -24
  if (exp === 31) return frac ? NaN : sign * Infinity
  return sign * (1 + frac / 1024) * 2 ** (exp - 15)
}

/** One CBOR value: the kinds QuestieDB writes (numbers, text, lists, maps, true, false, nothing). */
export function cbor(buf: Buffer): unknown {
  let i = 0
  const uint = (info: number): number => {
    if (info < 24) return info
    if (info > 27) throw new Error(`cbor: length ${info}`)
    const size = 1 << (info - 24)
    let v = 0
    for (let k = 0; k < size; k++) v = v * 256 + buf[i++]!
    return v
  }
  const read = (): unknown => {
    if (i >= buf.length) throw new Error('cbor: cut short')
    const head = buf[i++]!
    const major = head >> 5, info = head & 31
    if (major === 7) {
      if (info === 20) return false
      if (info === 21) return true
      if (info === 22 || info === 23) return null
      const size = info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : 0
      if (!size) throw new Error(`cbor: simple value ${info}`)
      const at = i
      i += size
      return size === 2 ? half(buf.readUInt16BE(at)) : size === 4 ? buf.readFloatBE(at) : buf.readDoubleBE(at)
    }
    const n = uint(info)
    if (major === 0) return n
    if (major === 1) return -1 - n
    if (major === 2 || major === 3) {
      const s = buf.toString(major === 3 ? 'utf8' : 'latin1', i, i + n)
      i += n
      return s
    }
    if (major === 4) return Array.from({ length: n }, read)
    if (major === 5) {
      const o: Record<string, unknown> = {}
      for (let k = 0; k < n; k++) o[String(read())] = read()
      return o
    }
    throw new Error(`cbor: major type ${major}`)
  }
  return read()
}

// A Lua table comes back as a list, or as a map when it has holes. at() counts from 1, as Lua does.
export const at = (t: unknown, i: number): unknown => (Array.isArray(t) ? t[i - 1] : t && typeof t === 'object' ? (t as Record<string, unknown>)[i] : undefined)
export const list = (t: unknown): unknown[] => (Array.isArray(t) ? t : t && typeof t === 'object' ? Object.values(t) : [])
/** A table with its keys, as Lua has them: a list is keyed from 1 (the zones of Dun Morogh, zone 1, are written as one). */
export const keyed = (t: unknown): [string, unknown][] => (Array.isArray(t) ? t.map((v, i): [string, unknown] => [String(i + 1), v]) : t && typeof t === 'object' ? Object.entries(t) : [])

/** Opens the QuestieDB in a game folder; null when the player has none, or it is not one this app can read. */
export function openQuestie(gameFolder: string): Questie | null {
  let text: string
  try {
    text = readFileSync(questieFile(gameFolder), 'utf8')
  } catch {
    return null
  }
  const store = new Map<string, string>()
  const ids: Questie['ids'] = { Quest: [], Npc: [], Object: [], Item: [] }
  for (const m of text.matchAll(/^## X-(Quest|Npc|Object|Item)-(.+?): ?(.*)$/gm)) {
    store.set(`${m[1]}-${m[2]}`, m[3]!)
    // Every entity has a row of its scalars, -S: that row is the list of what there is.
    const scalars = /^(\d+)-S$/.exec(m[2]!)
    if (scalars) ids[m[1] as Kind].push(+scalars[1]!)
  }
  if (!ids.Quest.length) return null

  // A value is decoded when it is first asked for: most of the fifteen megabytes are never read.
  const memo = new Map<string, unknown>()
  function value(key: string): unknown {
    if (memo.has(key)) return memo.get(key)
    let raw = store.get(key)
    // A long value is cut in pieces: ~3~ says how many, each on a line of its own.
    const pieces = raw && /^~(\d+)~$/.exec(raw)
    if (pieces) {
      raw = ''
      for (let k = 1; k <= +pieces[1]!; k++) raw += store.get(`${key}-${k}`) ?? ''
    }
    let v: unknown
    try {
      v = raw === undefined ? undefined : cbor(Buffer.from(raw, 'base64'))
    } catch {
      v = undefined // a value this app cannot read is a value that is not there
    }
    memo.set(key, v)
    return v
  }
  // Scalars live in the -S row, tables on a line of their own.
  const get = (kind: Kind, id: number, field: number): unknown => {
    const scalar = (value(`${kind}-${id}-S`) as Record<string, unknown> | undefined)?.[field]
    return scalar !== undefined ? scalar : value(`${kind}-${id}-${field}`)
  }

  const spot = (p: unknown): [number, number] | null => {
    const x = at(p, 1), y = at(p, 2)
    return typeof x === 'number' && typeof y === 'number' && x > 0 ? [x, y] : null // QuestieDB marks "inside an instance" with -1
  }
  function places(kind: 'Npc' | 'Object', id: number): Places {
    const out: Places = {}
    for (const [zone, spots] of keyed(get(kind, id, kind === 'Npc' ? NPC.spawns : OBJECT.spawns))) out[zone] = list(spots).map(spot).filter((p) => p !== null)
    for (const [zone, paths] of kind === 'Npc' ? keyed(get(kind, id, NPC.waypoints)) : []) {
      if (out[zone]?.length) continue
      const first = spot(at(list(paths)[0], 1))
      if (first) out[zone] = [first]
    }
    return out
  }

  const zoneIndex: Questie['zoneIndex'] = { Npc: new Map(), Object: new Map() }
  for (const kind of ['Npc', 'Object'] as const) {
    for (const id of ids[kind]) {
      for (const [zone, spots] of Object.entries(places(kind, id))) {
        if (!spots.length) continue
        const there = zoneIndex[kind].get(zone)
        if (there) there.push(id)
        else zoneIndex[kind].set(zone, [id])
      }
    }
  }

  return { version: /^## Version: *(.+)$/m.exec(text)?.[1]?.trim() ?? 'unknown', ids, get, places, zoneIndex }
}

/** What each vendor sells, by the NPC's number: QuestieDB lists the sellers of each item, turned round here. Prices and names are the game's (shopRows in shared/items.ts). */
export function shops(db: Questie): Map<number, number[]> {
  const out = new Map<number, number[]>()
  for (const item of db.ids.Item)
    for (const npc of list(db.get('Item', item, ITEM.vendors))) {
      if (typeof npc !== 'number') continue
      const sold = out.get(npc)
      if (sold) sold.push(item)
      else out.set(npc, [item])
    }
  return out
}

/** Every name the search looks through: NPCs, quests and items, each once for all that share it. */
export interface SearchIndex { kind: Found['kind']; name: string; lower: string; ids: number[] }

export function searchIndex(db: Questie): SearchIndex[] {
  const index: SearchIndex[] = []
  for (const [kind, from, field] of [['npc', 'Npc', NPC.name], ['quest', 'Quest', QUEST.name], ['item', 'Item', ITEM.name]] as const) {
    const byName = new Map<string, SearchIndex>()
    for (const id of db.ids[from]) {
      const name = db.get(from, id, field)
      if (typeof name !== 'string' || !name) continue
      const entry = byName.get(name)
      if (entry) entry.ids.push(id)
      else byName.set(name, { kind, name, lower: fold(name), ids: [id] })
    }
    index.push(...byName.values())
  }
  return index
}

/** What each service is called by who looks for it, beside what the game writes under the name. */
const SERVICE_WORDS: Record<ServiceLayer, string> = { flight: 'flight master taxi', inn: 'inn innkeeper', vendors: 'vendor', repair: 'repair', trainers: 'trainer', bank: 'bank banker', auction: 'auction house auctioneer', stable: 'stable master' }

/** Every NPC that does something for a player, with the words that tell what: for the search by what one does. */
export interface Doer { id: number; name: string; note: string; lower: string; side: string }

export function doerIndex(db: Questie): Doer[] {
  const doers: Doer[] = []
  for (const id of db.ids.Npc) {
    const name = db.get('Npc', id, NPC.name), sub = db.get('Npc', id, NPC.sub), flags = db.get('Npc', id, NPC.flags), side = db.get('Npc', id, NPC.friendly)
    const layers = typeof flags === 'number' ? servicesOf(flags) : []
    const told = typeof sub === 'string' ? sub : ''
    // Someone friendly to no side serves no player; someone with no title and no service does nothing to look for.
    if (typeof name !== 'string' || !name || typeof side !== 'string' || !side || (!told && !layers.length)) continue
    doers.push({ id, name, note: told || layers.map((layer) => SERVICE_WORDS[layer].split(' ')[0]).join(', '), lower: fold(`${told} ${layers.map((layer) => SERVICE_WORDS[layer]).join(' ')}`), side })
  }
  return doers
}

const DOERS_MOST = 400 // who does what was typed: all of them go to the window, which knows which are near
const DOERS_FROM = 3 // letters typed before the search looks at what people do

/**
 * What the search finds for what was typed: the best names that have a place on the map, and after
 * them everyone who does what was typed ("first aid", "repair", "gryphon master"), each marked so. An NPC is
 * where it stands, in its own zone first; a quest where it is taken; an item on who sells it, or
 * drops it, or on what holds it. An item with more than one seller is on each of them, marked as
 * those who do something are: the window shows the nearest that serve the character's side.
 */
export function search(db: Questie, index: SearchIndex[], typed: string, most = 12, doers: Doer[] = []): Found[] {
  const text = (v: unknown): string => (typeof v === 'string' ? v : '')
  const numbers = (t: unknown): number[] => list(t).filter((n): n is number => typeof n === 'number')
  const spot = (kind: 'Npc' | 'Object', id: number): { area: number; x: number; y: number } | null => {
    const places = db.places(kind, id), home = kind === 'Npc' ? db.get('Npc', id, NPC.zone) : undefined
    const area = typeof home === 'number' && places[home]?.length ? String(home) : Object.keys(places).find((a) => places[a]!.length)
    const first = area === undefined ? undefined : places[area]![0]
    return first ? { area: +area!, x: first[0], y: first[1] } : null
  }
  // The first of these that has a place, and its name.
  const firstOf = (kind: 'Npc' | 'Object', ids: number[]): { where: { area: number; x: number; y: number }; name: string } | null => {
    for (const id of ids) {
      const where = spot(kind, id)
      if (where) return { where, name: text(db.get(kind, id, kind === 'Npc' ? NPC.name : OBJECT.name)) }
    }
    return null
  }
  const found: Found[] = [], shops: Found[] = []
  let items = 0 // found on their many sellers: each counts once among the names
  // Many more than asked are looked at: plenty of names (quest items, creatures of an event) have no place.
  for (const entry of best(index, typed, most * 6)) {
    if (found.length + items >= most) break
    for (const id of entry.ids) {
      let hit: Found | null = null
      if (entry.kind === 'npc') {
        const where = spot('Npc', id)
        if (where) hit = { kind: 'npc', name: entry.name, note: text(db.get('Npc', id, NPC.sub)) || 'NPC', ...where }
      } else if (entry.kind === 'quest') {
        const from = db.get('Quest', id, QUEST.startedBy), giver = firstOf('Npc', numbers(at(from, 1))) ?? firstOf('Object', numbers(at(from, 2)))
        const level = db.get('Quest', id, QUEST.level)
        if (giver) hit = { kind: 'quest', name: entry.name, note: `Quest${typeof level === 'number' && level > 0 ? `, level ${level}` : ''}, from ${giver.name}`, ...giver.where }
      } else {
        const sellers = numbers(db.get('Item', id, ITEM.vendors)).flatMap((npc): Found[] => {
          const where = spot('Npc', npc), side = db.get('Npc', npc, NPC.friendly)
          return where ? [{ kind: 'item', name: entry.name, note: `Sold by ${text(db.get('Npc', npc, NPC.name))}`, ...where, does: true, item: id, ...(typeof side === 'string' ? { side } : {}) }] : []
        })
        if (sellers.length > 1) {
          shops.push(...sellers.slice(0, DOERS_MOST - shops.length))
          items++
          break
        }
        const seller = firstOf('Npc', numbers(db.get('Item', id, ITEM.vendors))), dropper = seller ? null : firstOf('Npc', numbers(db.get('Item', id, ITEM.npcDrops)))
        const holder = seller || dropper ? null : firstOf('Object', numbers(db.get('Item', id, ITEM.objectDrops)))
        const who = seller ?? dropper ?? holder
        if (who) hit = { kind: 'item', name: entry.name, note: `${seller ? 'Sold by' : dropper ? 'Dropped by' : 'Found in'} ${who.name}`, ...who.where, item: id }
      }
      if (hit) {
        found.push(hit)
        break
      }
    }
  }
  found.push(...shops)
  const wanted = fold(typed)
  if (wanted.length >= DOERS_FROM) {
    let more = DOERS_MOST
    for (const doer of doers) {
      if (!wordsMatch(doer.lower, wanted)) continue
      const where = spot('Npc', doer.id)
      if (!where) continue
      found.push({ kind: 'npc', name: doer.name, note: doer.note, ...where, does: true, side: doer.side })
      if (--more === 0) break
    }
  }
  return found
}

/**
 * The pins that are there whatever the character does: every NPC with a service to offer, on each
 * place it stands, and every vein of ore and every herb.
 */
export function fixedPins(db: Questie): FixedPin[] {
  const pins: FixedPin[] = []
  const add = (kind: 'Npc' | 'Object', id: number, pin: Omit<FixedPin, 'area' | 'x' | 'y'>): void => {
    for (const [area, spots] of Object.entries(db.places(kind, id))) for (const [x, y] of spots) pins.push({ area: +area, x, y, ...pin })
  }
  const sold = shops(db)
  for (const id of db.ids.Npc) {
    const flags = db.get('Npc', id, NPC.flags), side = db.get('Npc', id, NPC.friendly), name = db.get('Npc', id, NPC.name), sub = db.get('Npc', id, NPC.sub)
    const layers = typeof flags === 'number' ? servicesOf(flags) : []
    // Someone friendly to no side serves no player.
    if (!layers.length || typeof side !== 'string' || !side || typeof name !== 'string') continue
    const panel = layers.includes('vendors') || layers.includes('trainers')
    add('Npc', id, { name, ...(typeof sub === 'string' && sub ? { sub } : {}), layers, side, ...(panel && { npc: id }), ...(sold.has(id) && { sells: sold.get(id) }) })
  }
  for (const id of db.ids.Object) {
    const name = db.get('Object', id, OBJECT.name), layer = typeof name === 'string' ? resourceOf(name) : null
    if (layer) add('Object', id, { name: name as string, layers: [layer] })
  }
  return pins
}

const SPREAD = 4 // percent of a zone's map: two places of one target closer than this are one icon
const ICONS_A_QUEST = 40

/**
 * What Questie would show of the quests of the log, made here for a player without it: where a
 * quest that is done is handed in, and where what an open one still asks for is found. The quests
 * to take are not here: which ones a character may take is Questie's own knowledge.
 */
// ponytail: an objective of the game is matched to QuestieDB's by its kind and its place among
// those of that kind, and the places of a target are thinned by distance, not gathered as Questie
// does. Kill credits and spells have no icon. Take Questie's own matching if these show wrong.
const OBJECTIVE_KINDS: Record<number, ObjectiveKind> = { 1: 'slay', 2: 'object', 3: 'loot' } // by the game's kind of objective
export function shownFromLog(db: Questie, log: GameQuest[]): QuestieShown {
  type Who = ['Npc' | 'Object', number]
  const numbers = (t: unknown): number[] => list(t).filter((n): n is number => typeof n === 'number')
  const icons: QuestieShown['icons'] = { available: [], turnin: [], objective: [] }
  const active: QuestieShown['active'] = []
  for (const quest of log) {
    const spots: QuestIcon[] = []
    const put = (area: number, x: number, y: number, kind?: ObjectiveKind): void => {
      if (spots.length < ICONS_A_QUEST && !spots.some((s) => s.area === area && Math.hypot(s.x - x, s.y - y) < SPREAD)) spots.push({ quest: quest.id, area, x, y, ...(kind && { kind }) })
    }
    // What each target is there for, by the kind of the objective that asks for it.
    const asked = new Map<string, ObjectiveKind>()
    const stand = (who: Who[]): void => {
      for (const [kind, id] of who) for (const [area, places] of Object.entries(db.places(kind, id))) for (const [x, y] of places) put(+area, x, y, asked.get(`${kind}:${id}`))
    }
    const targets: Who[] = []
    if (quest.done) {
      const by = db.get('Quest', quest.id, QUEST.finishedBy)
      stand([...numbers(at(by, 1)).map((id): Who => ['Npc', id]), ...numbers(at(by, 2)).map((id): Who => ['Object', id])])
      icons.turnin.push(...spots)
    } else {
      const groups = db.get('Quest', quest.id, QUEST.objectives)
      const entry = (kind: number, nth: number): number | undefined => numbers([at(list(at(groups, kind))[nth], 1)])[0]
      const of = (kind: number, id: number): Who[] =>
        kind === 1 ? [['Npc', id]] : kind === 2 ? [['Object', id]] : [...numbers(db.get('Item', id, ITEM.npcDrops)).map((npc): Who => ['Npc', npc]), ...numbers(db.get('Item', id, ITEM.objectDrops)).map((object): Who => ['Object', object])]
      const seen = [0, 0, 0, 0]
      for (const objective of quest.objectives) {
        if (objective.kind < 1 || objective.kind > 3) continue
        const id = entry(objective.kind, seen[objective.kind]!++)
        if (id === undefined || objective.done) continue
        const who = of(objective.kind, id)
        for (const [kind, target] of who) asked.set(`${kind}:${target}`, OBJECTIVE_KINDS[objective.kind]!)
        targets.push(...who)
      }
      // The game told no objective QuestieDB knows: everything the quest asks for is shown.
      if (!quest.objectives.some((o) => o.kind >= 1 && o.kind <= 3)) for (const kind of [1, 2, 3]) for (const row of list(at(groups, kind))) for (const id of numbers([at(row, 1)])) targets.push(...of(kind, id))
      stand(targets)
      // A place to go to, for a quest that asks for nothing else.
      for (const [area, places] of keyed(at(db.get('Quest', quest.id, QUEST.triggerEnd), 2))) {
        for (const place of list(places)) {
          const [x, y] = numbers(place)
          if (x !== undefined && y !== undefined) put(+area, x, y, 'event')
        }
      }
      icons.objective.push(...spots)
    }
    active.push({ id: quest.id, done: quest.done, targets: [...new Set(targets.map(([kind, id]) => `${kind === 'Npc' ? 'm' : 'o'}_${id}`))] })
  }
  return { icons, active }
}

/**
 * Whether QuestieDB has this creature, object or quest with a place to show: what the addon's log
 * need not send (gamelog.ts, M15-F14). A quest has one when anything it asks for has one.
 */
export function placed(db: Questie, kind: string, id: number): boolean {
  // ponytail: a quest as a whole, not the one objective that moved; the objective's number is in the entry if that is ever needed.
  if (kind === 'quest') return shownFromLog(db, [{ id, done: false, objectives: [] }]).icons.objective.length > 0
  return Object.values(db.places(kind === 'npc' ? 'Npc' : 'Object', id)).some((spots) => spots.length > 0)
}

/** How far, in yards, the player may meet an NPC from where QuestieDB has it before it counts as elsewhere (M15-F24). */
export const NEAR_NPC = 25

/** Every spot QuestieDB has for an NPC, by zone, in hundredths of the zone: its spawns and every point of its paths. */
export function npcSpots(db: Questie, id: number): Places {
  const out: Places = {}
  for (const [zone, spots] of Object.entries(db.places('Npc', id))) out[zone] = [...spots]
  for (const [zone, paths] of keyed(db.get('Npc', id, NPC.waypoints)))
    for (const path of list(paths))
      for (const p of list(path)) {
        const x = at(p, 1), y = at(p, 2)
        if (typeof x === 'number' && typeof y === 'number' && x > 0) (out[zone] ??= []).push([x, y])
      }
  return out
}

/**
 * Whether QuestieDB has an NPC where the player talked to it, within `near` yards: what the
 * addon's log need not send (M15-F24). place: the entry's map, x and y on it from 0 to 1, and where
 * the game told them the continent and the yards of the world (north, west). An NPC QuestieDB lacks
 * is not where it says. Without the maps, or a place the maps cannot put in the world, it cannot be
 * told: yes, and nothing is sent.
 */
export function metWhereQuestieSays(db: Questie, id: number, place: number[], maps: GameMap[] | null, near = NEAR_NPC): boolean {
  const spots = Object.entries(npcSpots(db, id)).filter(([, list]) => list.length > 0)
  if (spots.length === 0) return false
  if (!maps) return true
  const [map, x, y, continent, north, west] = place
  const on = maps.find((m) => m.id === map)
  const met = north !== undefined && west !== undefined && continent !== undefined
    ? { continent, north, west }
    : on?.rect && x !== undefined && y !== undefined && on.continent !== null ? { continent: on.continent, north: on.rect.maxX - y * (on.rect.maxX - on.rect.minX), west: on.rect.maxY - x * (on.rect.maxY - on.rect.minY) } : null
  if (!met) return true
  let nearest = Infinity
  for (const [zone, list] of spots)
    for (const m of maps.filter((m) => m.area === Number(zone) && m.rect && m.continent === met.continent))
      for (const [sx, sy] of list) nearest = Math.min(nearest, Math.hypot(m.rect!.maxX - (sy / 100) * (m.rect!.maxX - m.rect!.minX) - met.north, m.rect!.maxY - (sx / 100) * (m.rect!.maxY - m.rect!.minY) - met.west))
  // ponytail: a zone of QuestieDB no map of this continent has (another continent, or a map the game lacks) cannot be measured: yes, as above.
  return nearest === Infinity || nearest <= near
}

/** The quests of the log, each by the name its pins carry. */
export function questLog(db: Questie, shown: QuestieShown): LogQuest[] {
  return shown.active.map((q) => {
    const name = db.get('Quest', q.id, QUEST.name)
    return { name: typeof name === 'string' && name ? name : `Quest ${q.id}`, done: q.done }
  })
}

/**
 * The pins of what Questie shows: one for each icon it holds, on the very spot. Which quests, how
 * many icons and where are Questie's own; QuestieDB gives the names: of the quest, and of who or
 * what stands there.
 */
export function questPins(db: Questie, shown: QuestieShown): QuestPin[] {
  type Who = ['Npc' | 'Object', number]
  const text = (v: unknown, or: string): string => (typeof v === 'string' && v ? v : or)
  const named = ([kind, id]: Who): string => text(db.get(kind, id, kind === 'Npc' ? NPC.name : OBJECT.name), kind === 'Npc' ? 'Someone' : 'Something')
  const numbers = (t: unknown): number[] => list(t).filter((n): n is number => typeof n === 'number')
  // A list of QuestieDB's: creatures first, objects second.
  const both = (t: unknown): Who[] => [...numbers(at(t, 1)).map((id): Who => ['Npc', id]), ...numbers(at(t, 2)).map((id): Who => ['Object', id])]
  // Who a quest is taken from: its givers, and whoever drops or holds a thing that starts it.
  const starters = (quest: number): Who[] => {
    const t = db.get('Quest', quest, QUEST.startedBy)
    const dropped = numbers(at(t, 3)).flatMap((item) => [...numbers(db.get('Item', item, ITEM.npcDrops)).map((id): Who => ['Npc', id]), ...numbers(db.get('Item', item, ITEM.objectDrops)).map((id): Who => ['Object', id])])
    return [...both(t), ...dropped]
  }
  const targets = new Map(
    shown.active.map((q) => [
      q.id,
      q.targets.flatMap((t): Who[] => {
        const m = /^([mo])_(\d+)$/.exec(t)
        return m ? [[m[1] === 'm' ? 'Npc' : 'Object', +m[2]!]] : []
      }),
    ]),
  )
  // Of these, the one nearest to a spot of a zone, and how far (in percent of the zone's map).
  const nearest = (who: Who[], area: number, x: number, y: number): { who: Who; far: number } | null => {
    let best: { who: Who; far: number } | null = null
    for (const w of who) {
      for (const [sx, sy] of db.places(w[0], w[1])[area] ?? []) {
        const far = Math.hypot(sx - x, sy - y)
        if (!best || far < best.far) best = { who: w, far }
      }
    }
    return best
  }

  const pins = new Map<string, QuestPin>()
  for (const type of ['available', 'turnin', 'objective'] as const) {
    for (const icon of shown.icons[type]) {
      const title = text(db.get('Quest', icon.quest, QUEST.name), `Quest ${icon.quest}`)
      const level = db.get('Quest', icon.quest, QUEST.level)
      const quest = type === 'available' && typeof level === 'number' && level > 0 ? `[${level}] ${title}` : title
      const who = type === 'available' ? starters(icon.quest) : type === 'turnin' ? both(db.get('Quest', icon.quest, QUEST.finishedBy)) : (targets.get(icon.quest) ?? [])
      // Givers stand on the icon itself. What is to find is gathered by Questie into one icon in
      // the middle of a few: the nearest is the one. An icon Questie moved (to the door of a
      // dungeon, to the zone around a place) is named only when there is no doubt about who.
      const found = nearest(who, icon.area, icon.x, icon.y)
      const name = found && (type === 'objective' || found.far < SAME_SPOT) ? named(found.who) : who.length === 1 ? named(who[0]!) : title
      const key = `${type}:${icon.area}:${icon.x}:${icon.y}`
      const pin = pins.get(key)
      if (!pin) pins.set(key, { type, area: icon.area, x: icon.x, y: icon.y, ...(icon.kind && { kind: icon.kind }), name, quests: [quest] })
      else if (!pin.quests.includes(quest)) pin.quests.push(quest)
    }
  }
  return [...pins.values()]
}

/** Who sells an item, who drops it and where it is found, from QuestieDB: with a place each, a few of each (the popup of an item, M10-F15). */
export function itemSources(db: Questie, item: number, most = 8): ItemSources {
  const numbers = (t: unknown): number[] => list(t).filter((n): n is number => typeof n === 'number')
  const name = (kind: 'Npc' | 'Object', id: number): string => {
    const n = db.get(kind, id, kind === 'Npc' ? NPC.name : OBJECT.name)
    return typeof n === 'string' ? n : ''
  }
  // Its own zone first when QuestieDB names one, the first place it has otherwise.
  const spot = (kind: 'Npc' | 'Object', id: number): { area: number; x: number; y: number } | null => {
    const places = db.places(kind, id), home = kind === 'Npc' ? db.get('Npc', id, NPC.zone) : undefined
    const area = typeof home === 'number' && places[home]?.length ? String(home) : Object.keys(places).find((a) => places[a]!.length)
    const first = area === undefined ? undefined : places[area]![0]
    return first ? { area: +area!, x: first[0], y: first[1] } : null
  }
  const sold = numbers(db.get('Item', item, ITEM.vendors)).flatMap((npc) => {
    const where = spot('Npc', npc), side = db.get('Npc', npc, NPC.friendly)
    return where && name('Npc', npc) ? [{ npc, name: name('Npc', npc), ...where, ...(typeof side === 'string' && side && { side }) }] : []
  })
  const placed = (kind: 'Npc' | 'Object', ids: number[]): { name: string; area: number }[] =>
    ids.flatMap((id) => {
      const where = spot(kind, id)
      return where && name(kind, id) ? [{ name: name(kind, id), area: where.area }] : []
    }).slice(0, most)
  return { sold, drops: placed('Npc', numbers(db.get('Item', item, ITEM.npcDrops))), found: placed('Object', numbers(db.get('Item', item, ITEM.objectDrops))) }
}
