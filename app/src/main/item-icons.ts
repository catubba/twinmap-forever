// The pictures of the items, from the player's own game: made the first time a screen asks for one
// and kept as PNG files in <folder>/items, beside the tiles of the build, so the game's archive is
// opened for an item once. An item with no picture the game can give gets an <item>.none, and is not
// looked for again. Nothing of them is in the app (product.md, M10-F1).
//
// Most items name their picture in the table Item; the others (0 there) have it on their look: the
// item's first appearance in ItemModifiedAppearance, and that appearance's picture in ItemAppearance.
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeBlpCutout } from '../shared/blp'
import { readTable } from '../shared/wdc5'
import type { ClientFiles } from './client-files'
import { encodePng } from './png'

export const ITEMS_FOLDER = 'items', PICTURES_FOLDER = 'pictures'
const ITEM_FILE = 841626, ITEM_ICON = 7 // the table of the items, and its column with the number of the picture (icons.ts)
const LOOKS_FILE = 982457, LOOK_ITEM = 1, LOOK_ORDER = 2, LOOK_APPEARANCE = 3 // ItemModifiedAppearance: item, which of its looks, appearance
const APPEARANCES_FILE = 982462, APPEARANCE_ICON = 2 // ItemAppearance: the picture of each appearance
/** What a mark of a missing picture holds. An empty one is from before the appearances were looked at: the item is looked for again. */
const LOOKED = 'item, appearance'

/** Where an item's picture is kept, and the mark of an item that has none. */
export const itemIconFile = (folder: string, item: number): string => join(folder, ITEMS_FOLDER, `${item}.png`)
const noneFile = (folder: string, item: number): string => join(folder, ITEMS_FOLDER, `${item}.none`)

const markedNone = (folder: string, item: number): boolean => existsSync(noneFile(folder, item)) && statSync(noneFile(folder, item)).size > 0

/** Whether the picture of an item was already looked for: made, or known to be missing. */
export const itemIconLooked = (folder: string, item: number): boolean => existsSync(itemIconFile(folder, item)) || markedNone(folder, item)

/** The number of each item's picture: from Item, else from its first look. A table the game does not have adds nothing. */
function picturesOf(files: ClientFiles): Map<number, number> {
  const read = (file: number) => {
    const table = files.read(file, true)
    return table ? readTable(table, (keyName) => files.opens(keyName)).rows : []
  }
  const pictures = new Map(read(ITEM_FILE).map((r) => [r.id, r.int(ITEM_ICON)]))
  const icons = new Map(read(APPEARANCES_FILE).map((r) => [r.id, r.int(APPEARANCE_ICON)]))
  const first = new Map<number, number>() // item -> the order of the look its picture came from
  for (const r of read(LOOKS_FILE)) {
    const item = r.int(LOOK_ITEM), order = r.int(LOOK_ORDER), icon = icons.get(r.int(LOOK_APPEARANCE))
    if (!icon || (pictures.get(item) && !first.has(item)) || (first.get(item) ?? Infinity) <= order) continue
    pictures.set(item, icon)
    first.set(item, order)
  }
  return pictures
}

/**
 * A maker of pictures of the game by their file number, for one build: the spells of the trainers
 * (trainers.json gives each its picture's file). Kept in <folder>/pictures; a file that is no picture gets a .none.
 */
export function gamePictures(files: () => ClientFiles, folder: string): (id: number) => boolean {
  return (id) => {
    const made = join(folder, PICTURES_FOLDER, `${id}.png`), none = join(folder, PICTURES_FOLDER, `${id}.none`)
    if (existsSync(made)) return true
    if (existsSync(none)) return false
    mkdirSync(join(folder, PICTURES_FOLDER), { recursive: true })
    try {
      const f = files().read(id)
      if (f) {
        const { width, height, rgba } = decodeBlpCutout(f)
        writeFileSync(made, encodePng(rgba, width, height, 4))
        return true
      }
    } catch {
      // not a picture, or one stored some other way
    }
    writeFileSync(none, '')
    return false
  }
}

/**
 * A maker of item pictures for one build. files: the game's archive, opened when first needed.
 * The table of the items is read once, at the first item asked. Gives back whether the picture is there.
 */
export function itemIcons(files: () => ClientFiles, folder: string): (item: number) => boolean {
  let pictures: Map<number, number> | null = null
  return (item) => {
    if (existsSync(itemIconFile(folder, item))) return true
    if (markedNone(folder, item)) return false
    mkdirSync(join(folder, ITEMS_FOLDER), { recursive: true })
    try {
      pictures ??= picturesOf(files())
      const picture = pictures.get(item), f = picture ? files().read(picture) : null
      if (f) {
        const { width, height, rgba } = decodeBlpCutout(f)
        writeFileSync(itemIconFile(folder, item), encodePng(rgba, width, height, 4))
        return true
      }
    } catch {
      // A picture stored some other way, or kept hidden: the item goes without.
    }
    writeFileSync(noneFile(folder, item), LOOKED)
    return false
  }
}
