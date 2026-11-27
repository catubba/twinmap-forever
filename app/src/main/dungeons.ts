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
// are all buildings. On a ground, only the buildings with rooms on the 2D map are drawn open, the others stand as on a continent; and the
// rooms that lie under the ground are listed, for the view to open the ground over them (inside3d.ts):
//   i<map>/under.json    of its pieces (interiors.json) those inside the ground: [index, floor, yards of ground over it]
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dungeonFolder, type Placed } from '../shared/buildings'
import { groundTextures } from '../shared/ground'
import { blockHeights } from '../shared/heights'
import { roofOf, type UnderRoom } from '../shared/inside'
import type { Table } from '../shared/wdc5'
import { LIQUID_TYPE_FILE, liquidOfName, WATER } from '../shared/water'
import { BLOCKS, groundFiles, terrainFiles } from '../shared/world'
import { buriedKey, FORMAT, makeBuildings, PLACED_FILE } from './buildings'
import { groundOf } from './caves'
import type { ClientFiles } from './client-files'
import { convertHeights } from './heights'
import { dungeonWorldFile, finishedInteriors, MAP_FILE, placedIn } from './interiors'
import { makeProps } from './props'

export const UNDER_FILE = 'under.json'

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
 * texture of its own is a sheet left there, not a place), or none when what is left is all at one level, which is
 * what the game leaves under a dungeon that is all buildings.
 */
export function paintedGround(wdt: Buffer, read: (id: number) => Buffer | null): Set<number> {
  const textures = groundFiles(wdt), painted = new Set<number>()
  let low = Infinity, high = -Infinity
  for (const [block, file] of terrainFiles(wdt)) {
    const tex0 = read(textures.get(block) ?? 0)
    if (!tex0 || !groundTextures(tex0).length) continue
    painted.add(file)
    if (high - low > 1) continue
    const adt = read(file), heights = adt && blockHeights(adt, block % BLOCKS, Math.floor(block / BLOCKS))
    for (const h of heights ?? []) if (!Number.isNaN(h)) ((low = Math.min(low, h)), (high = Math.max(high, h)))
  }
  return high - low > 1 ? painted : new Set()
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
      // a list of another format is of buildings made again since, for the continents: its files are gone
      const done = (): boolean => {
        try {
          if ((JSON.parse(readFileSync(list, 'utf8')) as Placed).format !== FORMAT) return false
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
      // its ground, where it has one: the heights and the 3D tiles, and which rooms lie under it
      const ground = paintedGround(wdt, read)
      let rooms: Set<string> | undefined
      if (ground.size) {
        // a terrain file is asked for by its number: those of the blocks left out are not there
        const terrain = new Set(terrainFiles(wdt).values())
        convertHeights(wdt, (id) => (terrain.has(id) && !ground.has(id) ? null : read(id)), join(folder, name), undefined, liquid)
        const pieces = finishedInteriors(folder)?.maps.find((m) => m.id === map)?.pieces ?? [], placed = placedIn(wdt, read), groundAt = groundOf(join(folder, name))
        rooms = new Set([...new Set(pieces.map((p) => p.building))].flatMap((n) => (placed[n] ? [buriedKey(placed[n].file, placed[n].u, placed[n].v)] : [])))
        // ponytail: a room's floor is taken as the bottom of its box, which a pit under it lowers: the ground then opens a little wider than the room asks
        const under = pieces.flatMap((p, index): UnderRoom[] => {
          const roof = roofOf(p, p.bottom, groundAt)
          return roof === null ? [] : [[index, p.bottom, Math.round(roof)]]
        })
        const file = join(folder, name, UNDER_FILE)
        writeFileSync(file + '.part', JSON.stringify(under))
        renameSync(file + '.part', file)
      }
      // the objects first: the list of the buildings, written last, is what the view waits for
      makeProps([{ name, wdt, buried: rooms ?? 'all' }], read, folder)
      makeBuildings([{ name, wdt, dungeon: true, ...(rooms ? { buried: rooms } : {}) }], read, folder, liquid)
      return existsSync(list) && done()
    } catch {
      return false
    }
  }
}
