// The dungeons and raids in the 3D view (M23-F23; the prototype and its measures: design/ROADMAP.md, M23-F14). A
// dungeon's buildings, their liquids and the objects of their rooms are made the first time the view asks for its list,
// as the ground's own textures are (ground.ts): under a second each in the prototype, so not with the map, which has
// fifty of them. They are made as a continent's are (buildings.ts, props.ts), in the folder the dungeon's ground has
// (shared/buildings.ts, dungeonFolder), sharing the files and textures of the continents' buildings.
//
// A dungeon that has a ground (M23-F26; 38 of them, measured in design/dungeons3d/ground.ts) gets its heights and 3D
// tiles then too, as a continent has them (heights.ts): from 0.2 to 1.2 seconds each, 21 seconds and 53 MB for them
// all, so not with the map either. A block the game never painted (no texture of its own: the grey sheet over
// Deadmines, with its water) is left out, and a ground that is one level sheet is no ground (Scarlet Monastery;
// Razorfen Downs, Alcaz Prison and The Hall of Thanes have no painted block at all): those are made as the ones that
// are all buildings. What covers the rooms seen from above is left out too (M23-F28; measured in
// design/dungeons3d/cover.ts): a level sheet with a room of the 2D map wholly under it is a lid, not a place, be it a
// painted block all at one height (the grey slab over the hive of Ahn'Qiraj Temple, the only one of 1,090 blocks) or
// an object of the blocks (props.ts, isLid: the sheet over Deadmines). On a ground, only the buildings with rooms on the 2D map are drawn open, the others stand as on a continent; and the
// rooms that lie under the ground are listed, for the view to open the ground over them (inside3d.ts); and the ground
// round the buildings dug in rock is cut, seen from anywhere (M23-F30; shared/inside.ts, inRock and rockCut), with the
// objects that stand on it:
//   i<map>/under.json    { rule: ROCK_RULE, rooms }: of its pieces (interiors.json) those inside the ground, [index, floor,
//                        yards of ground over it, 1 in rock]
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dungeonFolder, type Placed } from '../shared/buildings'
import { groundTextures } from '../shared/ground'
import { blockHeights } from '../shared/heights'
import { DUNGEON_PINS } from '../shared/dungeon-pins'
import { inRock, lidOver, piecesIn, rockCut, roofOf, type Box, type Piece, type UnderRoom } from '../shared/inside'
import { MORE_BOSS_PINS } from '../shared/more-boss-pins'
import { NEW_DUNGEON_PINS } from '../shared/new-dungeon-pins'
import { PIN_HEIGHTS } from '../shared/pin-heights'
import type { Table } from '../shared/wdc5'
import { LIQUID_TYPE_FILE, liquidOfName, WATER } from '../shared/water'
import { BLOCK_YARDS, BLOCKS, groundFiles, terrainFiles } from '../shared/world'
import { buriedKey, FORMAT, makeBuildings, PLACED_FILE } from './buildings'
import { groundOf } from './caves'
import type { ClientFiles } from './client-files'
import { convertHeights } from './heights'
import { dungeonWorldFile, finishedInteriors, MAP_FILE, placedIn } from './interiors'
import { makeProps, PROPS_FILE } from './props'

export const UNDER_FILE = 'under.json'
/** Which rule told the rooms in rock (shared/inside.ts, inRock): a dungeon made with another is made again. 2: M23-F30 with ROCK_UNDER. */
export const ROCK_RULE = 2

/**
 * The dungeon a path asks something made here of, by the game's number of its map; null for any other path. Its list
 * of buildings, of objects, of rooms under the ground and the tiles of its ground all wait for the one making: the
 * view asks for them together, and would not ask again for a while.
 */
export function dungeonAsked(path: string): number | null {
  const m = /^\/i(\d{1,5})\/(?:(?:buildings|props|under)\.json|levels\/\d\/\d{1,2}\/\d{1,2}\.bin)$/.exec(path)
  return m ? Number(m[1]) : null
}

/**
 * The ground of a dungeon worth showing: the terrain files of its blocks that the game painted (a block with no
 * texture of its own is a sheet left there, not a place) and that are not a lid over its rooms (painted, yet all at
 * one level with a room of the 2D map wholly under it), or none when what is left is all at one level, which is what
 * the game leaves under a dungeon that is all buildings. rooms: the pieces of its 2D map.
 */
export function paintedGround(wdt: Buffer, read: (id: number) => Buffer | null, rooms: Piece[] = []): Set<number> {
  const textures = groundFiles(wdt), painted = new Set<number>()
  let low = Infinity, high = -Infinity
  for (const [block, file] of terrainFiles(wdt)) {
    const tex0 = read(textures.get(block) ?? 0)
    if (!tex0 || !groundTextures(tex0).length) continue
    const column = block % BLOCKS, row = Math.floor(block / BLOCKS)
    const box: Box = [column * BLOCK_YARDS, row * BLOCK_YARDS, (column + 1) * BLOCK_YARDS, (row + 1) * BLOCK_YARDS]
    // its heights are read only where they decide something: while all so far is one level, or with rooms in its square
    if (high - low <= 1 || piecesIn(rooms, box).length) {
      const adt = read(file), heights = adt && blockHeights(adt, column, row)
      let from = Infinity, to = -Infinity
      for (const h of heights ?? []) if (!Number.isNaN(h)) ((from = Math.min(from, h)), (to = Math.max(to, h)))
      if (to - from <= 1 && lidOver(rooms, box, from)) continue
      ;((low = Math.min(low, from)), (high = Math.max(high, to)))
    }
    painted.add(file)
  }
  return high - low > 1 ? painted : new Set()
}

/** The bosses of a dungeon where the pins put them: u, v and how high where that is known. */
export function bossesOf(map: number): [number, number, number?][] {
  const high = PIN_HEIGHTS[map] ?? {}
  return [...[...DUNGEON_PINS, ...NEW_DUNGEON_PINS].filter((d) => d.map === map).flatMap((d) => d.bosses), ...MORE_BOSS_PINS.filter(([m]) => m === map).map(([, name, u, v]): [string, number, number] => [name, u, v])].map(([name, u, v]) => [u, v, high[name]])
}

/**
 * Makes the ground, the buildings and the objects of a dungeon where the folder does not have them yet: true when its
 * list is there after. files: the game's archive, opened when first needed; table: a table of the game from its file.
 */
export function dungeonMaker(files: () => ClientFiles, folder: string, table: (b: Buffer) => Table): (map: number) => boolean {
  // a file the server has sent no key for is one the view does without
  const read = (id: number): Buffer | null => {
    try {
      return id ? files().read(id) : null
    } catch {
      return null
    }
  }
  let maps: Table | undefined, liquids: Map<number, number> | undefined
  const made = new Set<number>() // a tile the ground has none of is asked for again and again
  return (map) => {
    try {
      if (made.has(map)) return true
      const name = dungeonFolder(map), list = join(folder, name, PLACED_FILE)
      // a list of another format is of buildings made again since, for the continents: its files are gone; and so
      // with its objects, whose list goes when they are made in another format (props.ts)
      // and one whose rooms in rock were told by another rule, or not at all (an under.json of rooms only)
      const done = (): boolean => {
        try {
          if ((JSON.parse(readFileSync(list, 'utf8')) as Placed).format !== FORMAT || !existsSync(join(folder, name, PROPS_FILE))) return false
          const under = join(folder, name, UNDER_FILE)
          if (existsSync(under) && (JSON.parse(readFileSync(under, 'utf8')) as { rule?: number }).rule !== ROCK_RULE) return false
          made.add(map)
          return true
        } catch {
          return false
        }
      }
      if (done()) return true
      // the table of maps has parts the game keeps locked: read around them, as the map is made (tiles-worker.ts)
      maps ??= table(files().read(MAP_FILE, true)!)
      const wdt = read(dungeonWorldFile(maps, map) ?? 0)
      if (!wdt) return false
      if (!liquids) {
        liquids = new Map()
        try {
          for (const row of table(read(LIQUID_TYPE_FILE)!).rows) liquids.set(row.id, liquidOfName(row.text(0)))
        } catch {
          // all water
        }
      }
      const liquid = (type: number): number => liquids!.get(type) ?? WATER
      // its ground, where it has one: the heights and the 3D tiles, and which rooms lie under it. What was made of it
      // before goes: a block left out now would stay
      const named = finishedInteriors(folder)?.maps.find((m) => m.id === map), pieces = named?.pieces ?? [], ground = paintedGround(wdt, read, pieces)
      for (const old of ['heights', 'shade', 'levels', UNDER_FILE]) rmSync(join(folder, name, old), { recursive: true, force: true })
      let rooms: Set<string> | undefined, cut: ((u: number, v: number) => number) | undefined
      if (ground.size) {
        // a terrain file is asked for by its number: those of the blocks left out are not there
        const terrain = new Set(terrainFiles(wdt).values())
        convertHeights(wdt, (id) => (terrain.has(id) && !ground.has(id) ? null : read(id)), join(folder, name), undefined, liquid)
        const placed = placedIn(wdt, read), groundAt = groundOf(join(folder, name))
        rooms = new Set([...new Set(pieces.map((p) => p.building))].flatMap((n) => (placed[n] ? [buriedKey(placed[n].file, placed[n].u, placed[n].v)] : [])))
        // a map with no boss is a land one walks (Deadwind Pass, over the crypts of Karazhan), not a dungeon dug in
        const rock = named?.bosses.length ? inRock(pieces, groundAt, bossesOf(map)) : new Set<number>(), cutRound: { piece: Piece; floor: number }[] = []
        // ponytail: a room's floor is taken as the bottom of its box, which a pit under it lowers: the ground then opens a little wider than the room asks
        const under = pieces.flatMap((p, index): UnderRoom[] => {
          const roof = roofOf(p, p.bottom, groundAt)
          if (roof === null) return []
          if (!rock.has(p.building)) return [[index, p.bottom, Math.round(roof), 0]]
          cutRound.push({ piece: p, floor: p.bottom })
          return [[index, p.bottom, Math.round(roof), 1]]
        })
        if (cutRound.length) cut = (u, v) => rockCut(cutRound, u, v)
        const file = join(folder, name, UNDER_FILE)
        writeFileSync(file + '.part', JSON.stringify({ rule: ROCK_RULE, rooms: under }))
        renameSync(file + '.part', file)
      }
      // the objects first: the list of the buildings, written last, is what the view waits for
      makeProps([{ name, wdt, buried: rooms ?? 'all', rooms: pieces, ...(cut ? { cut } : {}) }], read, folder)
      makeBuildings([{ name, wdt, dungeon: true, ...(rooms ? { buried: rooms } : {}) }], read, folder, liquid)
      return existsSync(list) && done()
    } catch {
      return false
    }
  }
}
