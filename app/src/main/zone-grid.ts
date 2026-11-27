// Which zone each chunk of a continent's land belongs to (33 yards a side), for the layer that tints the zones by their
// levels (shared/zone-levels.ts): the area each chunk of the terrain carries, which the game's tables lead to its zone,
// as parchment.ts finds each zone's ground. Water is no zone's here, so the tint stays on the land.
//
// Kept beside the continent's tiles: zones.bin, deflated, a two-byte map id a chunk (0 for none), north row first.
import { SIDE as GRID } from '../shared/heights'
import type { GameMap } from '../shared/maps'
import type { Table } from '../shared/wdc5'
import { blockWater, WATER } from '../shared/water'
import { BLOCKS, terrainFiles } from '../shared/world'

export const ZONES_FILE = 'zones.bin'
/** Chunks to a side of a continent. */
export const ZONE_SIDE = BLOCKS * 16

/** The zone of every chunk of a continent's land. read: a file of the game; areas: its AreaTable. */
export function zoneGrid(wdt: Buffer, read: (file: number) => Buffer | null, areas: Table, maps: GameMap[], continent: number): Uint16Array {
  const own = new Map(maps.filter((m) => m.level === 'zone' && m.continent === continent && m.rect && m.area).map((m) => [m.area, m.id]))
  const parent = new Map(areas.rows.map((r) => [r.id, r.int(3)]))
  const zoneOf = (a: number): number => {
    for (let n = 0; n < 8 && !own.has(a) && parent.get(a); n++) a = parent.get(a)!
    return own.get(a) ?? 0
  }
  const grid = new Uint16Array(ZONE_SIDE * ZONE_SIDE)
  for (const [block, file] of terrainFiles(wdt)) {
    const adt = read(file)
    if (!adt) continue
    const row = Math.floor(block / BLOCKS), column = block % BLOCKS
    const liquids = blockWater(adt, () => WATER)
    for (let at = 0; at + 8 <= adt.length; at += 8 + adt.readUInt32LE(at + 4)) {
      if (adt.toString('latin1', at, at + 4) !== 'KNCM') continue
      const h = at + 8, x = adt.readUInt32LE(h + 4), y = adt.readUInt32LE(h + 8), z = adt.readFloatLE(h + 0x70)
      if (x >= 16 || y >= 16) continue
      // Water: the chunk's highest ground under its liquid (with no liquid read, under the level of the sea).
      let highest = -Infinity, level = -Infinity
      for (let sub = h + 128; sub + 8 <= at + 8 + adt.readUInt32LE(at + 4); sub += 8 + adt.readUInt32LE(sub + 4)) {
        if (adt.toString('latin1', sub, sub + 4) !== 'TVCM' || adt.readUInt32LE(sub + 4) < 145 * 4) continue
        for (let v = 0; v < 145; v++) highest = Math.max(highest, z + adt.readFloatLE(sub + 8 + v * 4))
        break
      }
      if (liquids) for (let r = y * 8; r <= y * 8 + 8; r++) for (let c = x * 8; c <= x * 8 + 8; c++) {
        const l = liquids.levels[r * GRID + c]!
        if (l > level) level = l // NaN where no liquid
      }
      if (highest < (liquids ? level : 0)) continue
      grid[(row * 16 + y) * ZONE_SIDE + column * 16 + x] = zoneOf(adt.readUInt32LE(h + 0x34))
    }
  }
  return grid
}
