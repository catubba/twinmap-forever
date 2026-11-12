// The place of the character inside a dungeon or a raid, from the minimap on the screen
// (shared/minimap.ts says how). This file builds the pictures of a dungeon the minimap is compared
// with from what the converter kept (its rooms level by level, and its open ground), and follows
// the character on them while the addon says it is inside.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import type { Position } from '../shared/game'
import { inPiece, roomPixels, type Interiors, type Piece } from '../shared/inside'
import { facingOf, levelsOf, locate, readsMinimap, SURE, widthsOf, type Box, type Found, type Levels, type Mosaic } from '../shared/minimap'
import { pictureOfBlock } from '../shared/pixels'
import { BLOCK_YARDS } from '../shared/world'
import { INTERIORS_FILE } from './interiors'

const AROUND = 160 // yards of nothing kept around the rooms: the minimap sees that far past the last wall
const PIXELS_PER_YARD = 2 // of a room's picture
const MOST_GROUND = 36e6 // square yards of open ground kept as a picture: more is a whole land, not a dungeon

/** The rooms of a dungeon laid on one grey picture, a pixel a yard, each turned as its building stands. */
export function mosaicOfPieces(pieces: Piece[], pictureOf: (file: number) => Uint8Array | null): Mosaic | null {
  if (!pieces.length) return null
  const reach = (p: Piece): number => Math.hypot(p.width, p.height) / 2
  const u0 = Math.floor(Math.min(...pieces.map((p) => p.u - reach(p)))) - AROUND, v0 = Math.floor(Math.min(...pieces.map((p) => p.v - reach(p)))) - AROUND
  const width = Math.ceil(Math.max(...pieces.map((p) => p.u + reach(p)))) + AROUND - u0, height = Math.ceil(Math.max(...pieces.map((p) => p.v + reach(p)))) + AROUND - v0
  const grey = new Uint8Array(width * height) // a byte a yard: a big dungeon has several of these pictures
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
        if (rgba[i + 3]) grey[(v - v0) * width + (u - u0)] = Math.round(rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114)
      }
    }
  }
  return { u0, v0, width, height, grey }
}

/**
 * The open ground of a dungeon on one grey picture, a pixel a yard: what the minimap shows where
 * the character is under no roof (the streets of a city, a jungle, a courtyard). blocks: the blocks
 * of the map that have a picture, by column and row. pictureOf: red, green, blue of a block, square.
 */
export function mosaicOfGround(blocks: [number, number][], pictureOf: (column: number, row: number) => Uint8Array | null): Mosaic | null {
  if (!blocks.length) return null
  const c0 = Math.min(...blocks.map((b) => b[0])), r0 = Math.min(...blocks.map((b) => b[1]))
  const u0 = Math.floor(c0 * BLOCK_YARDS), v0 = Math.floor(r0 * BLOCK_YARDS)
  const width = Math.ceil((Math.max(...blocks.map((b) => b[0])) + 1) * BLOCK_YARDS) - u0, height = Math.ceil((Math.max(...blocks.map((b) => b[1])) + 1) * BLOCK_YARDS) - v0
  if (width * height > MOST_GROUND) return null
  const grey = new Uint8Array(width * height)
  for (const [column, row] of blocks) {
    const rgb = pictureOf(column, row)
    if (!rgb) continue
    const size = Math.sqrt(rgb.length / 3), per = size / BLOCK_YARDS
    const left = Math.ceil(column * BLOCK_YARDS), top = Math.ceil(row * BLOCK_YARDS)
    for (let v = top; v < (row + 1) * BLOCK_YARDS; v++) {
      for (let u = left; u < (column + 1) * BLOCK_YARDS; u++) {
        const i = (Math.min(size - 1, Math.floor((v + 0.5 - row * BLOCK_YARDS) * per)) * size + Math.min(size - 1, Math.floor((u + 0.5 - column * BLOCK_YARDS) * per))) * 3
        grey[(v - v0) * width + (u - u0)] = Math.round(rgb[i]! * 0.299 + rgb[i + 1]! * 0.587 + rgb[i + 2]! * 0.114)
      }
    }
  }
  return { u0, v0, width, height, grey }
}

/**
 * The pictures of a dungeon by its number, from the folder of the build. One for each of its
 * levels, the rooms up to that level laid on it (a room is a level up when it lies over another):
 * under a roof the minimap shows the rooms of the level the character is on, on black, so the
 * picture it is most like tells the level. And one of its open ground, when it has any: in the
 * open the minimap shows that, and no rooms. None when the converter kept nothing of the dungeon.
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
  const out: Mosaic[] = []
  if (map.pieces.length) {
    const top = Math.max(0, ...map.pieces.map((p) => p.level))
    for (let level = 0; level <= top; level++) {
      const mosaic = mosaicOfPieces(map.pieces.filter((p) => p.level <= level), pictureOf)
      if (mosaic) out.push({ ...mosaic, level: top > 0 ? level : undefined })
    }
  }
  if (map.ground) {
    try {
      const at = join(folder, map.ground, 'blocks'), blocks: [number, number][] = []
      for (const column of readdirSync(at)) for (const row of readdirSync(join(at, column))) if (row.endsWith('.dxt')) blocks.push([Number(column), Number(row.slice(0, -4))])
      const ground = mosaicOfGround(blocks, (column, row) => {
        try {
          return pictureOfBlock(inflateSync(readFileSync(join(at, String(column), `${row}.dxt`))))
        } catch {
          return null
        }
      })
      if (ground) out.push({ ...ground, open: true })
    } catch {
      // no folder of blocks: the dungeon is followed under its roofs only
    }
  }
  return out
}

const EVERY = 500 // ms between two looks at the minimap
const LOST_FOR = 2000 // ms between two looks through the whole dungeon while the place is not known
const KEPT = 3000 // ms a place found is still shown without a newer one
const RUNNING = 2 // yards between two looks that tell the character is running
const CLEARLY = 0.01 // how much more like another picture the minimap must be before the character is said to be on it

/** Where the character is inside, in yards of the dungeon's pieces, and which way it faces (degrees clockwise from north, when the arrow is seen). */
export interface Inside {
  u: number
  v: number
  facing?: number
  /** The level the character is on, from 0, in a dungeon with rooms over rooms; missing in one with a single level, and in the open. */
  level?: number
}

/** What the last look at the minimap came to, for whoever has to find out why the arrow is not there: written with the measures of the link. */
export interface InsideReport {
  dungeon: number
  /** Pictures of the dungeon the app has: one a level and one of the open ground; none when the converter kept nothing of it. */
  pictures: number
  /** Why no place is told, when none is: the addon tells no minimap, it turns with the character, its zoom is not one known, no pictures, or none is like it enough. */
  why?: 'no minimap told' | 'minimap turns' | 'zoom not known' | 'no rooms' | 'screen not read' | 'not sure'
  zoom?: number
  size?: number
  /** The yards across the minimap that were tried. */
  widths?: number[]
  /** How like the minimap each picture is, 0 to 1, at the width that fits it best; a place is told from `SURE` up. */
  scores?: (number | null)[]
  /** The picture taken, the width it was read at, and the level it tells. */
  picture?: number
  across?: number
  level?: number
  /** Milliseconds since a place was last found. */
  lostFor?: number
}

/**
 * Follows the character inside dungeons. look() is called with the latest position the addon sent
 * and a way to cut a square from the game's window; it reads the screen only while the addon says
 * the character is inside (readsMinimap), and gives the place found, or null.
 *
 * What the minimap shows changes as the character goes: another level, out from under a roof into
 * the open, and with that how many yards it shows across. So every picture is tried at every width
 * it may have, around the place of a moment ago; the one of a moment ago stays unless another is
 * clearly more like. With no place known the whole dungeon is looked through, one picture at one
 * width each time (half a second of work each: all at once would stop the reading of the strip).
 */
export function startInside(tilesFolder: () => string | null, mosaics: (folder: string, id: number) => Mosaic[] = mosaicsOf): { report: () => { report: InsideReport; seen: Box | null } | null; look: (pos: Position | undefined, cut: (x: number, y: number, size: number) => Box | null, now: number) => Inside | null } {
  let dungeon = 0, floors: Levels[] = []
  let last: (Inside & { at: number; picture: number; across: number }) | null = null
  let lookedAt = 0, searchedAt = 0, lostTries = 0
  let report: InsideReport | null = null, seen: Box | null = null, foundAt = 0
  return {
    report: () => report && { report, seen },
    look(pos, cut, now) {
      const mini = readsMinimap(pos)
      // Inside a dungeon or a raid with no minimap to read: said, so that a missing arrow has its reason.
      const told = pos?.inst?.mini
      if (!mini && pos?.inst && (pos.inst.kind === 'party' || pos.inst.kind === 'raid')) report = { dungeon: pos.inst.id, pictures: floors.length, why: !told ? 'no minimap told' : told.turns ? 'minimap turns' : 'zoom not known', zoom: told?.zoom, size: told?.size }
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
      const widths = widthsOf(mini)
      const said = { dungeon, pictures: floors.length, zoom: mini.zoom, size: mini.size, widths, lostFor: foundAt ? now - foundAt : undefined }
      if (!floors.length) return (report = { ...said, why: 'no rooms' }), null
      const known = last && now - last.at <= KEPT ? last : null
      if (!known && now - searchedAt < LOST_FOR) return null
      const half = Math.round(mini.size / 2), box = cut(Math.round(mini.x) - half, Math.round(mini.y) - half, half * 2)
      if (!box) return (report = { ...said, why: 'screen not read' }), fresh()
      seen = box
      if (!known) searchedAt = now
      // With no place known: the whole dungeon on one picture at one width, the next of them at the next try.
      // The picture with every room first, then down the levels, then the open ground; all of them at the width the
      // addon tells before any at the ones from the tables.
      let around: { u: number; v: number } | null = known
      if (!around) {
        const turn = lostTries++ % (floors.length * widths.length), rooms = floors.filter((f) => !f.mosaic.open).length
        const order = [...floors.keys()].sort((a, b) => (a < rooms ? rooms - 1 - a : a) - (b < rooms ? rooms - 1 - b : b))
        around = locate(floors[order[turn % floors.length]!]!, box, mini.zoom, undefined, widths[Math.floor(turn / floors.length)])
      }
      if (!around) return (report = { ...said, why: 'not sure' }), fresh()
      // Every picture at every width, around that place.
      let found: Found | null = null, picture = -1, across = 0
      const scores: (number | null)[] = floors.map(() => null)
      let before: Found | null = null
      // While the picture and the width of a moment ago still fit, only what may change by a step is tried: the
      // other levels at that width. Each try is a few milliseconds the reading of the strip waits for.
      const still = known ? locate(floors[known.picture]!, box, mini.zoom, around, known.across) : null
      const steady = known && still && still.score >= SURE ? known : null
      floors.forEach((levels, i) => {
        if (steady && i !== steady.picture && (levels.mosaic.open || floors[steady.picture]!.mosaic.open)) return
        for (const width of steady ? [steady.across] : widths) {
          const here = i === steady?.picture ? still : locate(levels, box, mini.zoom, around!, width)
          if (!here) continue
          if (scores[i] === null || here.score > scores[i]!) scores[i] = Math.round(here.score * 1000) / 1000
          if (i === known?.picture && width === known.across) before = here
          // Alike on several: the last of them, which among the levels is the one with every room on show.
          if (!found || here.score >= found.score) (found = here), (picture = i), (across = width)
        }
      })
      // The picture and the width of a moment ago stay unless another is clearly more like the minimap.
      if (known && before && found && (before as Found).score >= (found as Found).score - CLEARLY) (found = before), (picture = known.picture), (across = known.across)
      if (!found || (found as Found).score < SURE) return (report = { ...said, why: 'not sure', scores }), fresh()
      const place = found as Found
      // Running, the way the place moved is the surest facing; standing, the arrow of the minimap
      // says it (the dots of a party over the arrow can hide its point: then the last facing stays).
      const du = known ? place.u - known.u : 0, dv = known ? place.v - known.v : 0
      const facing = Math.hypot(du, dv) >= RUNNING ? ((Math.atan2(du, -dv) * 180) / Math.PI + 360) % 360 : (facingOf(box) ?? last?.facing)
      // In the open no level is told: the map keeps the one it shows.
      const level = floors[picture]!.mosaic.level
      last = { u: place.u, v: place.v, facing, at: now, level, picture, across }
      lostTries = 0
      foundAt = now
      report = { ...said, scores, picture, across, level, lostFor: 0 }
      return fresh()
    },
  }
}
