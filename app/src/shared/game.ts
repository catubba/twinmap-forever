// What the app knows about the character and about its link with the game: the one place.
// It is fed the readings of the strip, one after the other, and nothing else changes it.
import { PROTOCOL, type Reading } from './strip'

/** Where the character is. Every field is missing when the game does not tell. */
export interface Position {
  zone?: string
  sub?: string
  /** The game's id of the zone map. */
  map?: number
  /** Percent of the zone map, 0 to 100. */
  x?: number
  y?: number
  /** Degrees, anticlockwise from north. */
  facing?: number
  /** True under a roof: in a cave, a mine, a house. Missing in the open. */
  indoors?: boolean
  /** The dungeon, raid or battleground the character is inside; missing in the open world. */
  inst?: Instance
  /** True in a fight: only the position comes through, the rest waits for its end. */
  combat?: boolean
}

/** Level and experience. At the level cap the game tells no experience. */
export interface Character {
  level: number
  xp?: number
  /** Experience this level takes. */
  max?: number
  /** Rested experience still to spend. */
  rested?: number
}

export interface Instance {
  /** The game's number of the instance: the same as of its map in the game's files. */
  id: number
  /** As the game names it, in the player's language. */
  name?: string
  /** "party", "raid", "pvp". */
  kind?: string
  /** Where the character is, in yards of the world: x to the north, y to the west. Missing when the game does not tell addons. */
  x?: number
  y?: number
}

export interface ProtocolMismatch {
  addon: number
  app: number
  /** Which of the two is behind. */
  update: 'app' | 'addon'
  message: string
}

export interface GameState {
  /** The latest data of each section the addon sent, by name. */
  sections: { pos?: Position; char?: Character; [name: string]: unknown }
  /** When each section last arrived whole, in milliseconds. */
  updatedAt: Record<string, number>
  /** Set while the addon speaks a protocol this app does not. */
  protocol: ProtocolMismatch | null
  /** Blocks read, blocks that went by unseen, and strips seen but unreadable. */
  blocks: number
  lost: number
  corrupt: number
}

// One odd reading can be a strip caught halfway through a redraw: its protocol byte is not
// covered by anything we can check. Believe it when it comes this many times in a row.
const MISMATCH_AFTER = 3

export function protocolMismatch(addon: number): ProtocolMismatch {
  const update = addon > PROTOCOL ? 'app' : 'addon'
  const message =
    update === 'app'
      ? `The Twinmap Forever addon is newer than this app (protocol ${addon}, this app speaks ${PROTOCOL}). Update Twinmap.`
      : `The Twinmap Forever addon is older than this app (protocol ${addon}, this app speaks ${PROTOCOL}). Update the addon.`
  return { addon, app: PROTOCOL, update, message }
}

export function createGame(): { state: GameState; feed: (reading: Reading, now?: number) => void } {
  const state: GameState = { sections: {}, updatedAt: {}, protocol: null, blocks: 0, lost: 0, corrupt: 0 }
  const pending = new Map<string, { version: number; parts: Map<number, string> }>()
  let lastId: number | null = null
  let lastKey = ''
  let foreign = { protocol: -1, times: 0 }

  function feed(reading: Reading, now = Date.now()): void {
    if (reading.kind === 'none') return
    if (reading.kind === 'corrupt') {
      state.corrupt++
      return
    }
    if (reading.kind === 'protocol') {
      foreign = { protocol: reading.protocol, times: foreign.protocol === reading.protocol ? foreign.times + 1 : 1 }
      if (foreign.times >= MISMATCH_AFTER) state.protocol = protocolMismatch(reading.protocol)
      return
    }
    foreign = { protocol: -1, times: 0 }
    state.protocol = null

    // The same block is read many times while it is up, and once more in negative.
    const key = `${reading.id}:${reading.section}:${reading.version}:${reading.part}:${reading.text}`
    if (key === lastKey) return
    lastKey = key
    state.blocks++
    // The number restarts when the game's interface reloads: going down is not a loss.
    if (lastId !== null && reading.id > lastId) state.lost += reading.id - lastId - 1
    lastId = reading.id

    let section = pending.get(reading.section)
    if (!section || section.version !== reading.version) {
      section = { version: reading.version, parts: new Map() }
      pending.set(reading.section, section)
    }
    section.parts.set(reading.part, reading.text)
    if (section.parts.size < reading.total) return
    pending.delete(reading.section)

    let json = ''
    for (let part = 1; part <= reading.total; part++) json += section.parts.get(part) ?? ''
    try {
      const data: unknown = JSON.parse(json)
      if (typeof data !== 'object' || data === null) throw new Error('not an object')
      state.sections[reading.section] = data
      state.updatedAt[reading.section] = now
    } catch {
      state.corrupt++ // every block passed its checksum, yet the whole does not read: parts of two versions
    }
  }

  return { state, feed }
}
