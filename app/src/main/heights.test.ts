import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { BLOCK_YARDS } from '../shared/world'
import { convertHeights, heightsDone, heightsFile, LEVELS_VERSION, levelsFile, RELIEF_VERSION, shadeFile } from './heights'
import { servedFile } from './tiles'

const chunk = (tag: string, data: Buffer): Buffer => {
  const head = Buffer.alloc(8)
  head.write(tag, 'latin1')
  head.writeUInt32LE(data.length, 4)
  return Buffer.concat([head, data])
}

test('a continent gets its heights and its relief, down to the tile of the whole world, once', () => {
  // One block, 32 48, with one chunk of level ground in its corner; file 7 is its terrain.
  const maid = Buffer.alloc(64 * 64 * 32)
  maid.writeUInt32LE(7, (48 * 64 + 32) * 32)
  maid.writeUInt32LE(8, (48 * 64 + 33) * 32) // listed, but the game has no such file
  const head = Buffer.alloc(128)
  head.writeFloatLE((32 - 48) * BLOCK_YARDS, 0x68)
  head.writeFloatLE(0, 0x6c)
  const adt = chunk('KNCM', Buffer.concat([head, chunk('TVCM', Buffer.alloc(145 * 4))]))
  const folder = mkdtempSync(join(tmpdir(), 'heights-'))
  try {
    const steps: number[] = []
    expect(convertHeights(chunk('DIAM', maid), (id) => (id === 7 ? adt : null), folder, (done) => steps.push(done))).toEqual({ blocks: 1, missing: 1 })
    expect(steps.at(-1)).toBe(4)
    expect(existsSync(heightsFile(folder, 32, 48))).toBe(true)
    for (const zoom of [6, 3, 0]) expect(existsSync(shadeFile(folder, zoom, 32 >> (6 - zoom), 48 >> (6 - zoom))), `zoom ${zoom}`).toBe(true)
    expect(existsSync(shadeFile(folder, 6, 33, 48))).toBe(false)
    for (const zoom of [6, 5, 0]) expect(existsSync(levelsFile(folder, zoom, 32 >> (6 - zoom), 48 >> (6 - zoom))), `3D zoom ${zoom}`).toBe(true)
    expect(existsSync(levelsFile(folder, 6, 33, 48))).toBe(false)
    expect(heightsDone(folder)).toBe(true)
    expect(convertHeights(chunk('DIAM', maid), () => null, folder)).toEqual({ blocks: -1, missing: -1 })
    // A relief drawn another way before: made again, the old tiles gone.
    const marker = join(folder, 'heights', 'done.json')
    writeFileSync(marker, JSON.stringify({ blocks: 1, missing: 1, relief: 1 }))
    mkdirSync(join(folder, 'shade', '6', '40'), { recursive: true })
    writeFileSync(shadeFile(folder, 6, 40, 40), 'old')
    expect(heightsDone(folder)).toBe(false)
    expect(convertHeights(chunk('DIAM', maid), (id) => (id === 7 ? adt : null), folder)).toEqual({ blocks: 1, missing: 1 })
    expect(existsSync(shadeFile(folder, 6, 40, 40))).toBe(false)
    expect(existsSync(shadeFile(folder, 0, 0, 0))).toBe(true)
    expect(JSON.parse(readFileSync(marker, 'utf8')).relief).toBe(RELIEF_VERSION)
    // 3D tiles made another way before: they alone are made again, the relief left as it is.
    writeFileSync(marker, JSON.stringify({ blocks: 1, missing: 1, relief: RELIEF_VERSION }))
    writeFileSync(shadeFile(folder, 0, 0, 0), 'kept')
    expect(convertHeights(chunk('DIAM', maid), (id) => (id === 7 ? adt : null), folder)).toEqual({ blocks: 1, missing: 1 })
    expect(readFileSync(shadeFile(folder, 0, 0, 0), 'utf8')).toBe('kept')
    expect(existsSync(levelsFile(folder, 0, 0, 0))).toBe(true)
    expect(JSON.parse(readFileSync(marker, 'utf8')).levels).toBe(LEVELS_VERSION)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

test('the relief and the parchment are served from their folders, and nothing beside them', () => {
  const base = join(tmpdir(), 'build')
  expect(servedFile(base, '/azeroth/parchment/7/130/98.png')).toBe(join(base, 'azeroth', 'parchment', '7', '130', '98.png'))
  expect(servedFile(base, '/azeroth/shade/6/32/48.png')).toBe(shadeFile(join(base, 'azeroth'), 6, 32, 48))
  expect(servedFile(base, '/azeroth/levels/6/32/48.bin')).toBe(levelsFile(join(base, 'azeroth'), 6, 32, 48))
  for (const path of ['/azeroth/shade/../6/1/1.png', '/azeroth/heights/32/48.bin', '/azeroth/shade/12/1/1.png', '/azeroth/levels/6/../1.bin', '/i33/levels/6/1/1.bin', '/azeroth/parchment/../1/1/1.png', '/azeroth/parchment/done.json']) expect(servedFile(base, path), path).toBeNull()
})
