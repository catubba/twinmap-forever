// The dungeons and raids in the 3D view (M23-F23; the prototype and its measures: design/ROADMAP.md, M23-F14). A
// dungeon's buildings, their liquids and the objects of their rooms are made the first time the view asks for its list,
// as the ground's own textures are (ground.ts): under a second each in the prototype, so not with the map, which has
// fifty of them. They are made as a continent's are (buildings.ts, props.ts), in the folder the dungeon's ground has
// (shared/buildings.ts, dungeonFolder), sharing the files and textures of the continents' buildings.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { dungeonFolder } from '../shared/buildings'
import type { Table } from '../shared/wdc5'
import { LIQUID_TYPE_FILE, liquidOfName, WATER } from '../shared/water'
import { makeBuildings, PLACED_FILE } from './buildings'
import type { ClientFiles } from './client-files'
import { dungeonWorldFile, MAP_FILE } from './interiors'
import { makeProps } from './props'

/**
 * The dungeon whose list of buildings, or of objects, a path asks for, by the game's number of its map; null for any
 * other path. Both lists wait for the one making: the view asks for them together, and would not ask again for a while.
 */
export function dungeonAsked(path: string): number | null {
  const m = /^\/i(\d{1,5})\/(?:buildings|props)\.json$/.exec(path)
  return m ? Number(m[1]) : null
}

/**
 * Makes the buildings and objects of a dungeon where the folder does not have them yet: true when its list is there
 * after. files: the game's archive, opened when first needed; table: a table of the game from its file.
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
  return (map) => {
    try {
      const name = dungeonFolder(map)
      if (existsSync(join(folder, name, PLACED_FILE))) return true
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
      // the objects first: the list of the buildings, written last, is what the view waits for
      makeProps([{ name, wdt, buried: 'all' }], read, folder)
      makeBuildings([{ name, wdt, dungeon: true }], read, folder, (type) => liquids!.get(type) ?? WATER)
      return existsSync(join(folder, name, PLACED_FILE))
    } catch {
      return false
    }
  }
}
