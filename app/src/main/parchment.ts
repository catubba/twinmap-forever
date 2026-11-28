// The map as the game paints it: its parchment of every zone, stitched into tiles like the minimap
// ones (tiles.ts), once per build and language of the game (the names are painted in).
//
// Each zone's picture also paints its torn frame and a piece of its neighbours, so a zone is shown
// only on its own ground: the area each chunk of the terrain (33 yards) belongs to, which the game's
// tables lead to its zone. Sea chunks carry a zone too, so a zone keeps the sea before its coast.
// Chunks of no zone near one are given to the nearest. Further out, the land of no zone is OpenMap's fills painted by
// hand for it (scripts/import-openmap.js), and Gilneas its own pictures; the rest of it and the open sea are the
// continent's picture enlarged (OpenMap's, with the sea lettering taken off), as the game's map shows them; far from
// any zone both fade to one colour, so the sea and an island of no zone are alike. Where a zone's picture does not reach
// over its own ground, the fills too.
// Across a border the two pictures fade into each other over a chunk or two, and along it each is shaded towards the
// middle of the two, so zones painted in other tones meet without a step. A city is its own map on its own ground, and
// where that map does not reach, the zone around it. Every explorable piece is painted, as if all were explored.
//
// Kept: <continent folder>/parchment/<zoom>/<column>/<row>.png, zoom 0 to 5 (5 is the detail of the zones' pictures,
// about 4 yards a pixel; the map enlarges it above), and 6 and 7 over the cities, whose maps are drawn about a yard a
// pixel.
//
// The game's files are read here; the tiles are painted and kept on a few threads of their own (parchment-worker.ts),
// which share what painting takes instead of copying it.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join as joinPath } from 'node:path'
import { inflateSync } from 'node:zlib'
import type { Worker } from 'node:worker_threads'
import { decodeBlp, decodeBlpCutout } from '../shared/blp'
import { unitsOfRect } from '../shared/geo'
import { UI_MAP_ASSIGNMENT_FILE, type GameMap } from '../shared/maps'
import { halve, join } from '../shared/pixels'
import { AREA_TABLE_FILE, UI_MAP_X_MAP_ART_FILE, WORLD_MAP_OVERLAY_FILE } from '../shared/places'
import type { Table } from '../shared/wdc5'
import { BLOCKS } from '../shared/world'
import { encodePng } from './png'
import { keep, TILE } from './tiles'
import { terrainChunks } from './zone-grid'

export const PARCHMENT_ZOOM = 5
const MARKER = 'done.json'
const FORMAT = 2 // 1 had no fills of OpenMap
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
/** The game's map of the whole world, on which OpenMap places its fills. */
const WORLD_MAP = 947
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

/** alpha: how much of each pixel shows, for a picture that is clear in parts (OpenMap's fills). */
interface Picture { width: number; height: number; rgb: Uint8Array; alpha?: Uint8Array }
/** frame: the pixels at its edges never shown (the torn frame of the game's maps), FRAME unless told. */
interface Layer { picture?: Picture; tl: { x: number; y: number }; br: { x: number; y: number }; frame?: number }

/** A picture kept by scripts/import-openmap.js, or undefined where there is none. */
function keptPicture(file: string): Picture | undefined {
  if (!existsSync(file)) return undefined
  const b = readFileSync(file), width = b.readUInt16LE(0), height = b.readUInt16LE(2), channels = b[4]!, row = width * channels
  const rows = inflateSync(b.subarray(5))
  for (let i = row; i < rows.length; i++) rows[i] = (rows[i]! + rows[i - row]!) & 255
  const rgb = shared(Uint8Array, width * height * 3)
  if (channels === 3) return rgb.set(rows), { width, height, rgb }
  const alpha = shared(Uint8Array, width * height)
  for (let i = 0; i < alpha.length; i++) {
    for (let k = 0; k < 3; k++) rgb[i * 3 + k] = rows[i * 4 + k]!
    alpha[i] = rows[i * 4 + 3]!
  }
  return { width, height, rgb, alpha }
}

/** What painting a tile of a continent takes, worked out once; its arrays shared with the threads that paint (parchment-worker.ts). */
export interface Ground {
  /** By layer: none for PAPER, the continent's picture for SEA, then the zones and the pictures of EXTRA. */
  layers: (Layer | undefined)[]
  /** By chunk: its layer, whether water, how far from any picture, whether calm, its shade. */
  ground: Int16Array
  water: Uint8Array
  reach: Uint8Array
  calm: Uint8Array
  shading: Float32Array
  shaded: Uint8Array
  /** By chunk of a picture: the picture across its nearest border with another, -1 for none. */
  beyond: Int16Array
  /** A city's layer and the layer of the zone around it. */
  around: [number, number][]
  /** The layers of OpenMap's fills. */
  fills: number[]
  /** The one colour of the far sea. */
  sea: Float32Array
}

/** A typed array the threads that paint share with the one that made it. */
function shared<T>(Type: { new (buffer: SharedArrayBuffer): T; BYTES_PER_ELEMENT: number }, length: number): T {
  return new Type(new SharedArrayBuffer(length * Type.BYTES_PER_ELEMENT))
}

/** The colours of a continent's parchment, from what convertParchment worked out. */
export function painter(g: Ground) {
  const { layers, ground, water, beyond, reach, calm, shading, shaded, sea, fills } = g, around = new Map(g.around)
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
  const open = (u: number, v: number, out: Float32Array): void => {
    const near = 1 - reach[chunkAt(u, v)]! / REACH
    if (!near || !enlarged(u, v, out)) return out.set(sea)
    for (let k = 0; k < 3; k++) out[k] = sea[k]! + (out[k]! - sea[k]!) * near
  }
  // A layer's colour at a point of the map (units), or false off its picture.
  // The edge of a zone's picture is its torn frame: off the picture too. A picture clear in parts (a fill) is laid over
  // the continent's, as much as it shows; off the picture where it is all clear.
  const behind = new Float32Array(3)
  const sample = (layer: number, u: number, v: number, out: Float32Array): boolean => {
    if (layer === PAPER || layer === SEA) return open(u, v, out), true
    const l = layers[layer], p = l?.picture, frame = l?.frame ?? FRAME
    if (!p) return false
    const px = ((u - l.tl.x) / (l.br.x - l.tl.x)) * p.width - 0.5, py = ((v - l.tl.y) / (l.br.y - l.tl.y)) * p.height - 0.5
    if (px < frame || py < frame || px > p.width - 1 - frame || py > p.height - 1 - frame) return false
    const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(x0 + 1, p.width - 1), y1 = Math.min(y0 + 1, p.height - 1), fx = px - x0, fy = py - y0
    if (!p.alpha) {
      for (let k = 0; k < 3; k++) {
        const a = p.rgb[(y0 * p.width + x0) * 3 + k]!, b = p.rgb[(y0 * p.width + x1) * 3 + k]!, c = p.rgb[(y1 * p.width + x0) * 3 + k]!, d = p.rgb[(y1 * p.width + x1) * 3 + k]!
        out[k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
      }
      return true
    }
    const at = [y0 * p.width + x0, y0 * p.width + x1, y1 * p.width + x0, y1 * p.width + x1], w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy]
    let shown = 0
    for (let n = 0; n < 4; n++) shown += (w[n]! * p.alpha[at[n]!]!) / 255
    if (shown < 1 / 255) return false
    open(u, v, behind)
    for (let k = 0; k < 3; k++) {
      let c = 0
      for (let n = 0; n < 4; n++) c += (w[n]! * p.rgb[at[n]! * 3 + k]! * p.alpha[at[n]!]!) / 255
      out[k] = c + behind[k]! * (1 - shown)
    }
    return true
  }

  // A layer's colour; where it has none (off its picture) the zone around a city, or a fill of OpenMap (which paints its
  // own coasts and shallows), or the picture beyond its nearest border, or the continent's picture.
  const colour = (layer: number, i: number, u: number, v: number, out: Float32Array): void => {
    if (layer >= 2 && (sample(layer, u, v, out) || (around.has(layer) && sample(around.get(layer)!, u, v, out)))) return
    if (fills.some((fill) => fill !== layer && sample(fill, u, v, out))) return
    if (layer >= 2 && beyond[i]! >= 2 && sample(beyond[i]!, u, v, out)) return
    sample(layer < 2 ? layer : water[i] ? SEA : PAPER, u, v, out)
  }

  // One tile of a detailed zoom: each pixel the layers of the chunks around it, weighed by how close.
  // Undefined for a tile all of the one colour of the open sea.
  const detail = (zoom: number, column: number, row: number): Uint8Array | undefined => {
    const scale = 2 ** zoom, rgb = new Uint8Array(TILE * TILE * 3)
    const c = new Float32Array(3), fround = Math.fround
    const ids = new Int32Array(16), weights = new Float64Array(16), chunks = new Int32Array(16)
    let land = false
    for (let y = 0; y < TILE; y++) {
      const v = (row * TILE + y + 0.5) / scale, fy = v * PER_UNIT - 0.5, cy = Math.floor(fy)
      const my = Math.min(SIDE - 1, Math.max(0, Math.round(fy))) * SIDE
      for (let x = 0; x < TILE; x++) {
        const u = (column * TILE + x + 0.5) / scale, at = (y * TILE + x) * 3
        const fx = u * PER_UNIT - 0.5, cx = Math.floor(fx)
        const middle = my + Math.min(SIDE - 1, Math.max(0, Math.round(fx)))
        if (reach[middle]! < REACH) land = true
        if (calm[middle]) {
          colour(ground[middle]!, middle, u, v, c)
          rgb[at] = Math.round(c[0]!), rgb[at + 1] = Math.round(c[1]!), rgb[at + 2] = Math.round(c[2]!)
          continue
        }
        // The chunks whose middles are within two of the pixel, by a tent: the fade across a border.
        // The sums as the bytes of a picture of floats would keep them, the way the tiles have always been worked out.
        let red = 0, green = 0, blue = 0, weight = 0, count = 0
        for (let gy = Math.max(0, cy - 1); gy <= cy + 2 && gy < SIDE; gy++) {
          const wy = Math.max(0, 1 - Math.abs(fy - gy) / 2)
          for (let gx = Math.max(0, cx - 1); gx <= cx + 2 && gx < SIDE; gx++) {
            const w = Math.max(0, 1 - Math.abs(fx - gx) / 2) * wy
            if (!w) continue
            const i = gy * SIDE + gx, id = ground[i]!
            let n = 0
            while (n < count && ids[n] !== id) n++
            if (n === count) (ids[n] = id), (weights[n] = w), (chunks[n] = i), count++
            else weights[n] += w
            if (shaded[i]) (red = fround(red + shading[i * 3]! * w)), (green = fround(green + shading[i * 3 + 1]! * w)), (blue = fround(blue + shading[i * 3 + 2]! * w))
            weight += w
          }
        }
        for (let n = 0; n < count; n++) {
          colour(ids[n]!, chunks[n]!, u, v, c)
          ;(red = fround(red + c[0]! * weights[n]!)), (green = fround(green + c[1]! * weights[n]!)), (blue = fround(blue + c[2]! * weights[n]!))
        }
        rgb[at] = Math.max(0, Math.min(255, Math.round(red / weight)))
        rgb[at + 1] = Math.max(0, Math.min(255, Math.round(green / weight)))
        rgb[at + 2] = Math.max(0, Math.min(255, Math.round(blue / weight)))
      }
    }
    return land ? rgb : undefined
  }
  return { enlarged, sample, detail }
}

/** A tile to make: painted, or given its pixels; kept as a PNG unless it is all of the open sea. */
export interface Task {
  zoom: number
  column: number
  row: number
  file: string
  rgb?: Uint8Array
}

/** Makes a tile; gives its pixels, or undefined for one all of the open sea. */
export function make(detail: ReturnType<typeof painter>['detail'], task: Task): Uint8Array | undefined {
  const rgb = task.rgb ?? detail(task.zoom, task.column, task.row)
  if (rgb) keep(task.file, () => encodePng(rgb, TILE, TILE, 3, 4, 4))
  return rgb
}

/** How many threads paint: a few, and two cores left to the game and the app. */
// ponytail: a fixed share of the cores, not a measure of how busy they are.
const PAINTERS = Math.max(1, Math.min(4, availableParallelism() - 2))

/** Tiles made on the threads of parchment-worker.ts, each given the next in turn; all fail if one of them stops. */
function onThreads(threads: Worker[], g: Ground): (task: Task) => Promise<Uint8Array | undefined> {
  const waiting = new Map<number, { done: (rgb?: Uint8Array) => void; fail: (e: unknown) => void }>()
  const stopped = (e: unknown): void => {
    for (const { fail } of waiting.values()) fail(e)
    waiting.clear()
  }
  for (const t of threads) {
    t.postMessage(g)
    t.on('message', ({ id, rgb }: { id: number; rgb?: Uint8Array }) => {
      waiting.get(id)?.done(rgb)
      waiting.delete(id)
    })
    t.on('error', stopped)
    t.on('exit', () => stopped(new Error('a thread painting the parchment stopped')))
  }
  let next = 0
  return (task) =>
    new Promise((done, fail) => {
      const id = next++
      waiting.set(id, { done, fail })
      threads[id % threads.length]!.postMessage({ id, ...task })
    })
}

/**
 * Makes one continent's parchment. read: a game file by number. table: a table from its file. openmap: the folder of
 * what scripts/import-openmap.js keeps; without it the land of no zone is the continent's picture alone. start: a thread
 * of parchment-worker.ts; without, the tiles are painted on this one. Gives the tiles made, or 0 when the game has not the
 * tables of its pictures.
 */
export async function convertParchment(
  wdt: Buffer,
  read: (id: number, skipHidden?: boolean) => Buffer | null,
  table: (file: Buffer) => Table,
  maps: GameMap[],
  continent: number,
  continentFolder: string,
  openmap?: string,
  onProgress?: (done: number, total: number) => void,
  start?: () => Worker,
): Promise<number> {
  const folder = parchmentFolder(continentFolder)
  const tableOf = (id: number): Table | null => {
    const f = read(id, true)
    return f && table(f)
  }
  const [xArt, arts, styles, artTiles, overlays, overlayTiles, areas] = [UI_MAP_X_MAP_ART_FILE, UI_MAP_ART_FILE, UI_MAP_ART_STYLE_LAYER_FILE, UI_MAP_ART_TILE_FILE, WORLD_MAP_OVERLAY_FILE, WORLD_MAP_OVERLAY_TILE_FILE, AREA_TABLE_FILE].map(tableOf)
  if (!xArt || !arts || !styles || !artTiles || !overlays || !overlayTiles || !areas) return 0

  // A picture from its tiles, and pieces over them.
  const drawn = (width: number, height: number, tiles: { file: number; x: number; y: number; cutout: boolean }[]): Picture => {
    const rgb = shared(Uint8Array, width * height * 3)
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
  // The continent's picture as OpenMap cleaned it: without the giant letters of its name over the land and the sea.
  const cleaned = whole && openmap ? keptPicture(joinPath(openmap, `${whole.id}.bin`)) : undefined
  if (cleaned && layers[SEA]) layers[SEA].picture = cleaned
  const extras = EXTRA.filter((e) => e.continent === continent).map((e) => {
    const [tl, br] = unitsOfRect(e.rect)
    layers.push({ picture: drawn(e.width, e.height, e.files.map((file, n) => ({ file, x: (n % Math.ceil(e.width / TILE)) * TILE, y: Math.floor(n / Math.ceil(e.width / TILE)) * TILE, cutout: false }))), tl, br })
    return layers.length - 1
  })
  // OpenMap's fills on this continent, each placed on the world's map as OpenMap places it (in fractions of that map):
  // turned into yards by where the continent lies on it, as C_Map.GetMapRectOnMap does.
  const fills: number[] = []
  const listed = openmap && existsSync(joinPath(openmap, 'fills.json')) ? (JSON.parse(readFileSync(joinPath(openmap, 'fills.json'), 'utf8')) as { fills: { name: string; box: number[] }[] }).fills : []
  const onWorld = listed.length ? tableOf(UI_MAP_ASSIGNMENT_FILE)?.rows.find((r) => r.int(4) === WORLD_MAP && r.int(6) === continent) : undefined
  if (onWorld) {
    // UiMin, UiMax (fractions of the map), then Region (yards: min x, y, z, max x, y, z).
    const at = (u: number, v: number): { x: number; y: number } => {
      const fu = (u - onWorld.float(0, 0)) / (onWorld.float(1, 0) - onWorld.float(0, 0)), fv = (v - onWorld.float(0, 1)) / (onWorld.float(1, 1) - onWorld.float(0, 1))
      return { x: onWorld.float(2, 3) - fv * (onWorld.float(2, 3) - onWorld.float(2, 0)), y: onWorld.float(2, 4) - fu * (onWorld.float(2, 4) - onWorld.float(2, 1)) }
    }
    for (const { name, box } of listed) {
      const [l, t, r, b] = box as [number, number, number, number]
      if ((l + r) / 2 < onWorld.float(0, 0) || (l + r) / 2 > onWorld.float(1, 0) || (t + b) / 2 < onWorld.float(0, 1) || (t + b) / 2 > onWorld.float(1, 1)) continue
      const picture = keptPicture(joinPath(openmap!, `${name}.bin`)), a = at(l, t), z = at(r, b)
      if (!picture) continue
      const [tl, br] = unitsOfRect({ minX: z.x, minY: z.y, maxX: a.x, maxY: a.y })
      layers.push({ picture, tl, br, frame: 0 })
      fills.push(layers.length - 1)
    }
  }

  // The ground: which layer each chunk shows. -1 for land of no zone (yet), SEA where there is no terrain.
  // A chunk whose ground is all under its liquid (or, with no liquid read, under the level of the sea) is water; its
  // zone's picture shows on it only near a coast.
  const parent = new Map(areas.rows.map((r) => [r.id, r.int(3)]))
  const top = (a: number): number => {
    for (let n = 0; parent.get(a) && n < 8; n++) a = parent.get(a)!
    return a
  }
  const ground = shared(Int16Array, SIDE * SIDE).fill(SEA), water = shared(Uint8Array, SIDE * SIDE).fill(1)
  terrainChunks(wdt, read, (i, area, wet) => {
    water[i] = wet ? 1 : 0
    ground[i] = own.get(top(area)) ?? -1
  })
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
    const l = layers[layer], p = l?.picture, frame = l?.frame ?? FRAME
    if (!p) return false
    const px = ((u - l.tl.x) / (l.br.x - l.tl.x)) * p.width, py = ((v - l.tl.y) / (l.br.y - l.tl.y)) * p.height
    if (px < frame || py < frame || px >= p.width - frame || py >= p.height - frame) return false
    return !p.alpha || p.alpha[Math.floor(py) * p.width + Math.floor(px)]! >= 128
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
  // The land of no zone a picture of EXTRA or a fill of OpenMap covers, and its water near the coast, is that picture's.
  for (let i = 0; i < ground.length; i++) {
    if (ground[i] !== -1 || (water[i] && shore[i] === COAST)) continue
    const extra = [...extras, ...fills].find((layer) => covers(layer, ((i % SIDE) + 0.5) / PER_UNIT, (Math.floor(i / SIDE) + 0.5) / PER_UNIT))
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
  // For each chunk of a picture, the picture across its nearest border with another: what shows where its own does not
  // reach (colour()). Not the sea's or the paper's across their borders, nor only up to BAND: either drew steps, chunk by
  // chunk, between the neighbour's picture and the continent's.
  const beyond = shared(Int16Array, SIDE * SIDE).fill(-1)
  edge = []
  for (let i = 0; i < ground.length; i++) {
    const other = ground[i]! >= 2 ? neighbours(i).find((j) => ground[j]! >= 2 && ground[j] !== ground[i]) : undefined
    if (other !== undefined) (beyond[i] = ground[other]!), edge.push(i)
  }
  while (edge.length) {
    const next: number[] = []
    for (const i of edge) for (const j of neighbours(i)) if (beyond[j] === -1 && ground[j] === ground[i]) (beyond[j] = beyond[i]!), next.push(j)
    edge = next
  }

  // How far each chunk of open sea, or of land of no zone (paper), is from any picture, up to REACH: both fade to the one
  // colour of the far sea, so an island of no zone far out (Gillijim's Isle) is sea, as on the game's map.
  const reach = shared(Uint8Array, SIDE * SIDE).fill(REACH)
  edge = []
  for (let i = 0; i < ground.length; i++) if (ground[i]! >= 2) (reach[i] = 0), edge.push(i)
  for (let step = 1; step < REACH && edge.length; step++) {
    const next: number[] = []
    for (const i of edge) for (const j of neighbours(i)) if (reach[j] === REACH) (reach[j] = step), next.push(j)
    edge = next
  }
  // What painting a tile takes; the shades, the calm chunks and the colour of the far sea are worked out below with its
  // help.
  const sea = new Float32Array([130, 130, 110]), shading = shared(Float32Array, SIDE * SIDE * 3), shaded = shared(Uint8Array, SIDE * SIDE), calm = shared(Uint8Array, SIDE * SIDE)
  const g: Ground = { layers, ground, water, beyond, reach, calm, shading, shaded, around: [...around], fills, sea }
  const { enlarged, sample } = painter(g)
  // The one colour of the far sea: the middle of the continent's picture there.
  {
    const seen: number[][] = [[], [], []], c = new Float32Array(3)
    for (let i = 0; i < ground.length; i += 7) {
      if (reach[i] !== REACH || !enlarged((i % SIDE + 0.5) / PER_UNIT, (Math.floor(i / SIDE) + 0.5) / PER_UNIT, c)) continue
      for (let k = 0; k < 3; k++) seen[k]!.push(c[k]!)
    }
    if (seen[0]!.length) sea.set(seen.map((l) => l.sort((a, b) => a - b)[l.length >> 1]!))
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
  // What a chunk adds to its layer's colour: all of it at the border, none BAND away. Worked out once for each chunk.
  for (let i = 0; i < ground.length; i++) {
    const t = far[i]! < BAND && towards.get(pair(ground[i]!, across[i]!))
    if (!t) continue
    const w = 1 - far[i]! / BAND
    shaded[i] = 1
    for (let k = 0; k < 3; k++) shading[i * 3 + k] = t[k]! * w
  }

  // Chunks far from any border, and their neighbours: a pixel among them is its layer's colour alone.
  for (let i = 0; i < ground.length; i++) {
    const x = i % SIDE, y = Math.floor(i / SIDE)
    calm[i] = x >= 2 && y >= 2 && x < SIDE - 2 && y < SIDE - 2 && far[i] === BAND && [-2, -1, 0, 1, 2].every((d) => far[i + d * SIDE - 2] === BAND && far[i + d * SIDE + 2] === BAND && far[i - 2 * SIDE + d] === BAND && far[i + 2 * SIDE + d] === BAND) ? 1 : 0
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
  const fileOf = (zoom: number, column: number, row: number): string => joinPath(folder, String(zoom), String(column), `${row}.png`)
  const threads = start ? Array.from({ length: PAINTERS }, start) : []
  try {
    const here = painter(g).detail
    const making = threads.length ? onThreads(threads, g) : (task: Task) => Promise.resolve(make(here, task))
    const kept: Promise<unknown>[] = []
    let made = 0, done = 0
    const total = (2 ** PARCHMENT_ZOOM) ** 2
    const tile = async (zoom: number, column: number, row: number): Promise<Uint8Array | undefined> => {
      let rgb: Uint8Array | undefined
      if (zoom === PARCHMENT_ZOOM) {
        rgb = wanted(column, row) ? await making({ zoom, column, row, file: fileOf(zoom, column, row) }) : undefined
        onProgress?.(++done, total)
      } else {
        const four = await Promise.all([0, 1, 2, 3].map((i) => tile(zoom + 1, column * 2 + (i & 1), row * 2 + (i >> 1))))
        if (four.every((part) => !part)) return undefined
        rgb = halve(join(four.map((part) => part ?? flat), TILE), TILE * 2)
        kept.push(making({ zoom, column, row, file: fileOf(zoom, column, row), rgb }))
      }
      if (rgb) made++
      return rgb
    }
    if (existsSync(joinPath(folder, MARKER))) rmSync(folder, { recursive: true, force: true })
    await tile(0, 0, 0)
    // Over the cities, closer zooms: every tile that holds some of a city's ground.
    const closer: Record<number, number[][]> = {}
    for (let zoom = PARCHMENT_ZOOM + 1; zoom <= CITY_ZOOM; zoom++) {
      const side = TILE / (2 ** zoom / PER_UNIT), seen = new Set<number>()
      for (let i = 0; i < ground.length; i++) if (around.has(ground[i]!)) seen.add(Math.floor(Math.floor(i / SIDE) / side) * 65536 + Math.floor((i % SIDE) / side))
      closer[zoom] = [...seen].map((key) => [key % 65536, Math.floor(key / 65536)])
      for (const [column, row] of closer[zoom]!) kept.push(making({ zoom, column: column!, row: row!, file: fileOf(zoom, column!, row!) }).then((rgb) => rgb && made++))
    }
    await Promise.all(kept)
    mkdirSync(folder, { recursive: true })
    writeFileSync(joinPath(folder, MARKER), JSON.stringify({ tiles: made, format: FORMAT, sea: [...sea].map(Math.round), closer }))
    return made
  } finally {
    for (const t of threads) void t.terminate()
  }
}
