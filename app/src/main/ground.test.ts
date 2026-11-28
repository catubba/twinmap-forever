import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { levelBytes, LEVELS, MIX_SIDE, TEXTURE_BYTES, unpackGround } from '../shared/ground'
import type { ClientFiles } from './client-files'
import { groundAsked, groundBlock, groundDxt1, groundList, groundMaker, groundPile, groundPlace, pileOf } from './ground'

// a chunk of a game file: its tag written backwards, its size, its data
const chunk = (tag: string, data: Buffer): Buffer => Buffer.concat([Buffer.from([...tag].reverse().join(''), 'latin1'), Buffer.from(new Uint32Array([data.length]).buffer), data])
const numbers = (...n: number[]): Buffer => Buffer.from(new Uint32Array(n).buffer)

// A picture of the game in DXT blocks, every block the same: side pixels, kind as BLP says it (0 DXT1, 1 DXT3, 7 DXT5), with all its smaller copies.
function blp(side: number, kind: number, c0: number, c1: number, choice: number): Buffer {
  const head = Buffer.alloc(148), block = Buffer.alloc(kind === 0 ? 8 : 16), levels: Buffer[] = []
  head.write('BLP2', 0, 'latin1')
  head.writeUInt32LE(1, 4)
  head.set([2, 8, kind, 1], 8)
  head.writeUInt32LE(side, 12)
  head.writeUInt32LE(side, 16)
  block.writeUInt16LE(c0, block.length - 8)
  block.writeUInt16LE(c1, block.length - 6)
  block.writeUInt32LE(choice, block.length - 4)
  for (let s = side, at = 148, l = 0; s >= 1; s >>= 1, l++) {
    const data = Buffer.concat(Array.from({ length: Math.max(1, s >> 2) ** 2 }, () => block))
    head.writeUInt32LE(at, 20 + l * 4)
    head.writeUInt32LE(data.length, 84 + l * 4)
    levels.push(data)
    at += data.length
  }
  return Buffer.concat([head, ...levels])
}
const first = (d: Uint8Array, at = 0): number[] => [d[at]! | (d[at + 1]! << 8), d[at + 2]! | (d[at + 3]! << 8), (d[at + 4]! | (d[at + 5]! << 8) | (d[at + 6]! << 16) | (d[at + 7]! << 24)) >>> 0]

test("a ground texture's colours are copied as DXT1 blocks, every texture the same size", () => {
  // DXT5 with the first colour above the second: as it is
  expect(groundDxt1(blp(256, 7, 0xf800, 0x001f, 0x1b1b1b1b)).length).toBe(TEXTURE_BYTES)
  expect(first(groundDxt1(blp(256, 7, 0xf800, 0x001f, 0x1b1b1b1b)))).toEqual([0xf800, 0x001f, 0x1b1b1b1b])
  // DXT3 with the first below the second, which in DXT1 would mean three colours and a hole: swapped, every choice with them
  expect(first(groundDxt1(blp(256, 1, 0x001f, 0xf800, 0x1b1b1b1b)))).toEqual([0xf800, 0x001f, (0x1b1b1b1b ^ 0x55555555) >>> 0])
  // one colour: the first choice everywhere
  expect(first(groundDxt1(blp(256, 7, 0x0700, 0x0700, 0xffffffff)))).toEqual([0x0700, 0x0700, 0])
  // DXT1 with a hole (the fourth choice of three colours): the colour between in its place
  expect(first(groundDxt1(blp(256, 0, 0x001f, 0xf800, 0xffffffff)))).toEqual([0x001f, 0xf800, 0xaaaaaaaa])
})

test('a larger texture gives its own smaller copies, a smaller one is laid side by side, anything else is one colour', () => {
  // 512: the app's first level is the picture's second, down to the last
  const large = groundDxt1(blp(512, 7, 0xf800, 0x001f, 5))
  expect(first(large)).toEqual([0xf800, 0x001f, 5])
  expect(first(large, TEXTURE_BYTES - 8)).toEqual([0xf800, 0x001f, 5])
  // 128: its blocks fill the first level four times over
  const small = groundDxt1(blp(128, 0, 0xf800, 0x001f, 7))
  expect(first(small, levelBytes(0) - 8)).toEqual([0xf800, 0x001f, 7])
  // not a picture: grey, the same in both colours of every block
  const none = groundDxt1(Buffer.alloc(0))
  expect(none.length).toBe(TEXTURE_BYTES)
  expect(first(none)[0]).toBe(first(none)[1])
  expect(first(none)[2]).toBe(0)
})

test('a pile is level by level', () => {
  const a = groundDxt1(blp(256, 7, 0xf800, 0x001f, 1)), b = groundDxt1(blp(256, 7, 0x07e0, 0x001f, 2))
  const pile = pileOf([a, b])
  expect(pile.length).toBe(2 * TEXTURE_BYTES)
  expect(first(pile)).toEqual([0xf800, 0x001f, 1])
  expect(first(pile, levelBytes(0))).toEqual([0x07e0, 0x001f, 2])
  expect(first(pile, 2 * levelBytes(0))).toEqual([0xf800, 0x001f, 1]) // the second level of the first
})

test('the paths of the ground are told from the others', () => {
  expect(groundAsked('/azeroth/ground.json')).toBe(-1)
  expect(groundAsked('/kalimdor/ground/textures.bin')).toBe(-2)
  expect(groundAsked('/kalimdor/ground/40/31.bin')).toBe(4096 + 31 * 64 + 40)
  expect(groundAsked('/i209/ground.json')).toBe(-1 - (2 + 209))
  expect(groundAsked('/i209/ground/30/31.bin')).toBe((2 + 209) * 4096 + 31 * 64 + 30)
  expect(groundPlace(2 + 209)).toBe('i209')
  expect(groundPlace(1)).toBe('kalimdor')
  expect(groundAsked('/i123456/ground.json')).toBeNull()
  expect(groundAsked('/nowhere/ground.json')).toBeNull()
  expect(groundAsked('/azeroth/ground/../x.bin')).toBeNull()
  expect(groundAsked('/azeroth/buildings.json')).toBeNull()
})

test("the ground is made when first asked for: a continent's textures, then a block's layers and mixes", () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-ground-'))
  try {
    // a continent of one block (column 3, row 2) whose tex0 lists two textures, one of them not in the game
    const maid = Buffer.alloc(64 * 64 * 32)
    maid.writeUInt32LE(500, (2 * 64 + 3) * 32 + 3 * 4)
    const tex0 = Buffer.concat([chunk('MDID', numbers(900, 800)), chunk('MCNK', chunk('MCLY', numbers(1, 0, 0, 0)))])
    const game = new Map<number, Buffer>([[775971, chunk('MAID', maid)], [500, tex0], [800, blp(256, 7, 0xf800, 0x001f, 3)]])
    let reads = 0
    const files = { read: (id: number): Buffer => { reads++; const f = game.get(id); if (!f) throw new Error('no file'); return f } } as unknown as ClientFiles
    const make = groundMaker(() => files, folder)

    expect(make(-1)).toBe(true)
    expect(JSON.parse(readFileSync(groundList(folder, 'azeroth'), 'utf8'))).toEqual({ format: 1, textures: [800, 900] })
    const pile = inflateSync(readFileSync(groundPile(folder, 'azeroth')))
    expect(pile.length).toBe(2 * TEXTURE_BYTES)
    expect(first(pile)).toEqual([0xf800, 0x001f, 3])
    expect(LEVELS).toBe(9)

    expect(make(2 * 64 + 3)).toBe(true)
    const block = unpackGround(inflateSync(readFileSync(groundBlock(folder, 'azeroth', 3, 2))))!
    expect(block.textures).toEqual([900, 800])
    expect(block.layers[0]).toBe(1)
    expect(block.mix.length).toBe(MIX_SIDE * MIX_SIDE * 4)
    // what is there is not made again, and a block of the sea has none
    const before = reads
    expect(make(-1)).toBe(true)
    expect(make(2 * 64 + 3)).toBe(true)
    expect(reads).toBe(before)
    expect(make(5)).toBe(false)

    // a dungeon's the same way, from its own world file, in its own folder
    const dungeon = groundMaker(() => files, folder, (map) => (map === 209 ? 775971 : null))
    expect(dungeon(-1 - (2 + 209))).toBe(true)
    expect(JSON.parse(readFileSync(groundList(folder, 'i209'), 'utf8')).textures).toEqual([800, 900])
    expect(dungeon((2 + 209) * 4096 + 2 * 64 + 3)).toBe(true)
    expect(unpackGround(inflateSync(readFileSync(groundBlock(folder, 'i209', 3, 2))))!.textures).toEqual([900, 800])
    expect(dungeon(-1 - (2 + 33))).toBe(false)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})
