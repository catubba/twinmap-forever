// The pictures of the pins of services, ore and herbs, taken from the player's own game and kept
// beside the tiles as PNG files: what the minimap shows for who offers a service, the cursor of
// the game over a herb or a vendor, for a vein the picture of its ore, and for the door of a
// dungeon or a raid the swirl the game's own maps mark it with. Nothing of them is in the app: a
// game without them leaves the map its plain pins.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeBlpCutout, type Cutout } from '../shared/blp'
import { ORE_ITEMS } from '../shared/services'
import { readTable } from '../shared/wdc5'
import type { ClientFiles } from './client-files'
import { encodePng } from './png'

// File numbers of build 1.60.1.70862, found by name in the community's list of files.
/** Interface/Minimap/Tracking: drawn as they are. */
const TRACKING = { flight: 136456, inn: 136458, bank: 136453, auction: 136452, stable: 136466, repair: 136465, class: 136455, profession: 136463, food: 136457, reagents: 136464, ammunition: 136451, poisons: 136462 }
/** Interface/Cursor: the picture beside the pointer. `ore` is for a vein whose ore has no picture. */
const CURSORS = { herbs: 131018, vendors: 131014, ore: 131025 }
const ITEM_FILE = 841626, ITEM_ICON = 7 // the table of the items, and its column with the number of the picture
// The game keeps many small pictures on large sheets. Two tables say where each is: the sheets (their file) and
// the pictures (name, sheet, left, right, top, bottom in pixels of the sheet).
const SHEETS_FILE = 897470, SHEET_PICTURE = 1
const SHEET_PICTURES_FILE = 897532, PICTURE_NAME = 0, PICTURE_SHEET = 2, PICTURE_LEFT = 5, PICTURE_RIGHT = 6, PICTURE_TOP = 7, PICTURE_BOTTOM = 8
/** The swirls of the doors, by the names the game gives them: blue for a dungeon, green for a raid. */
const SWIRLS = ['dungeon', 'raid']
/** Written last in the folder of the icons: the icons there are the ones this app makes. An older folder is made again. */
export const ICONS_MADE = 'made-2'

const SIZE = 32 // of an icon cut from an item's picture: the size of the others
const FRAME = 5 // pixels of border an item's picture has on each side, of 64
const DARK = 56 // the ground behind an item is darker than this in every channel
const POINTER = 11 // the pointer of a cursor fills the corner where x + y is at most this

/** A cursor without its pointer: only the picture that follows it. */
export function withoutPointer({ width, height, rgba }: Cutout): Cutout {
  const out = rgba.slice()
  for (let y = 0; y <= POINTER && y < height; y++) for (let x = 0; x + y <= POINTER && x < width; x++) out[(y * width + x) * 4 + 3] = 0
  return { width, height, rgba: out }
}

/**
 * The thing in the picture of an item, cut from its frame and from the dark ground behind it,
 * at half the size and with a black line around it as the pictures of the minimap have.
 */
export function withoutGround({ width, height, rgba }: Cutout): Cutout {
  const seen = new Uint8Array(width * height), inside = (x: number, y: number): boolean => x >= FRAME && y >= FRAME && x < width - FRAME && y < height - FRAME
  const dark = (i: number): boolean => rgba[i * 4]! < DARK && rgba[i * 4 + 1]! < DARK && rgba[i * 4 + 2]! < DARK
  // The ground is what is dark and reached from the frame: a dark spot inside the thing stays.
  const todo: number[] = []
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!inside(x, y)) { seen[y * width + x] = 1; todo.push(y * width + x) }
  while (todo.length) {
    const i = todo.pop()!, x = i % width, y = (i - x) / width
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const n = ny * width + nx
      if (inside(nx, ny) && !seen[n] && dark(n)) { seen[n] = 1; todo.push(n) }
    }
  }
  // Halved: each pixel the mean of four, a hole counting for nothing.
  const w = width >> 1, h = height >> 1, half = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sum = [0, 0, 0], four = [0, 1, width, width + 1].map((d) => y * 2 * width + x * 2 + d).filter((i) => !seen[i])
    for (const i of four) for (let c = 0; c < 3; c++) sum[c]! += rgba[i * 4 + c]!
    half.set([...sum.map((s) => (four.length ? s / four.length : 0)), four.length * 63.75], (y * w + x) * 4)
  }
  // The black line: every hole beside the thing.
  const lined = half.slice()
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (half[(y * w + x) * 4 + 3]! >= 128) continue
    const beside = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => nx! >= 0 && ny! >= 0 && nx! < w && ny! < h && half[(ny! * w + nx!) * 4 + 3]! >= 128)
    if (beside) lined.set([0, 0, 0, 255], (y * w + x) * 4)
  }
  return { width: w, height: h, rgba: lined }
}

/** A part of a picture: the pixels from left to right (not included) and from top to bottom (not included). */
export function cutOut({ width, rgba }: Cutout, left: number, right: number, top: number, bottom: number): Cutout {
  const w = right - left, h = bottom - top, out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) out.set(rgba.subarray(((top + y) * width + left) * 4, ((top + y) * width + right) * 4), y * w * 4)
  return { width: w, height: h, rgba: out }
}

/** Writes every icon the game has into <folder>/icons; one the game lacks is left out. */
export function writeIcons(files: ClientFiles, folder: string): void {
  const into = join(folder, 'icons')
  mkdirSync(into, { recursive: true })
  const write = (name: string, id: number | undefined, cut: (c: Cutout) => Cutout = (c) => c): void => {
    try {
      const f = id ? files.read(id) : null
      if (!f) return
      const { width, height, rgba } = cut(decodeBlpCutout(f))
      writeFileSync(join(into, `${name}.png`), encodePng(rgba, width, height, 4))
    } catch {
      // A picture stored some other way, or kept hidden: that pin stays plain.
    }
  }
  for (const [name, id] of Object.entries(TRACKING)) write(name, id)
  for (const [name, id] of Object.entries(CURSORS)) write(name, id, withoutPointer)
  let items: ReturnType<typeof readTable> | null = null
  try {
    const table = files.read(ITEM_FILE, true)
    items = table && readTable(table)
  } catch {
    // No table: the veins take the cursor.
  }
  const rows = new Map(items?.rows.map((r) => [r.id, r]))
  for (const [ore, item] of Object.entries(ORE_ITEMS)) {
    const picture = rows.get(item)?.int(ITEM_ICON)
    write(`ore-${ore}`, picture, (c) => (c.width === SIZE * 2 && c.height === SIZE * 2 ? withoutGround(c) : c))
  }
  try {
    const sheets = files.read(SHEETS_FILE, true), pictures = files.read(SHEET_PICTURES_FILE, true)
    const sheetOf = new Map(sheets ? readTable(sheets).rows.map((r) => [r.id, r.int(SHEET_PICTURE)]) : [])
    for (const r of pictures ? readTable(pictures).rows : []) {
      const name = r.text(PICTURE_NAME)
      if (SWIRLS.includes(name)) write(name, sheetOf.get(r.int(PICTURE_SHEET)), (c) => cutOut(c, r.int(PICTURE_LEFT), r.int(PICTURE_RIGHT), r.int(PICTURE_TOP), r.int(PICTURE_BOTTOM)))
    }
  } catch {
    // No tables of the sheets: the doors keep the drawn pin.
  }
  writeFileSync(join(into, ICONS_MADE), '')
}
