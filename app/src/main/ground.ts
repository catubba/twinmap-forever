// The ground's own textures for the 3D view (shared/ground.ts, M23-F8), made when the view first asks for them and
// kept beside the tiles of the build, as the pictures of the items are (item-icons.ts): nothing of them is made with
// the map, so a map made before them needs no making again.
//   <folder>/<continent>/ground.json           the files of the continent's ground textures, in the order of the pile
//   <folder>/<continent>/ground/textures.bin   the pile: every texture as DXT1 with its smaller copies, deflated
//   <folder>/<continent>/ground/<column>/<row>.bin   a block's layers and mixes (packGround), deflated
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { decodeBlpCutout } from '../shared/blp'
import { blockGround, GROUND_FORMAT, groundTextures, levelBytes, LEVELS, packGround, TEXTURE, TEXTURE_BYTES } from '../shared/ground'
import { BLOCKS, groundFiles, WORLDS } from '../shared/world'
import type { ClientFiles } from './client-files'

export const groundList = (folder: string, world: string): string => join(folder, world, 'ground.json')
export const groundPile = (folder: string, world: string): string => join(folder, world, 'ground', 'textures.bin')
export const groundBlock = (folder: string, world: string, column: number, row: number): string => join(folder, world, 'ground', String(column), `${row}.bin`)

/** What a path of the ground asks for, as one number: a continent's textures (-1 less its place in WORLDS) or a block (the place times 4096, plus the block). null: not a path of the ground. */
export function groundAsked(path: string): number | null {
  const m = /^\/([a-z]+)\/ground(?:\.json|\/textures\.bin|\/(\d{1,2})\/(\d{1,2})\.bin)$/.exec(path)
  const world = m ? WORLDS.findIndex((w) => w.name === m[1]) : -1
  if (!m || world < 0) return null
  return m[2] === undefined ? -1 - world : world * BLOCKS * BLOCKS + Number(m[3]) * BLOCKS + Number(m[2])
}

/**
 * A ground texture of the game as DXT1 blocks, TEXTURE pixels a side with all its smaller copies, TEXTURE_BYTES in
 * all: every texture alike, so that all of a continent's lie in one pile on the graphics card. The game keeps nearly
 * all of them at that size as DXT3 or DXT5, whose colours are DXT1 blocks already: those are copied, block by block,
 * and so are their smaller copies. A larger one gives its own smaller copies, a smaller one is laid side by side. Any
 * other picture (a handful) is one flat colour, its average.
 */
export function groundDxt1(f: Buffer): Uint8Array {
  const out = new Uint8Array(TEXTURE_BYTES), view = new DataView(f.buffer, f.byteOffset, f.byteLength), to = new DataView(out.buffer)
  const blp = f.length > 148 && String.fromCharCode(f[0]!, f[1]!, f[2]!, f[3]!) === 'BLP2'
  const kind = f[10]!, width = blp ? view.getUint32(12, true) : 0, height = blp ? view.getUint32(16, true) : 0
  const blocks = blp && f[8] === 2 && (kind === 0 || kind === 1 || kind === 7) && width === height && width >= 4 && !(width & (width - 1))
  let flat: number | null = null
  // one colour for a level the picture does not give: the average of the picture, in the 16 bits of a block's colour
  const average = (): number => {
    if (flat !== null) return flat
    let r = 128, g = 128, b = 128
    try {
      const { rgba } = decodeBlpCutout(f), n = rgba.length / 4
      r = g = b = 0
      for (let i = 0; i < rgba.length; i += 4) ((r += rgba[i]!), (g += rgba[i + 1]!), (b += rgba[i + 2]!))
      ;((r /= n), (g /= n), (b /= n))
    } catch {
      // not a picture read here: grey
    }
    return (flat = (Math.round((r * 31) / 255) << 11) | (Math.round((g * 63) / 255) << 5) | Math.round((b * 31) / 255))
  }
  const step = kind === 0 ? 8 : 16
  for (let level = 0, o = 0; level < LEVELS; level++) {
    const side = TEXTURE >> level, across = Math.max(1, side >> 2)
    // the picture's own copy of that side, or its largest where it is smaller than that
    const from = blocks ? Math.max(0, Math.round(Math.log2(width / side))) : 0, has = Math.max(1, (width >> from) >> 2)
    const at = blocks ? view.getUint32(20 + from * 4, true) : 0, size = blocks ? view.getUint32(84 + from * 4, true) : 0
    const given = blocks && from < 16 && at > 0 && size >= has * has * step && at + has * has * step <= f.length
    for (let by = 0; by < across; by++) {
      for (let bx = 0; bx < across; bx++, o += 8) {
        if (!given) {
          to.setUint16(o, average(), true)
          to.setUint16(o + 2, average(), true)
          continue
        }
        const p = at + ((by % has) * has + (bx % has)) * step + step - 8
        const c0 = view.getUint16(p, true), c1 = view.getUint16(p + 2, true)
        let choice = view.getUint32(p + 4, true)
        if (kind === 0) {
          // DXT1 with the first colour not above the second: the fourth choice is a hole, here the colour between
          if (c0 <= c1) for (let i = 0; i < 32; i += 2) if (((choice >>> i) & 3) === 3) choice = (choice & ~(3 << i)) | ((c0 === c1 ? 0 : 2) << i)
          to.setUint16(o, c0, true)
          to.setUint16(o + 2, c1, true)
        } else if (c0 === c1) {
          // one colour: in DXT1 the first choice
          to.setUint16(o, c0, true)
          to.setUint16(o + 2, c1, true)
          choice = 0
        } else {
          // DXT3 and DXT5 always have four colours, DXT1 only with the first above the second: swapped where it is not
          to.setUint16(o, Math.max(c0, c1), true)
          to.setUint16(o + 2, Math.min(c0, c1), true)
          if (c0 < c1) choice ^= 0x55555555
        }
        to.setUint32(o + 4, choice >>> 0, true)
      }
    }
  }
  return out
}

/** Textures made by groundDxt1 as one pile: level by level, as the graphics card takes a pile of pictures. */
export function pileOf(textures: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(textures.length * TEXTURE_BYTES)
  for (let level = 0, from = 0, o = 0; level < LEVELS; from += levelBytes(level++)) for (const t of textures) (out.set(t.subarray(from, from + levelBytes(level)), o), (o += levelBytes(level)))
  return out
}

/**
 * Makes what the view asks of the ground (groundAsked) where the folder does not have it yet: true when it is there
 * after. A continent's textures take a few seconds, every block of it being looked at for the ones it lists.
 */
export function groundMaker(files: () => ClientFiles, folder: string): (asked: number) => boolean {
  const read = (id: number): Buffer | null => {
    try {
      return id ? files().read(id) : null
    } catch {
      return null
    }
  }
  const lists = new Map<number, Map<number, number>>()
  const blocksOf = (world: number): Map<number, number> => {
    let list = lists.get(world)
    if (!list) {
      const wdt = read(WORLDS[world]!.file)
      lists.set(world, (list = wdt ? groundFiles(wdt) : new Map()))
    }
    return list
  }
  const keep = (file: string, bytes: Uint8Array | string): void => {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, bytes)
  }
  return (asked) => {
    try {
      if (asked < 0) {
        const world = -1 - asked, name = WORLDS[world]?.name
        if (!name) return false
        if (existsSync(groundList(folder, name)) && existsSync(groundPile(folder, name))) return true
        const all = new Set<number>()
        for (const file of blocksOf(world).values()) for (const t of groundTextures(read(file) ?? new Uint8Array())) if (t) all.add(t)
        const textures = [...all].sort((a, b) => a - b)
        keep(groundPile(folder, name), deflateSync(pileOf(textures.map((t) => groundDxt1(read(t) ?? Buffer.alloc(0))))))
        keep(groundList(folder, name), JSON.stringify({ format: GROUND_FORMAT, textures }))
        return true
      }
      const world = Math.floor(asked / (BLOCKS * BLOCKS)), block = asked % (BLOCKS * BLOCKS), name = WORLDS[world]?.name
      if (!name) return false
      const file = groundBlock(folder, name, block % BLOCKS, Math.floor(block / BLOCKS))
      if (existsSync(file)) return true
      const tex0 = read(blocksOf(world).get(block) ?? 0), ground = tex0 && blockGround(tex0)
      if (!ground) return false
      keep(file, deflateSync(packGround(ground)))
      return true
    } catch {
      return false
    }
  }
}
