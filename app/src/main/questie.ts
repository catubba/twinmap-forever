// Reads the QuestieDB addon the player has installed: quests, NPCs, objects, items and where they
// are. Nothing of it is copied or shipped: without Questie the app has no such data and says so.
// QuestieDB keeps every entity in its .toc, as base64 CBOR, one metadata line per field.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { QuestieShown, QuestPin, QuestPinType } from '../shared/quests'
import { resourceOf, servicesOf, type FixedPin } from '../shared/services'

/** The file of QuestieDB this app reads, in a game folder. Questie without it gives the app nothing. */
export const questieFile = (gameFolder: string): string => join(gameFolder, '_forever_', 'Interface', 'AddOns', 'QuestieDB', 'QuestieDB_Forever.toc')

// Field numbers, from QuestieDB's src/meta/*Meta.lua.
export const QUEST = { name: 1, startedBy: 2, finishedBy: 3, reqLevel: 4, level: 5, triggerEnd: 9, extra: 29 } as const
export const NPC = { name: 1, spawns: 7, waypoints: 8, friendly: 13, sub: 14, flags: 15 } as const
export const OBJECT = { name: 1, spawns: 4 } as const
export const ITEM = { npcDrops: 2, objectDrops: 3 } as const

export type Kind = 'Quest' | 'Npc' | 'Object' | 'Item'
/** Places by zone (the game's area number, as text): x and y in percent of the zone. */
export type Places = Record<string, [number, number][]>

export interface Questie {
  /** QuestieDB's own version, as its .toc says. */
  version: string
  ids: { Quest: number[]; Npc: number[]; Object: number[] }
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

/** Opens the QuestieDB in a game folder; null when the player has none, or it is not one this app can read. */
export function openQuestie(gameFolder: string): Questie | null {
  let text: string
  try {
    text = readFileSync(questieFile(gameFolder), 'utf8')
  } catch {
    return null
  }
  const store = new Map<string, string>()
  const ids: Questie['ids'] = { Quest: [], Npc: [], Object: [] }
  for (const m of text.matchAll(/^## X-(Quest|Npc|Object|Item)-(.+?): ?(.*)$/gm)) {
    store.set(`${m[1]}-${m[2]}`, m[3]!)
    // Every entity has a row of its scalars, -S: that row is the list of what there is.
    const scalars = m[1] !== 'Item' && /^(\d+)-S$/.exec(m[2]!)
    if (scalars) ids[m[1] as 'Quest' | 'Npc' | 'Object'].push(+scalars[1]!)
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
    const spawns = (get(kind, id, kind === 'Npc' ? NPC.spawns : OBJECT.spawns) ?? {}) as Record<string, unknown>
    for (const zone of Object.keys(spawns)) out[zone] = list(spawns[zone]).map(spot).filter((p) => p !== null)
    const paths = (kind === 'Npc' ? (get(kind, id, NPC.waypoints) ?? {}) : {}) as Record<string, unknown>
    for (const zone of Object.keys(paths)) {
      if (out[zone]?.length) continue
      const first = spot(at(list(paths[zone])[0], 1))
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

/**
 * The pins that are there whatever the character does: every NPC with a service to offer, on each
 * place it stands, and every vein of ore and every herb.
 */
export function fixedPins(db: Questie): FixedPin[] {
  const pins: FixedPin[] = []
  const add = (kind: 'Npc' | 'Object', id: number, pin: Omit<FixedPin, 'area' | 'x' | 'y'>): void => {
    for (const [area, spots] of Object.entries(db.places(kind, id))) for (const [x, y] of spots) pins.push({ area: +area, x, y, ...pin })
  }
  for (const id of db.ids.Npc) {
    const flags = db.get('Npc', id, NPC.flags), side = db.get('Npc', id, NPC.friendly), name = db.get('Npc', id, NPC.name), sub = db.get('Npc', id, NPC.sub)
    const layers = typeof flags === 'number' ? servicesOf(flags) : []
    // Someone friendly to no side serves no player.
    if (!layers.length || typeof side !== 'string' || !side || typeof name !== 'string') continue
    add('Npc', id, { name, ...(typeof sub === 'string' && sub ? { sub } : {}), layers, side })
  }
  for (const id of db.ids.Object) {
    const name = db.get('Object', id, OBJECT.name), layer = typeof name === 'string' ? resourceOf(name) : null
    if (layer) add('Object', id, { name: name as string, layers: [layer] })
  }
  return pins
}

/**
 * The pins of what Questie shows, on every zone: where each quest on offer is taken, where a
 * finished one is handed in, where what is still to find is. No rule of its own about which
 * quests: that is Questie's, and comes with `shown`.
 */
export function questPins(db: Questie, shown: QuestieShown): QuestPin[] {
  const pins = new Map<string, QuestPin>()
  const text = (v: unknown, or: string): string => (typeof v === 'string' && v ? v : or)
  const add = (type: QuestPinType, area: string, x: number, y: number, name: string, quest: string): void => {
    const key = `${type}:${area}:${x}:${y}:${name}`
    const pin = pins.get(key)
    if (!pin) pins.set(key, { type, area: +area, x, y, name, quests: [quest] })
    else if (!pin.quests.includes(quest)) pin.quests.push(quest)
  }
  const at1 = (kind: 'Npc' | 'Object', id: unknown, type: QuestPinType, quest: string): void => {
    if (typeof id !== 'number') return
    const name = text(db.get(kind, id, kind === 'Npc' ? NPC.name : OBJECT.name), kind === 'Npc' ? 'Someone' : 'Something')
    for (const [area, spots] of Object.entries(db.places(kind, id))) for (const [x, y] of spots) add(type, area, x, y, name, quest)
  }
  // A list of QuestieDB's: creatures first, objects second.
  const both = (t: unknown, type: QuestPinType, quest: string): void => {
    for (const id of list(at(t, 1))) at1('Npc', id, type, quest)
    for (const id of list(at(t, 2))) at1('Object', id, type, quest)
  }

  for (const id of shown.available) {
    const level = db.get('Quest', id, QUEST.level)
    const quest = (typeof level === 'number' && level > 0 ? `[${level}] ` : '') + text(db.get('Quest', id, QUEST.name), `Quest ${id}`)
    const starters = db.get('Quest', id, QUEST.startedBy)
    both(starters, 'available', quest)
    // A quest that starts from a thing: whoever drops it, whatever holds it.
    for (const item of shown.items ? list(at(starters, 3)) : []) {
      if (typeof item !== 'number') continue
      for (const npc of list(db.get('Item', item, ITEM.npcDrops))) at1('Npc', npc, 'available', quest)
      for (const object of list(db.get('Item', item, ITEM.objectDrops))) at1('Object', object, 'available', quest)
    }
  }

  for (const active of shown.active) {
    const quest = text(db.get('Quest', active.id, QUEST.name), `Quest ${active.id}`)
    if (active.done) both(db.get('Quest', active.id, QUEST.finishedBy), 'turnin', quest)
    for (const target of active.targets) {
      const m = /^([mo])_(\d+)$/.exec(target)
      if (m) at1(m[1] === 'm' ? 'Npc' : 'Object', +m[2]!, 'objective', quest)
    }
    if (!active.event) continue
    // Places where something is to be done: the end of an escort, a spot to scout.
    const areas = [at(db.get('Quest', active.id, QUEST.triggerEnd), 2), ...list(db.get('Quest', active.id, QUEST.extra)).map((e) => at(e, 1))]
    for (const places of areas) {
      if (!places || typeof places !== 'object') continue
      for (const [area, spots] of Object.entries(places)) {
        for (const p of list(spots)) {
          const x = at(p, 1), y = at(p, 2)
          if (typeof x === 'number' && typeof y === 'number' && x > 0) add('objective', area, x, y, quest, quest)
        }
      }
    }
  }
  return [...pins.values()]
}
