import { join } from 'node:path'
import { expect, test } from 'vitest'
import { BLOCK_YARDS, BLOCKS } from '../shared/world'
import { standing } from './buildings'
import { dungeonAsked } from './dungeons'
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
