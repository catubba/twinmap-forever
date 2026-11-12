// The walking grid, where the app keeps it: shipped beside the app, one file a continent. Read
// when a path is first asked for, and kept.
import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { navFrom, type NavData } from '../shared/nav-data'

/** The folder of the grid: beside the packaged app, or in the repo while developing. */
export const navFolder = (): string => (app.isPackaged ? join(process.resourcesPath, 'nav') : join(app.getAppPath(), 'resources', 'nav'))

const read = new Map<number, NavData | null>()

/** The grid of a continent (0 or 1); null where the file is missing or is not one this app reads. */
export function readNav(map: number): NavData | null {
  if (!read.has(map)) {
    let nav: NavData | null = null
    try {
      nav = navFrom(readFileSync(join(navFolder(), `nav${map}.json`), 'utf8'))
    } catch {
      // no file: no walking paths, and the rest of the app goes on
    }
    read.set(map, nav)
  }
  return read.get(map) ?? null
}
