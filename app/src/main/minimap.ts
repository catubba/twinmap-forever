// The place of the character inside a dungeon or a raid, from the minimap on the screen
// (shared/minimap.ts says how). This file builds the one picture of the rooms of a dungeon from
// what the converter kept, and follows the character on it while the addon says it is inside.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import type { Position } from '../shared/game'
import { inPiece, roomPixels, type Interiors, type Piece } from '../shared/inside'
import { facingOf, levelsOf, locate, readsMinimap, SURE, type Box, type Found, type Levels, type Mosaic } from '../shared/minimap'
import { INTERIORS_FILE } from './interiors'

const AROUND = 160 // yards of nothing kept around the rooms: the minimap sees that far past the last wall
const PIXELS_PER_YARD = 2 // of a room's picture

/** The rooms of a dungeon laid on one grey picture, a pixel a yard, each turned as its building stands. */
export function mosaicOfPieces(pieces: Piece[], pictureOf: (file: number) => Uint8Array | null): Mosaic | null {
  if (!pieces.length) return null
  const reach = (p: Piece): number => Math.hypot(p.width, p.height) / 2
  const u0 = Math.floor(Math.min(...pieces.map((p) => p.u - reach(p)))) - AROUND, v0 = Math.floor(Math.min(...pieces.map((p) => p.v - reach(p)))) - AROUND
  const width = Math.ceil(Math.max(...pieces.map((p) => p.u + reach(p)))) + AROUND - u0, height = Math.ceil(Math.max(...pieces.map((p) => p.v + reach(p)))) + AROUND - v0
  const grey = new Float32Array(width * height)
  for (const p of pieces) {
    const dxt = pictureOf(p.file)
    if (!dxt) continue
    const w = Math.round(p.width * PIXELS_PER_YARD), h = Math.round(p.height * PIXELS_PER_YARD), rgba = roomPixels(dxt, w, h)
    const r = Math.ceil(reach(p)) + 1
    for (let v = Math.floor(p.v) - r; v < Math.floor(p.v) + r; v++) {
      for (let u = Math.floor(p.u) - r; u < Math.floor(p.u) + r; u++) {
        const in_ = inPiece(p, u + 0.5, v + 0.5)
        if (!in_) continue
        const i = (Math.min(h - 1, Math.floor(in_[1] * PIXELS_PER_YARD)) * w + Math.min(w - 1, Math.floor(in_[0] * PIXELS_PER_YARD))) * 4
        if (rgba[i + 3]) grey[(v - v0) * width + (u - u0)] = rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114
      }
    }
  }
  return { u0, v0, width, height, grey }
}

/**
 * The same for a dungeon by its number, from the folder of the build: one picture for each of its
 * levels, the rooms up to that level laid on it (a room is a level up when it lies over another).
 * The minimap of the game shows the rooms of the level the character is on, so the picture it is
 * most like tells the level. None when the converter kept nothing of the dungeon.
 */
export function mosaicsOf(folder: string, id: number): Mosaic[] {
  const file = join(folder, INTERIORS_FILE)
  if (!existsSync(file)) return []
  const map = (JSON.parse(readFileSync(file, 'utf8')) as Interiors).maps.find((m) => m.id === id && m.kind !== 'world')
  if (!map) return []
  const pictures = new Map<number, Uint8Array | null>()
  const pictureOf = (picture: number): Uint8Array | null => {
    if (!pictures.has(picture)) {
      try {
        pictures.set(picture, inflateSync(readFileSync(join(folder, 'rooms', `${picture}.dxt`))))
      } catch {
        pictures.set(picture, null) // a picture that is not there leaves its room empty
      }
    }
    return pictures.get(picture)!
  }
  const top = Math.max(0, ...map.pieces.map((p) => p.level)), out: Mosaic[] = []
  for (let level = 0; level <= top; level++) {
    const mosaic = mosaicOfPieces(map.pieces.filter((p) => p.level <= level), pictureOf)
    if (!mosaic) return []
    out.push(mosaic)
  }
  return out
}

const EVERY = 500 // ms between two looks at the minimap
const LOST_FOR = 2000 // ms between two looks through the whole dungeon while the place is not known
const KEPT = 3000 // ms a place found is still shown without a newer one
const RUNNING = 2 // yards between two looks that tell the character is running
const CLEARLY = 0.01 // how much more like another level the minimap must be before the character is said to have changed level

/** Where the character is inside, in yards of the dungeon's pieces, and which way it faces (degrees clockwise from north, when the arrow is seen). */
export interface Inside {
  u: number
  v: number
  facing?: number
  /** The level the character is on, from 0, in a dungeon with rooms over rooms; missing in one with a single level. */
  level?: number
}

/** What the last look at the minimap came to, for whoever has to find out why the arrow is not there: written with the measures of the link. */
export interface InsideReport {
  dungeon: number
  /** Pictures of the dungeon the app has: one a level, none when the converter kept no rooms of it. */
  levels: number
  /** Why no place is told, when none is: the addon tells no minimap, it turns with the character, its zoom is not one known, no rooms, or no picture is like it enough. */
  why?: 'no minimap told' | 'minimap turns' | 'zoom not known' | 'no rooms' | 'screen not read' | 'not sure'
  zoom?: number
  size?: number
  /** How like the minimap each level is, 0 to 1, where they were tried; a place is told from `SURE` up. */
  scores?: (number | null)[]
  level?: number
  /** Milliseconds since a place was last found. */
  lostFor?: number
}

/**
 * Follows the character inside dungeons. look() is called with the latest position the addon sent
 * and a way to cut a square from the game's window; it reads the screen only while the addon says
 * the character is inside (readsMinimap), and gives the place found, or null.
 */
export function startInside(tilesFolder: () => string | null, mosaics: (folder: string, id: number) => Mosaic[] = mosaicsOf): { report: () => { report: InsideReport; seen: Box | null } | null; look: (pos: Position | undefined, cut: (x: number, y: number, size: number) => Box | null, now: number) => Inside | null } {
  let dungeon = 0, floors: Levels[] = []
  let last: (Inside & { at: number }) | null = null
  let lookedAt = 0, searchedAt = 0, lostTries = 0
  let report: InsideReport | null = null, seen: Box | null = null, foundAt = 0
  return {
    report: () => report && { report, seen },
    look(pos, cut, now) {
      const mini = readsMinimap(pos)
      // Inside a dungeon or a raid with no minimap to read: said, so that a missing arrow has its reason.
      const told = pos?.inst?.mini
      if (!mini && pos?.inst && (pos.inst.kind === 'party' || pos.inst.kind === 'raid')) report = { dungeon: pos.inst.id, levels: floors.length, why: !told ? 'no minimap told' : told.turns ? 'minimap turns' : 'zoom not known', zoom: told?.zoom, size: told?.size }
      else if (!mini) report = null
      if (!mini || !pos?.inst) {
        // Outside: nothing is read, and what was known of the last dungeon is let go.
        dungeon = 0
        floors = []
        last = null
        return null
      }
      const fresh = (): Inside | null => (last && now - last.at <= KEPT ? { u: last.u, v: last.v, facing: last.facing, level: last.level } : null)
      if (now - lookedAt < EVERY) return fresh()
      lookedAt = now
      if (pos.inst.id !== dungeon) {
        dungeon = pos.inst.id
        last = null
        const folder = tilesFolder()
        floors = (folder ? mosaics(folder, dungeon) : []).map(levelsOf)
      }
      const said = { dungeon, levels: floors.length, zoom: mini.zoom, size: mini.size, lostFor: foundAt ? now - foundAt : undefined }
      if (!floors.length) return (report = { ...said, why: 'no rooms' }), null
      const known = last && now - last.at <= KEPT ? last : null
      if (!known && now - searchedAt < LOST_FOR) return null
      const half = Math.round(mini.size / 2), box = cut(Math.round(mini.x) - half, Math.round(mini.y) - half, half * 2)
      if (!box) return (report = { ...said, why: 'screen not read' }), fresh()
      seen = box
      if (!known) searchedAt = now
      // Each level is tried: the one the minimap is most like is the one the character is on. Where no room
      // lies over another the levels look the same, and the one of a moment ago stays.
      // With no place known the whole dungeon is looked through on one level only (half a second of work on each
      // would stop the reading of the strip): the picture with every room first, the next level down at the next
      // try. The levels are then tried around what it finds.
      const around = known ?? locate(floors[floors.length - 1 - (lostTries++ % floors.length)]!, box, mini.zoom)
      if (!around) return (report = { ...said, why: 'not sure' }), fresh()
      const tries = floors.map((levels) => locate(levels, box, mini.zoom, around))
      let level = -1
      // Alike on every level: the top one, with every room on show.
      tries.forEach((t, i) => {
        if (t && (level < 0 || t.score >= tries[level]!.score)) level = i
      })
      // The level of a moment ago stays unless another is clearly more like the minimap.
      const before = known?.level
      if (before !== undefined && level >= 0 && tries[before] && tries[before].score >= tries[level]!.score - CLEARLY) level = before
      const found: Found | null = level < 0 ? null : tries[level]!
      const scores = tries.map((t) => (t ? Math.round(t.score * 1000) / 1000 : null))
      if (!found || found.score < SURE) return (report = { ...said, why: 'not sure', scores }), fresh()
      foundAt = now
      report = { ...said, scores, level, lostFor: 0 }
      // Running, the way the place moved is the surest facing; standing, the arrow of the minimap
      // says it (the dots of a party over the arrow can hide its point: then the last facing stays).
      const du = known ? found.u - known.u : 0, dv = known ? found.v - known.v : 0
      const facing = Math.hypot(du, dv) >= RUNNING ? ((Math.atan2(du, -dv) * 180) / Math.PI + 360) % 360 : (facingOf(box) ?? last?.facing)
      last = { u: found.u, v: found.v, facing, at: now, level: floors.length > 1 ? level : undefined }
      lostTries = 0
      return fresh()
    },
  }
}
