// The map as the game paints it: its parchment of every zone, stitched into tiles like the minimap
// ones (tiles.ts), once per build and language of the game (the names are painted in).
//
// Each zone's picture also paints its torn frame and a piece of its neighbours, so a zone is shown
// only on its own ground: the area each chunk of the terrain (33 yards) belongs to, which the game's
// tables lead to its zone. Sea chunks carry a zone too, so a zone keeps the sea before its coast.
// Chunks of no zone near one are given to the nearest. Further out, the land of no zone (Gilneas) and the open sea are
// the continent's own picture enlarged, as the game's map shows them; the sea fades to one colour far from any coast.
// Across a border the two pictures fade into each other over a chunk or two, and along it each is shaded towards the
// middle of the two, so zones painted in other tones meet without a step. A city is its own map on its own ground, and
// where that map does not reach, the zone around it. Every explorable piece is painted, as if all were explored.
//
// Kept: <continent folder>/parchment/<zoom>/<column>/<row>.png, zoom 0 to 5 (5 is the detail of the zones' pictures,
// about 4 yards a pixel; the map enlarges it above), and 6 and 7 over the cities, whose maps are drawn about a yard a
// pixel.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join as joinPath } from 'node:path'
import { decodeBlp, decodeBlpCutout } from '../shared/blp'
import { unitsOfRect } from '../shared/geo'
import type { GameMap } from '../shared/maps'
import { halve, join } from '../shared/pixels'
import { AREA_TABLE_FILE, UI_MAP_X_MAP_ART_FILE, WORLD_MAP_OVERLAY_FILE } from '../shared/places'
import type { Table } from '../shared/wdc5'
import { SIDE as GRID } from '../shared/heights'
import { blockWater, WATER } from '../shared/water'
import { BLOCKS, terrainFiles } from '../shared/world'
import { encodePng } from './png'
import { keep, TILE } from './tiles'

export const PARCHMENT_ZOOM = 5
const MARKER = 'done.json'
const FORMAT = 1
// The game's tables of the pictures: their styles (size and tiles) and their tiles; those of the pieces.
const UI_MAP_ART_FILE = 1957202, UI_MAP_ART_STYLE_LAYER_FILE = 1957208, UI_MAP_ART_TILE_FILE = 1957210, WORLD_MAP_OVERLAY_TILE_FILE = 1957212

/** Chunks to a side of a continent, and chunks to a map unit. */
const SIDE = BLOCKS * 16, PER_UNIT = 16 / (256 / BLOCKS)
/**
 * In chunks: how far a zone takes the ground of no zone next to it, how far out to sea a zone's picture
 * reaches from its coast, and how wide the band shaded along a border.
 */
const FILL = 8, COAST = 5, BAND = 6
/** In chunks: how far out the open sea keeps its drawing before it fades to one colour, the map's ground beyond the tiles. */
const REACH = 24
/** The closest zoom of the tiles over the cities. */
export const CITY_ZOOM = 7
/** The most square yards a city's map covers. */
const CITY = 2.5e6
/** How wide the torn frame of a zone's picture, which is never shown. */
const FRAME = 16 // pixels of a zone's picture
const PAPER = 0, SEA = 1 // the two layers that are no zone; zones from 2
/**
 * Pictures the client has that no map of its tables places: the map of Gilneas, a land with no zone in Forever. Where
 * it lies (yards, x north and y west) and its files, as MapUtils by D4KiR (GPL-3.0) places it on the continent's map
 * (data/forever/extraart.lua): twelve tiles of 256 pixels, by rows.
 */
const EXTRA = [
  {
    continent: 0,
    rect: { minX: -2631.25, minY: 293.75, maxX: -533.333, maxY: 3439.58 },
    width: 1002,
    height: 668,
    files: [308492, 308496, 308497, 308498, 308499, 308500, 308501, 308502, 308503, 308493, 308494, 308495],
  },
]

export function parchmentFolder(continentFolder: string): string {
  return joinPath(continentFolder, 'parchment')
}

/** The colour of the open sea of a finished parchment, which the map shows around its tiles; null when there is none yet. */
export function parchmentSea(continentFolder: string): number[] | null {
  try {
    const done = JSON.parse(readFileSync(joinPath(parchmentFolder(continentFolder), MARKER), 'utf8')) as { format?: number; sea?: number[] }
    return done.format === FORMAT && Array.isArray(done.sea) ? done.sea : null
  } catch {
    return null
  }
}

interface Picture { width: number; height: number; rgb: Uint8Array }
interface Layer { picture?: Picture; tl: { x: number; y: number }; br: { x: number; y: number } }

/**
 * Makes one continent's parchment. read: a game file by number. table: a table from its file.
 * Gives the tiles made, or 0 when the game has not the tables of its pictures.
 */
export function convertParchment(
  wdt: Buffer,
  read: (id: number, skipHidden?: boolean) => Buffer | null,
  table: (file: Buffer) => Table,
  maps: GameMap[],
  continent: number,
  continentFolder: string,
  onProgress?: (done: number, total: number) => void,
): number {
  const folder = parchmentFolder(continentFolder)
  const tableOf = (id: number): Table | null => {
    const f = read(id, true)
    return f && table(f)
  }
  const [xArt, arts, styles, artTiles, overlays, overlayTiles, areas] = [UI_MAP_X_MAP_ART_FILE, UI_MAP_ART_FILE, UI_MAP_ART_STYLE_LAYER_FILE, UI_MAP_ART_TILE_FILE, WORLD_MAP_OVERLAY_FILE, WORLD_MAP_OVERLAY_TILE_FILE, AREA_TABLE_FILE].map(tableOf)
  if (!xArt || !arts || !styles || !artTiles || !overlays || !overlayTiles || !areas) return 0

  // A picture from its tiles, and pieces over them.
  const drawn = (width: number, height: number, tiles: { file: number; x: number; y: number; cutout: boolean }[]): Picture => {
    const rgb = new Uint8Array(width * height * 3)
    const put = (file: number, ox: number, oy: number, cutout: boolean): void => {
      const f = read(file)
      if (!f) return
      if (!cutout) {
        const c = decodeBlp(f)
        for (let y = 0; y < c.height && oy + y < height; y++) rgb.set(c.rgb.subarray(y * c.width * 3, Math.min(c.width, width - ox) * 3 + y * c.width * 3), ((oy + y) * width + ox) * 3)
        return
      }
      const c = decodeBlpCutout(f)
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const X = ox + x, Y = oy + y
        if (X >= width || Y >= height) continue
        const s = (y * c.width + x) * 4, d = (Y * width + X) * 3, a = c.rgba[s + 3]! / 255
        for (let k = 0; k < 3; k++) rgb[d + k] = c.rgba[s + k]! * a + rgb[d + k]! * (1 - a)
      }
    }
    for (const t of tiles) put(t.file, t.x, t.y, t.cutout)
    return { width, height, rgb }
  }
  // A map's whole picture: its tiles, and every piece over them.
  const pictureOf = (mapId: number): Picture | undefined => {
    const artId = xArt.rows.find((r) => r.parent === mapId)?.int(1)
    const art = arts.rows.find((r) => r.id === artId)
    const style = art && styles.rows.find((r) => r.parent === art.int(2) && r.int(0) === 0)
    if (!art || !style) return undefined
    const tw = style.int(3), th = style.int(4)
    return drawn(style.int(1), style.int(2), [
      ...artTiles.rows.filter((r) => r.parent === artId).map((t) => ({ file: t.int(3), x: t.int(1) * tw, y: t.int(0) * th, cutout: false })),
      ...overlays.rows.filter((r) => r.int(1) === artId).flatMap((o) => overlayTiles.rows.filter((r) => r.parent === o.id).map((t) => ({ file: t.int(3), x: o.int(4) + t.int(1) * tw, y: o.int(5) + t.int(0) * th, cutout: true }))),
    ])
  }
  const layerOf = (m: GameMap): Layer => {
    const [tl, br] = unitsOfRect(m.rect!)
    return { picture: pictureOf(m.id), tl, br }
  }

  // Every zone its own layer, cities included: a city's picture is drawn on its own ground.
  const zones = maps.filter((m) => m.level === 'zone' && m.continent === continent && m.rect)
  const own = new Map(zones.map((m, i) => [m.area, i + 2])) // top area -> layer
  const whole = maps.find((m) => m.level === 'continent' && m.continent === continent && m.rect)
  const layers: (Layer | undefined)[] = [undefined, whole && layerOf(whole), ...zones.map(layerOf)]
  const extras = EXTRA.filter((e) => e.continent === continent).map((e) => {
    const [tl, br] = unitsOfRect(e.rect)
    layers.push({ picture: drawn(e.width, e.height, e.files.map((file, n) => ({ file, x: (n % Math.ceil(e.width / TILE)) * TILE, y: Math.floor(n / Math.ceil(e.width / TILE)) * TILE, cutout: false }))), tl, br })
    return layers.length - 1
  })

  // The ground: which layer each chunk shows. -1 for land of no zone (yet), SEA where there is no terrain.
  // A chunk whose ground is all under its liquid (or, with no liquid read, under the level of the sea) is water; its
  // zone's picture shows on it only near a coast.
  const parent = new Map(areas.rows.map((r) => [r.id, r.int(3)]))
  const top = (a: number): number => {
    for (let n = 0; parent.get(a) && n < 8; n++) a = parent.get(a)!
    return a
  }
  const ground = new Int16Array(SIDE * SIDE).fill(SEA), water = new Uint8Array(SIDE * SIDE).fill(1)
  const blocks = terrainFiles(wdt)
  for (const [block, file] of blocks) {
    const adt = read(file)
    if (!adt) continue
    const row = Math.floor(block / BLOCKS), column = block % BLOCKS
    const liquids = blockWater(adt, () => WATER)
    for (let at = 0; at + 8 <= adt.length; ) {
      const tag = adt.toString('latin1', at, at + 4), size = adt.readUInt32LE(at + 4)
      if (tag === 'KNCM') {
        const h = at + 8, x = adt.readUInt32LE(h + 4), y = adt.readUInt32LE(h + 8)
        if (x < 16 && y < 16) {
          const i = (row * 16 + y) * SIDE + column * 16 + x, z = adt.readFloatLE(h + 0x70)
          let highest = -Infinity
          for (let sub = h + 128; sub + 8 <= at + 8 + size; sub += 8 + adt.readUInt32LE(sub + 4)) {
            if (adt.toString('latin1', sub, sub + 4) !== 'TVCM' || adt.readUInt32LE(sub + 4) < 145 * 4) continue
            for (let v = 0; v < 145; v++) highest = Math.max(highest, z + adt.readFloatLE(sub + 8 + v * 4))
            break
          }
          let level = -Infinity
          if (liquids) for (let r = y * 8; r <= y * 8 + 8; r++) for (let c = x * 8; c <= x * 8 + 8; c++) {
            const l = liquids.levels[r * GRID + c]!
            if (l > level) level = l
          }
          water[i] = highest < (liquids ? level : 0) ? 1 : 0
          ground[i] = own.get(top(adt.readUInt32LE(h + 0x34))) ?? -1
        }
      }
      at += 8 + size
    }
  }
  const near = [-1, 1, -SIDE, SIDE]
  const neighbours = (i: number): number[] => near.map((d) => i + d).filter((j) => j >= 0 && j < ground.length && (Math.abs((j % SIDE) - (i % SIDE)) <= 1))
  // How far each water chunk is from land, up to COAST: a zone's water further out is open sea, as is water of no zone.
  const shore = new Uint8Array(SIDE * SIDE).fill(COAST)
  let edge = [...water.keys()].filter((i) => !water[i])
  for (const i of edge) shore[i] = 0
  for (let step = 1; step < COAST && edge.length; step++) {
    const next: number[] = []
    for (const i of edge) for (const j of neighbours(i)) if (shore[j] === COAST) (shore[j] = step), next.push(j)
    edge = next
  }
  // Whether a picture (within its frame) covers a point of the map.
  const covers = (layer: number, u: number, v: number): boolean => {
    const l = layers[layer], p = l?.picture
    if (!p) return false
    const px = ((u - l.tl.x) / (l.br.x - l.tl.x)) * p.width, py = ((v - l.tl.y) / (l.br.y - l.tl.y)) * p.height
    return px >= FRAME && py >= FRAME && px < p.width - FRAME && py < p.height - FRAME
  }
  // A city: a map smaller than any zone (Stormwind, the biggest, is 2 million square yards; Redridge, the smallest zone,
  // 3), its middle inside a bigger zone, which draws the ground the city's map does not reach.
  const inside = (m: GameMap, z: GameMap): boolean => {
    const r = m.rect!, o = z.rect!, x = (r.minX + r.maxX) / 2, y = (r.minY + r.maxY) / 2
    return z !== m && (r.maxX - r.minX) * (r.maxY - r.minY) < CITY && o.maxX - o.minX > r.maxX - r.minX && x > o.minX && x < o.maxX && y > o.minY && y < o.maxY
  }
  const around = new Map<number, number>() // city layer -> zone layer
  zones.forEach((city, n) => {
    const zone = zones.find((z) => inside(city, z))
    if (zone) around.set(n + 2, zones.indexOf(zone) + 2)
  })
  // The land of no zone a picture of EXTRA covers, and its water near the coast, is that picture's.
  for (let i = 0; i < ground.length; i++) {
    if (ground[i] !== -1 || (water[i] && shore[i] === COAST)) continue
    const extra = extras.find((layer) => covers(layer, ((i % SIDE) + 0.5) / PER_UNIT, (Math.floor(i / SIDE) + 0.5) / PER_UNIT))
    if (extra !== undefined) ground[i] = extra
  }
  // A city keeps its harbour: its map draws it.
  for (let i = 0; i < ground.length; i++) if (water[i] && (shore[i] === COAST || ground[i] === -1) && !around.has(ground[i]!)) ground[i] = SEA
  // The land of no zone goes to the nearest zone, up to FILL chunks; beyond, paper.
  edge = [...ground.keys()].filter((i) => ground[i]! >= 2)
  for (let step = 0; step < FILL && edge.length; step++) {
    const next: number[] = []
    for (const i of edge) for (const j of neighbours(i)) if (ground[j] === -1) (ground[j] = ground[i]!), next.push(j)
    edge = next
  }
  for (let i = 0; i < ground.length; i++) if (ground[i] === -1) ground[i] = PAPER

  // Along each border: how far each chunk is from it (in chunks, up to BAND) and the layer across.
  const far = new Uint8Array(SIDE * SIDE).fill(BAND), across = new Int16Array(SIDE * SIDE).fill(-1)
  edge = []
  for (let i = 0; i < ground.length; i++) {
    const other = neighbours(i).find((j) => ground[j] !== ground[i])
    if (other !== undefined) (far[i] = 0), (across[i] = ground[other]!), edge.push(i)
  }
  for (let step = 1; step < BAND && edge.length; step++) {
    const next: number[] = []
    for (const i of edge) for (const j of neighbours(i)) if (far[j] === BAND && ground[j] === ground[i]) (far[j] = step), (across[j] = across[i]!), next.push(j)
    edge = next
  }

  // How far each chunk of open sea is from anything else, up to REACH.
  const reach = new Uint8Array(SIDE * SIDE).fill(REACH)
  edge = []
  for (let i = 0; i < ground.length; i++) if (ground[i] !== SEA) (reach[i] = 0), edge.push(i)
  for (let step = 1; step < REACH && edge.length; step++) {
    const next: number[] = []
    for (const i of edge) for (const j of neighbours(i)) if (reach[j] === REACH) (reach[j] = step), next.push(j)
    edge = next
  }
  const chunkAt = (u: number, v: number): number => Math.min(SIDE - 1, Math.max(0, Math.floor(v * PER_UNIT))) * SIDE + Math.min(SIDE - 1, Math.max(0, Math.floor(u * PER_UNIT)))
  // The continent's picture, enlarged: the land of no zone and the open sea, as the game's map shows them.
  const enlarged = (u: number, v: number, out: Float32Array): boolean => {
    const l = layers[SEA], p = l?.picture
    if (!l || !p) return false
    const px = Math.min(p.width - 1, Math.max(0, ((u - l.tl.x) / (l.br.x - l.tl.x)) * p.width - 0.5)), py = Math.min(p.height - 1, Math.max(0, ((v - l.tl.y) / (l.br.y - l.tl.y)) * p.height - 0.5))
    const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(x0 + 1, p.width - 1), y1 = Math.min(y0 + 1, p.height - 1), fx = px - x0, fy = py - y0
    for (let k = 0; k < 3; k++) {
      const a = p.rgb[(y0 * p.width + x0) * 3 + k]!, b = p.rgb[(y0 * p.width + x1) * 3 + k]!, c = p.rgb[(y1 * p.width + x0) * 3 + k]!, d = p.rgb[(y1 * p.width + x1) * 3 + k]!
      out[k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    }
    return true
  }
  // The one colour of the far sea: the middle of the continent's picture there.
  const sea = new Float32Array([130, 130, 110])
  {
    const seen: number[][] = [[], [], []], c = new Float32Array(3)
    for (let i = 0; i < ground.length; i += 7) {
      if (reach[i] !== REACH || !enlarged((i % SIDE + 0.5) / PER_UNIT, (Math.floor(i / SIDE) + 0.5) / PER_UNIT, c)) continue
      for (let k = 0; k < 3; k++) seen[k]!.push(c[k]!)
    }
    if (seen[0]!.length) sea.set(seen.map((l) => l.sort((a, b) => a - b)[l.length >> 1]!))
  }
  const open = (u: number, v: number, out: Float32Array, paper: boolean): void => {
    const near = paper ? 1 : 1 - reach[chunkAt(u, v)]! / REACH
    if (!near || !enlarged(u, v, out)) return out.set(sea)
    for (let k = 0; k < 3; k++) out[k] = sea[k]! + (out[k]! - sea[k]!) * near
  }
  // A layer's colour at a point of the map (units), or false off its picture.
  // The edge of a zone's picture is its torn frame: off the picture too.
  const sample = (layer: number, u: number, v: number, out: Float32Array): boolean => {
    if (layer === PAPER || layer === SEA) return open(u, v, out, layer === PAPER), true
    const l = layers[layer], p = l?.picture
    if (!p) return false
    const px = ((u - l.tl.x) / (l.br.x - l.tl.x)) * p.width - 0.5, py = ((v - l.tl.y) / (l.br.y - l.tl.y)) * p.height - 0.5
    if (px < FRAME || py < FRAME || px > p.width - 1 - FRAME || py > p.height - 1 - FRAME) return false
    const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(x0 + 1, p.width - 1), y1 = Math.min(y0 + 1, p.height - 1), fx = px - x0, fy = py - y0
    for (let k = 0; k < 3; k++) {
      const a = p.rgb[(y0 * p.width + x0) * 3 + k]!, b = p.rgb[(y0 * p.width + x1) * 3 + k]!, c = p.rgb[(y1 * p.width + x0) * 3 + k]!, d = p.rgb[(y1 * p.width + x1) * 3 + k]!
      out[k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    }
    return true
  }

  // The tone of each layer along each of its borders: the middle (median) colour of its band there. From the two
  // tones of a border, what each side adds at it: half the way to the other's.
  const pair = (a: number, b: number): number => a * 4096 + b
  const towards = new Map<number, Float32Array>()
  {
    const seen = new Map<number, number[][]>(), c = new Float32Array(3)
    for (let i = 0; i < ground.length; i++) {
      if (far[i]! >= BAND || ground[i]! < SEA || across[i]! < SEA) continue
      if (!sample(ground[i]!, (i % SIDE + 0.5) / PER_UNIT, (Math.floor(i / SIDE) + 0.5) / PER_UNIT, c)) continue
      const key = pair(ground[i]!, across[i]!)
      const list = seen.get(key) ?? seen.set(key, [[], [], []]).get(key)!
      for (let k = 0; k < 3; k++) list[k]!.push(c[k]!)
    }
    const tones = new Map([...seen].map(([key, list]) => [key, list.map((l) => l.sort((a, b) => a - b)[l.length >> 1]!)]))
    for (const [key, a] of tones) {
      const b = tones.get(pair(key % 4096, Math.floor(key / 4096)))
      if (b) towards.set(key, new Float32Array([0, 1, 2].map((k) => (b[k]! - a[k]!) / 2)))
    }
  }
  // What a chunk adds to its layer's colour: all of it at the border, none BAND away.
  const shade = (i: number, out: Float32Array): boolean => {
    const t = towards.get(pair(ground[i]!, across[i]!))
    if (!t) return false
    const w = 1 - far[i]! / BAND
    for (let k = 0; k < 3; k++) out[k] = t[k]! * w
    return true
  }

  // Chunks far from any border, and their neighbours: a pixel among them is its layer's colour alone.
  const calm = new Uint8Array(SIDE * SIDE)
  for (let i = 0; i < ground.length; i++) {
    const x = i % SIDE, y = Math.floor(i / SIDE)
    calm[i] = x >= 2 && y >= 2 && x < SIDE - 2 && y < SIDE - 2 && far[i] === BAND && [-2, -1, 0, 1, 2].every((d) => far[i + d * SIDE - 2] === BAND && far[i + d * SIDE + 2] === BAND && far[i - 2 * SIDE + d] === BAND && far[i + 2 * SIDE + d] === BAND) ? 1 : 0
  }
  // A layer's colour; where it has none (off its picture) the zone around a city, or the layer across its border, or the
  // continent's picture.
  const colour = (layer: number, i: number, u: number, v: number, out: Float32Array): void => {
    if (sample(layer, u, v, out) || (around.has(layer) && sample(around.get(layer)!, u, v, out)) || (across[i]! >= 2 && sample(across[i]!, u, v, out))) return
    sample(water[i] ? SEA : PAPER, u, v, out)
  }

  // One tile of a detailed zoom: each pixel the layers of the chunks around it, weighed by how close.
  // Undefined for a tile all of the one colour of the open sea.
  const detail = (zoom: number, column: number, row: number): Uint8Array | undefined => {
    const scale = 2 ** zoom, rgb = new Uint8Array(TILE * TILE * 3)
    const c = new Float32Array(3), s = new Float32Array(3), sum = new Float32Array(3)
    const ids: number[] = [], weights: number[] = [], chunks: number[] = []
    let land = false
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const u = (column * TILE + x + 0.5) / scale, v = (row * TILE + y + 0.5) / scale, at = (y * TILE + x) * 3
      const fx = u * PER_UNIT - 0.5, fy = v * PER_UNIT - 0.5, cx = Math.floor(fx), cy = Math.floor(fy)
      const middle = Math.min(SIDE - 1, Math.max(0, Math.round(fy))) * SIDE + Math.min(SIDE - 1, Math.max(0, Math.round(fx)))
      if (calm[middle]) {
        if (ground[middle] === SEA) sample(SEA, u, v, c)
        else colour(ground[middle]!, middle, u, v, c)
        land ||= reach[middle]! < REACH
        for (let k = 0; k < 3; k++) rgb[at + k] = Math.round(c[k]!)
        continue
      }
      // The chunks whose middles are within two of the pixel, by a tent: the fade across a border.
      sum.fill(0)
      ids.length = weights.length = chunks.length = 0
      let weight = 0
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) {
        const gx = cx + dx, gy = cy + dy
        if (gx < 0 || gy < 0 || gx >= SIDE || gy >= SIDE) continue
        const w = Math.max(0, 1 - Math.abs(fx - gx) / 2) * Math.max(0, 1 - Math.abs(fy - gy) / 2)
        if (!w) continue
        const i = gy * SIDE + gx, n = ids.indexOf(ground[i]!)
        if (n < 0) ids.push(ground[i]!), weights.push(w), chunks.push(i)
        else weights[n] += w
        if (far[i]! < BAND && shade(i, s)) {
          for (let k = 0; k < 3; k++) sum[k] += s[k]! * w
        }
        weight += w
      }
      ids.forEach((id, n) => {
        colour(id, chunks[n]!, u, v, c)
        for (let k = 0; k < 3; k++) sum[k] += c[k]! * weights[n]!
      })
      land ||= reach[middle]! < REACH
      for (let k = 0; k < 3; k++) rgb[at + k] = Math.max(0, Math.min(255, Math.round(sum[k]! / weight)))
    }
    return land ? rgb : undefined
  }

  // Tiles only where some chunk is not of the one colour of the open sea; the rest, and the parts of a tile below with
  // nothing under them, that colour, which the map shows around the tiles too.
  const chunksPerTile = TILE / (2 ** PARCHMENT_ZOOM / PER_UNIT)
  const wanted = (column: number, row: number): boolean => {
    for (let y = row * chunksPerTile; y < (row + 1) * chunksPerTile; y++) for (let x = column * chunksPerTile; x < (column + 1) * chunksPerTile; x++) if (reach[y * SIDE + x]! < REACH) return true
    return false
  }
  const flat = new Uint8Array(TILE * TILE * 3)
  for (let i = 0; i < flat.length; i++) flat[i] = Math.round(sea[i % 3]!)
  let made = 0, done = 0
  const total = (2 ** PARCHMENT_ZOOM) ** 2
  const tile = (zoom: number, column: number, row: number): Uint8Array | undefined => {
    let rgb: Uint8Array | undefined
    if (zoom === PARCHMENT_ZOOM) {
      onProgress?.(++done, total)
      rgb = wanted(column, row) ? detail(zoom, column, row) : undefined
    } else {
      const four = [0, 1, 2, 3].map((i) => tile(zoom + 1, column * 2 + (i & 1), row * 2 + (i >> 1)))
      if (four.every((part) => !part)) return undefined
      rgb = halve(join(four.map((part) => part ?? flat), TILE), TILE * 2)
    }
    if (rgb) {
      made++
      keep(joinPath(folder, String(zoom), String(column), `${row}.png`), () => encodePng(rgb, TILE, TILE, 3, true))
    }
    return rgb
  }
  if (existsSync(joinPath(folder, MARKER))) rmSync(folder, { recursive: true, force: true })
  tile(0, 0, 0)
  // Over the cities, closer zooms: every tile that holds some of a city's ground.
  const closer: Record<number, number[][]> = {}
  for (let zoom = PARCHMENT_ZOOM + 1; zoom <= CITY_ZOOM; zoom++) {
    const side = TILE / (2 ** zoom / PER_UNIT), seen = new Set<number>()
    for (let i = 0; i < ground.length; i++) if (around.has(ground[i]!)) seen.add(Math.floor(Math.floor(i / SIDE) / side) * 65536 + Math.floor((i % SIDE) / side))
    closer[zoom] = [...seen].map((key) => [key % 65536, Math.floor(key / 65536)])
    for (const [column, row] of closer[zoom]!) {
      const rgb = detail(zoom, column!, row!)
      if (rgb) (made++), keep(joinPath(folder, String(zoom), String(column), `${row}.png`), () => encodePng(rgb, TILE, TILE, 3, true))
    }
  }
  mkdirSync(folder, { recursive: true })
  writeFileSync(joinPath(folder, MARKER), JSON.stringify({ tiles: made, format: FORMAT, sea: [...sea].map(Math.round), closer }))
  return made
}
