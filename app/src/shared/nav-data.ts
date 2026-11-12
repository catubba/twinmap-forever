// The walking grid: the terrain of a continent cut in cells of about 8 yards, with what can be
// walked, the water, the floors of buildings and which cells are road. Twinmap ships it with the
// app, one file a continent (resources/nav), taken as it is from Shortest Path Forever by cjber,
// GPL-3.0-or-later (scripts/import-nav.js; see THIRD-PARTY-LICENSES). Here only what a file is and
// whether it is one this app can read; decoding the clusters comes with the path finder.

/** The parts of a cluster, each a list of blocks: zlib, in base64. Told in full in the head of Shortest Path Forever's Nav/Nav0.lua. */
export type NavField = 'graph' | 'grid' | 'height' | 'floor' | 'terrain'
const FIELDS: NavField[] = ['graph', 'grid', 'height', 'floor', 'terrain']

/** The format of the grid this app reads: any other is a file for a newer or an older reader. */
export const NAV_FORMAT = 2

export interface NavData {
  /** The game's number of the continent: 0 Eastern Kingdoms, 1 Kalimdor. */
  map: number
  /** What it was taken from, with its version. */
  from: string
  /** The lines of the bake: the build of the game it was made from, and what made it. */
  source: string[]
  /** Cluster k (from 0) is the square of 1600 / 3 yards whose north and west start at (cx0 + k / ny) and (cy0 + k % ny) squares. */
  cx0: number
  cy0: number
  nx: number
  ny: number
  /** Cells a side of a cluster. */
  cells: number
  swim: number
  zstep: number
  format: number
  steep: boolean
  /** By field, then by cluster. */
  packed: Record<NavField, Record<string, string[]>>
  /** By cluster: the cells that are road, and how much of each edge between entrances is. */
  roads: Record<string, string>
  roadEdges: Record<string, string>
}

const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const strings = (v: unknown): boolean => typeof v === 'object' && v !== null && Object.values(v).every((s) => typeof s === 'string')

/** A file of the grid as it was read, checked; null for anything else, and for a format this app does not read. */
export function navFrom(text: string): NavData | null {
  let read: unknown
  try {
    read = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof read !== 'object' || !read) return null
  const nav = read as Partial<NavData>
  if (![nav.map, nav.cx0, nav.cy0, nav.nx, nav.ny, nav.cells, nav.swim, nav.zstep].every(number) || nav.format !== NAV_FORMAT) return null
  if (typeof nav.from !== 'string' || !Array.isArray(nav.source) || typeof nav.steep !== 'boolean' || !strings(nav.roads) || !strings(nav.roadEdges)) return null
  const packed = nav.packed as Record<string, unknown> | undefined
  if (typeof packed !== 'object' || !packed) return null
  for (const field of FIELDS) {
    const clusters = packed[field]
    if (typeof clusters !== 'object' || !clusters || !Object.values(clusters).every((blocks) => Array.isArray(blocks) && blocks.every((b) => typeof b === 'string'))) return null
  }
  return nav as NavData
}
