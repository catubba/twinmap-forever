// The place of the character inside a dungeon or a raid, from the minimap on the screen
// (shared/minimap.ts says how). This file builds the one picture of the rooms of a dungeon from
// what the converter kept, and follows the character on it while the addon says it is inside.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import type { Position } from '../shared/game'
import { inPiece, roomPixels, type Interiors, type Piece } from '../shared/inside'
import { facingOf, levelsOf, locate, readsMinimap, SURE, type Box, type Levels, type Mosaic } from '../shared/minimap'
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

/** The same for a dungeon by its number, from the folder of the build; null when the converter kept none of it. */
export function mosaicOf(folder: string, id: number): Mosaic | null {
  const file = join(folder, INTERIORS_FILE)
  if (!existsSync(file)) return null
  const map = (JSON.parse(readFileSync(file, 'utf8')) as Interiors).maps.find((m) => m.id === id && m.kind !== 'world')
  if (!map) return null
  return mosaicOfPieces(map.pieces, (picture) => {
    try {
      return inflateSync(readFileSync(join(folder, 'rooms', `${picture}.dxt`)))
    } catch {
      return null // a picture that is not there leaves its room empty
    }
  })
}

const EVERY = 500 // ms between two looks at the minimap
const LOST_FOR = 2000 // ms between two looks through the whole dungeon while the place is not known
const KEPT = 3000 // ms a place found is still shown without a newer one
const RUNNING = 2 // yards between two looks that tell the character is running

/** Where the character is inside, in yards of the dungeon's pieces, and which way it faces (degrees clockwise from north, when the arrow is seen). */
export interface Inside {
  u: number
  v: number
  facing?: number
}

/**
 * Follows the character inside dungeons. look() is called with the latest position the addon sent
 * and a way to cut a square from the game's window; it reads the screen only while the addon says
 * the character is inside (readsMinimap), and gives the place found, or null.
 */
export function startInside(tilesFolder: () => string | null): { look: (pos: Position | undefined, cut: (x: number, y: number, size: number) => Box | null, now: number) => Inside | null } {
  let dungeon = 0, levels: Levels | null = null
  let last: (Inside & { at: number }) | null = null
  let lookedAt = 0, searchedAt = 0
  return {
    look(pos, cut, now) {
      const mini = readsMinimap(pos)
      if (!mini || !pos?.inst) {
        // Outside: nothing is read, and what was known of the last dungeon is let go.
        dungeon = 0
        levels = last = null
        return null
      }
      const fresh = (): Inside | null => (last && now - last.at <= KEPT ? { u: last.u, v: last.v, facing: last.facing } : null)
      if (now - lookedAt < EVERY) return fresh()
      lookedAt = now
      if (pos.inst.id !== dungeon) {
        dungeon = pos.inst.id
        last = null
        const folder = tilesFolder(), mosaic = folder ? mosaicOf(folder, dungeon) : null
        levels = mosaic && levelsOf(mosaic)
      }
      if (!levels) return null
      const known = last && now - last.at <= KEPT ? last : null
      if (!known && now - searchedAt < LOST_FOR) return null
      const half = Math.round(mini.size / 2), box = cut(Math.round(mini.x) - half, Math.round(mini.y) - half, half * 2)
      if (!box) return fresh()
      if (!known) searchedAt = now
      const found = locate(levels, box, mini.zoom, known ?? undefined)
      if (!found || found.score < SURE) return fresh()
      // Running, the way the place moved is the surest facing; standing, the arrow of the minimap
      // says it (the dots of a party over the arrow can hide its point: then the last facing stays).
      const du = known ? found.u - known.u : 0, dv = known ? found.v - known.v : 0
      const facing = Math.hypot(du, dv) >= RUNNING ? ((Math.atan2(du, -dv) * 180) / Math.PI + 360) % 360 : (facingOf(box) ?? last?.facing)
      last = { u: found.u, v: found.v, facing, at: now }
      return fresh()
    },
  }
}
