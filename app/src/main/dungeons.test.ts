import { join } from 'node:path'
import { expect, test } from 'vitest'
import { BLOCK_YARDS, BLOCKS } from '../shared/world'
import { standing } from './buildings'
import { dungeonAsked, paintedGround } from './dungeons'
import { servedFile } from './tiles'

test('the lists of a dungeon and the tiles of its ground, and nothing else, ask for it to be made', () => {
  expect(dungeonAsked('/i230/buildings.json')).toBe(230)
  expect(dungeonAsked('/i2959/buildings.json')).toBe(2959)
  expect(dungeonAsked('/azeroth/buildings.json')).toBeNull()
  expect(dungeonAsked('/i230/props.json')).toBe(230)
  expect(dungeonAsked('/i230/props/32-31.bin')).toBeNull()
  expect(dungeonAsked('/i230/../buildings.json')).toBeNull()
  expect(dungeonAsked('/i/buildings.json')).toBeNull()
  expect(dungeonAsked('/i209/levels/2/1/1.bin')).toBe(209)
  expect(dungeonAsked('/i209/under.json')).toBe(209)
  expect(dungeonAsked('/azeroth/levels/2/1/1.bin')).toBeNull()
  expect(dungeonAsked('/i209/heights/31/30.bin')).toBeNull()
})

test('the ground of a dungeon is its painted blocks, without the level one that lies over its rooms', () => {
  const chunk = (tag: string, data: Buffer): Buffer => Buffer.concat([Buffer.from(tag, 'latin1'), Buffer.from(new Uint32Array([data.length]).buffer), data])
  // one piece of ground in the corner of a block, at a height, level or with a rise of 10 yards
  const terrain = (column: number, row: number, height: number, rise: number): Buffer => {
    const head = Buffer.alloc(128), heights = Buffer.alloc(145 * 4)
    head.writeFloatLE((32 - row) * BLOCK_YARDS, 0x68)
    head.writeFloatLE((32 - column) * BLOCK_YARDS, 0x6c)
    head.writeFloatLE(height, 0x70)
    heights.writeFloatLE(rise, 0)
    return chunk('KNCM', Buffer.concat([head, chunk('TVCM', heights)]))
  }
  // blocks 32 48 (hills), 33 48 (level at 78) and 34 48 (level, never painted): files 1 to 3, their textures in 11 and 12
  const maid = Buffer.alloc(BLOCKS * BLOCKS * 32)
  ;[32, 33, 34].forEach((column, k) => {
    maid.writeUInt32LE(k + 1, (48 * BLOCKS + column) * 32)
    maid.writeUInt32LE(k + 11, (48 * BLOCKS + column) * 32 + 12)
  })
  const files = new Map<number, Buffer>([
    [1, terrain(32, 48, 20, 10)], [2, terrain(33, 48, 78, 0)], [3, terrain(34, 48, 78, 0)],
    [11, chunk('DIDM', Buffer.from(new Uint32Array([500, 501]).buffer))], [12, chunk('DIDM', Buffer.from(new Uint32Array([500]).buffer))], [13, chunk('DIDM', Buffer.alloc(0))],
  ])
  const read = (id: number): Buffer | null => files.get(id) ?? null, wdt = chunk('DIAM', maid)
  const room = { file: 1, u: 33.5 * BLOCK_YARDS, v: 48.5 * BLOCK_YARDS, width: 60, height: 40, angle: 0, bottom: -20, top: 40, building: 0, room: 0, level: 0 }
  expect([...paintedGround(wdt, read)]).toEqual([1, 2])
  // a hall wholly under the level block: a lid; one that reaches over it: a floor
  expect([...paintedGround(wdt, read, [room])]).toEqual([1])
  expect([...paintedGround(wdt, read, [{ ...room, top: 90 }])]).toEqual([1, 2])
  // nothing left but one level: no ground at all
  files.set(1, terrain(32, 48, 78, 0))
  expect(paintedGround(wdt, read).size).toBe(0)
})

test('the window is given the buildings and objects of a dungeon from its own folder', () => {
  const base = join('C:', 'data', 'tiles', 'abc')
  expect(servedFile(base, '/i230/buildings.json')).toBe(join(base, 'i230', 'buildings.json'))
  expect(servedFile(base, '/i230/props.json')).toBe(join(base, 'i230', 'props.json'))
  expect(servedFile(base, '/i230/props/32-31.bin')).toBe(join(base, 'i230', 'props', '32-31.bin'))
  expect(servedFile(base, '/i23x/buildings.json')).toBeNull()
  expect(servedFile(base, '/i209/levels/6/31/30.bin')).toBe(join(base, 'i209', 'levels', '6', '31', '30.bin'))
  expect(servedFile(base, '/i209/under.json')).toBe(join(base, 'i209', 'under.json'))
  expect(servedFile(base, '/azeroth/under.json')).toBeNull()
})

test('a map that is one building has it at the middle of the square', () => {
  // the world file's own MODF: file, number, where (x, y, z), turned, numbered not named, not scaled
  const modf = Buffer.alloc(64)
  modf.writeUInt32LE(123456, 0)
  modf.writeUInt32LE(7, 4)
  modf.writeFloatLE(10, 8)
  modf.writeFloatLE(-50, 12)
  modf.writeFloatLE(-20, 16)
  modf.writeFloatLE(180, 24)
  modf.writeUInt16LE(8, 56)
  modf.writeUInt16LE(1024, 62)
  const head = Buffer.alloc(8)
  head.write('FDOM', 0, 'latin1')
  head.writeUInt32LE(64, 4)
  const middle = (BLOCKS / 2) * BLOCK_YARDS
  expect(standing(Buffer.concat([head, modf]), () => null)).toEqual([{ file: 123456, x: 10 + middle, y: -50, z: -20 + middle, turn: 0, scale: 1 }])
})
