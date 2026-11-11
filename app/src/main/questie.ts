// Reads the QuestieDB addon the player has installed: quests, NPCs, objects, items and where they
// are. Nothing of it is copied or shipped: without Questie the app has no such data and says so.
// QuestieDB keeps every entity in its .toc, as base64 CBOR, one metadata line per field.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { QuestieShown, QuestPin } from '../shared/quests'
import { resourceOf, servicesOf, type FixedPin } from '../shared/services'

/** The file of QuestieDB this app reads, in a game folder. Questie without it gives the app nothing. */
export const questieFile = (gameFolder: string): string => join(gameFolder, '_forever_', 'Interface', 'AddOns', 'QuestieDB', 'QuestieDB_Forever.toc')

// Field numbers, from QuestieDB's src/meta/*Meta.lua.
export const QUEST = { name: 1, startedBy: 2, finishedBy: 3, reqLevel: 4, level: 5 } as const
export const NPC = { name: 1, spawns: 7, waypoints: 8, friendly: 13, sub: 14, flags: 15 } as const
export const OBJECT = { name: 1, spawns: 4 } as const
export const ITEM = { npcDrops: 2, objectDrops: 3 } as const

const SAME_SPOT = 0.02 // percent of a zone's map: the addon rounds a place to a hundredth

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
      if (!pin) pins.set(key, { type, area: icon.area, x: icon.x, y: icon.y, name, quests: [quest] })
      else if (!pin.quests.includes(quest)) pin.quests.push(quest)
    }
  }
  return [...pins.values()]
}
