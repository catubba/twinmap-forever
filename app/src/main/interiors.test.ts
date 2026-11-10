import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { expect, test } from 'vitest'
import type { Row, Table } from '../shared/wdc5'
import { EncryptedFileError } from './client-files'
import type { Piece } from '../shared/inside'
import { buildingOf, convertInteriors, finishedInteriors, INTERIORS_FILE, layOut, levelsOf, mapEntries, placedIn, roomPictures, solidBlocks, type Building, type Placed } from './interiors'

const MIDDLE = (32 * 1600) / 3

// A chunk of a game file: its tag written backwards, its size, its data.
function chunk(tag: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.write(tag.split('').reverse().join(''), 'latin1')
  head.writeUInt32LE(data.length, 4)
  return Buffer.concat([head, data])
}

// A building standing somewhere, as a world file lists it.
function standing(file: number, uid: number, u: number, height: number, v: number, turn: number, numbered = true): Buffer {
  const b = Buffer.alloc(64)
  b.writeUInt32LE(file, 0)
  b.writeUInt32LE(uid, 4)
  b.writeFloatLE(u, 8)
  b.writeFloatLE(height, 12)
  b.writeFloatLE(v, 16)
  b.writeFloatLE(turn, 24)
  b.writeUInt16LE(numbered ? 8 : 0, 56)
  b.writeUInt16LE(1024, 62)
  return b
}

// A world file: for each block given, the file of its buildings and the picture of its ground.
function worldFile(blocks: Record<number, { objects?: number; picture?: number }>, whole?: Buffer): Buffer {
  const list = Buffer.alloc(4096 * 32)
  for (const [block, files] of Object.entries(blocks)) {
    list.writeUInt32LE(files.objects ?? 0, Number(block) * 32 + 4)
    list.writeUInt32LE(files.picture ?? 0, Number(block) * 32 + 28)
  }
  return Buffer.concat([chunk('MVER', Buffer.alloc(4)), chunk('MAID', list), ...(whole ? [chunk('MODF', whole)] : [])])
}

// A building: its number and the boxes of its rooms (min x y z, max x y z).
function buildingFile(number: number, rooms: number[][]): Buffer {
  const head = Buffer.alloc(64)
  head.writeUInt32LE(rooms.length, 4)
  head.writeUInt32LE(number, 32)
  const boxes = Buffer.alloc(rooms.length * 32)
  rooms.forEach((box, i) => box.forEach((value, k) => boxes.writeFloatLE(value, i * 32 + 4 + k * 4)))
  return Buffer.concat([chunk('MVER', Buffer.alloc(4)), chunk('MOHD', head), chunk('MOGI', boxes)])
}

// A picture as the game stores a room's: DXT1 blocks, any width and height.
function picture(width: number, height: number, fill = 7): Buffer {
  const f = Buffer.alloc(148 + 1024 + (width * height) / 2, fill)
  f.fill(0, 0, 148)
  f.write('BLP2', 'latin1')
  f[8] = 2
  f[9] = 1
  f.writeUInt32LE(width, 12)
  f.writeUInt32LE(height, 16)
  f.writeUInt32LE(148 + 1024, 20)
  return f
}

const at = (turn: number): Placed => ({ file: 1, u: 17000, v: 17100, height: 50, turn, scale: 1 })
// One room, 30 by 10 yards, its floor 5 yards up.
const ONE_ROOM: Building = { number: 500, rooms: [{ min: [10, 20, 5], max: [40, 30, 15] }] }
const size = (): [number, number] => [64, 32] // pixels: 32 by 16 yards

test('a picture starts at the lowest corner of its room, and the building is turned into the map', () => {
  // Turned 180: the building's x points north (up the map, v falling), its y west (u falling).
  // The middle of the picture is at x 10 + 16, y 20 + 8 of the building.
  const { pieces, dropped } = layOut(at(180), ONE_ROOM, [{ room: 0, across: 0, up: 0, file: 77 }], size)
  expect(dropped).toBe(0)
  expect(pieces).toEqual([{ file: 77, u: 17000 - 28, v: 17100 - 26, width: 32, height: 16, angle: 1.5708, bottom: 55, top: 65, building: 0, level: 0 }])
  // Turned 0: the other way round.
  const other = layOut(at(0), ONE_ROOM, [{ room: 0, across: 0, up: 0, file: 77 }], size).pieces[0]!
  expect([other.u, other.v, other.angle]).toEqual([17000 + 28, 17100 + 26, -1.5708])
  // Turned 270: x points west, y south.
  const quarter = layOut(at(270), ONE_ROOM, [{ room: 0, across: 0, up: 0, file: 77 }], size).pieces[0]!
  expect([quarter.u, quarter.v, quarter.angle]).toEqual([17000 - 26, 17100 + 28, 3.1416])
})

test('a large room is cut in pieces 128 yards apart', () => {
  const large: Building = { number: 500, rooms: [{ min: [0, 0, 0], max: [200, 150, 10] }] }
  const full = (): [number, number] => [256, 256]
  const { pieces } = layOut(at(180), large, [{ room: 0, across: 1, up: 1, file: 78 }], full)
  // Its lowest corner is at x 128, y 128, so its middle at 192, 192.
  expect([pieces[0]!.u, pieces[0]!.v]).toEqual([17000 - 192, 17100 - 192])
})

test('a picture with no room, past its room, or missing is left out and counted', () => {
  const laid = layOut(at(180), ONE_ROOM, [
    { room: 3, across: 0, up: 0, file: 1 }, // the building has one room
    { room: 0, across: 1, up: 0, file: 2 }, // the room is 30 yards wide: no second piece
    { room: 0, across: 0, up: 0, file: 3 }, // no such picture
    { room: 0, across: 0, up: 0, file: 4 },
  ], (file) => (file === 3 ? null : [64, 32]))
  expect(laid.pieces.map((p) => p.file)).toEqual([4])
  expect(laid.dropped).toBe(3)
})

test('the pictures of the one building the table is behind on land on its rooms of today', () => {
  const rooms = Array.from({ length: 76 }, (_, i) => ({ min: [i * 100, 0, 0], max: [i * 100 + 20, 20, 10] }))
  const { pieces, dropped } = layOut(at(180), { number: 21107, rooms }, [31, 35, 40].map((room) => ({ room, across: 0, up: 0, file: room })), size)
  // Room 31 as it is, 35 gone, 40 is now room 33: x from 3300.
  expect(dropped).toBe(1)
  expect(pieces.map((p) => [p.file, 17100 - p.v - 16])).toEqual([[31, 3100], [40, 3300]])
})

test('the buildings of a map come from its blocks, each once, and a map of one building has it in the middle', () => {
  const objects = chunk('MODF', Buffer.concat([standing(900, 1, 17000, 30, 17100, 269), standing(901, 2, 5, 0, 6, 0, false)]))
  const world = worldFile({ 10: { objects: 60 }, 11: { objects: 61 } })
  const placed = placedIn(world, (id) => (id === 60 || id === 61 ? objects : null))
  expect(placed).toEqual([{ file: 900, u: 17000, v: 17100, height: 30, turn: 269, scale: 1 }])
  const [whole] = placedIn(worldFile({}, standing(902, 3, 0, 0, 0, 0)), () => null)
  expect([whole!.file, whole!.u, whole!.v]).toEqual([902, MIDDLE, MIDDLE])
})

test('a building file gives its number and the boxes of its rooms', () => {
  expect(buildingOf(buildingFile(500, [[10, 20, 5, 40, 30, 15]]))).toEqual(ONE_ROOM)
  expect(buildingOf(chunk('MVER', Buffer.alloc(4)))).toBeNull()
})

// A table as wdc5.ts gives it, from plain rows.
function table(rows: { id: number; parent?: number; cells: (number | string)[] }[]): Table {
  return {
    fields: 0,
    encryptedRows: 0,
    rows: rows.map((r): Row => ({ id: r.id, parent: r.parent, int: (f) => Number(r.cells[f] ?? 0), float: () => 0, text: (f) => String(r.cells[f] ?? '') })),
  }
}
const mapRow = (id: number, name: string, kind: number, worldFile: number) => {
  const cells: (number | string)[] = []
  cells[1] = name
  cells[8] = kind
  cells[21] = worldFile
  return { id, cells }
}

test('the tables give the continents, dungeons and raids, and the pictures of each building', () => {
  // Bosses: name, id, map, way of playing, order. The table is not in order, and a map may list a boss twice.
  const fights = table([
    { id: 3, cells: ['Edwin VanCleef', 3, 36, 0, 2000] },
    { id: 1, cells: ["Rhahk'Zor", 1, 36, 0, 0] },
    { id: 2, cells: ['Sneed', 2, 36, 1, 1000] },
    { id: 9, cells: ['Sneed', 9, 36, 198, 1000] },
    { id: 8, cells: ['Someone of another season', 8, 36, 198, 500] },
    { id: 4, cells: ['Onyxia', 4, 249, 9, 0] },
    { id: 5, cells: ['No Longer in Use', 5, 0, 0, 0] },
  ])
  const maps = mapEntries(table([mapRow(0, 'Eastern Kingdoms', 0, 775971), mapRow(36, 'Deadmines', 1, 780605), mapRow(249, "Onyxia's Lair", 2, 789922), mapRow(30, 'Alterac Valley', 3, 790112), mapRow(25, 'Scott Test', 0, 863335)]), fights)
  expect(maps.map((m) => [m.id, m.kind])).toEqual([[0, 'world'], [36, 'dungeon'], [249, 'raid']])
  // In the game's order, the plain way of playing only; a raid that has no plain way keeps what it has.
  expect(maps[1]).toEqual({ id: 36, name: 'Deadmines', kind: 'dungeon', worldFile: 780605, bosses: ["Rhahk'Zor", 'Sneed', 'Edwin VanCleef'] })
  expect([maps[0]!.bosses, maps[2]!.bosses]).toEqual([[], ['Onyxia']])
  // The third column carries a 1 in its high byte.
  const pictures = roomPictures(table([{ id: 1, parent: 500, cells: [0, 0, 256, 211409] }, { id: 2, parent: 500, cells: [21, 1, 257, 211430] }, { id: 3, parent: 814, cells: [2, 0, 256, 9] }]))
  expect(pictures.get(500)).toEqual([{ room: 0, across: 0, up: 0, file: 211409 }, { room: 21, across: 1, up: 1, file: 211430 }])
  expect(pictures.get(814)?.length).toBe(1)
})

test('a dungeon is converted once: its pictures as the game has them, its ground, and the list', () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-interiors-'))
  try {
    const room = picture(64, 32), ground = picture(256, 256, 3)
    const game: Record<number, Buffer> = {
      100: worldFile({ 2080: { objects: 101, picture: 102 } }),
      101: chunk('MODF', standing(900, 1, 17000, 50, 17100, 180)),
      102: ground,
      900: buildingFile(500, [[10, 20, 5, 40, 30, 15], [0, 0, -20, 20, 20, -10]]),
      77: room,
      200: worldFile({}, standing(900, 1, 0, 0, 0, 0)),
    }
    let reads = 0
    const read = (id: number): Buffer | null => {
      reads++
      if (id === 79) throw new EncryptedFileError('0da4670db36fb2a9')
      return game[id] ?? null
    }
    const maps = [
      { id: 36, name: 'Deadmines', kind: 'dungeon' as const, worldFile: 100, bosses: ['Edwin VanCleef'] },
      { id: 43, name: 'Wailing Caverns', kind: 'dungeon' as const, worldFile: 200, bosses: [] },
      { id: 99, name: 'Gone', kind: 'raid' as const, worldFile: 999, bosses: [] },
    ]
    // Room 1 is the lower: its picture is drawn first. File 78 is not in the game, 79 is encrypted.
    const pictures = new Map([[500, [{ room: 0, across: 0, up: 0, file: 77 }, { room: 1, across: 0, up: 0, file: 77 }, { room: 0, across: 0, up: 0, file: 78 }, { room: 0, across: 0, up: 0, file: 79 }]]])
    const made = convertInteriors(maps, pictures, read, folder)

    expect(made.maps.map((m) => [m.id, m.kind, m.ground, m.pieces.length])).toEqual([[36, 'dungeon', 'i36', 2], [43, 'dungeon', null, 2]])
    expect(made.maps[0]!.pieces.map((p) => p.bottom)).toEqual([30, 55])
    expect(made.maps[0]!.bosses).toEqual(['Edwin VanCleef'])
    // The two rooms are far apart on the ground: neither is over the other. Both are of the map's one building.
    expect(made.maps[0]!.pieces.map((p) => [p.level, p.building])).toEqual([[0, 0], [0, 0]])
    expect(made.dropped).toBe(4)
    // The picture is kept as the game has it: the same DXT1 blocks.
    expect(inflateSync(readFileSync(join(folder, 'rooms', '77.dxt')))).toEqual(room.subarray(148 + 1024))
    expect(existsSync(join(folder, 'i36', 'blocks', '32', '32.dxt'))).toBe(true)
    expect(existsSync(join(folder, 'i43'))).toBe(false)
    // What the next start finds: the same list, with nothing read from the game.
    reads = 0
    expect(finishedInteriors(folder)).toEqual(made)
    expect(reads).toBe(0)
    expect(JSON.parse(readFileSync(join(folder, INTERIORS_FILE), 'utf8')).format).toBe(3)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

// The DXT1 blocks of a picture: solid where the plan says "#", see-through elsewhere. One letter is a block of 4 x 4 pixels.
function shape(rows: string[]): Uint8Array {
  const dxt = new Uint8Array(rows.length * rows[0]!.length * 8)
  rows.join('').split('').forEach((c, i) => {
    // First color not the greater, and every pixel the fourth choice: see-through. Else every pixel the first color.
    if (c !== '#') dxt.set([0, 0, 0, 0, 255, 255, 255, 255], i * 8)
    else dxt.set([255, 255, 0, 0, 0, 0, 0, 0], i * 8)
  })
  return dxt
}

test('the solid blocks of a picture are told from its see-through ones', () => {
  expect([...solidBlocks(shape(['#.', '.#']))]).toEqual([1, 0, 0, 1])
})

test('a room is a level up when it covers the ground of a lower one, not when they only meet at a door', () => {
  // Pictures of 8 x 4 blocks: 16 x 8 yards.
  const full = shape(['########', '########', '########', '########'])
  const piece = (file: number, u: number, v: number, bottom: number): Piece => ({ file, u, v, width: 16, height: 8, angle: 0, bottom, top: bottom + 5, building: 0, level: 0 })
  const pieces = [
    piece(1, 100, 100, 0), // the ground floor
    piece(1, 102, 100, 10), // right over it
    piece(1, 104, 100, 20), // and one more over both
    piece(1, 114, 100, 10), // higher than the first, but touching it only along an edge
    piece(1, 100, 100, 2), // on the same ground as the first and almost as low: the same floor
    piece(1, 500, 500, 30), // high up, alone
  ]
  expect(levelsOf(pieces, () => full)).toEqual([0, 1, 2, 0, 0, 0])
  // A picture turned a quarter covers other ground.
  const turned = [piece(1, 100, 100, 0), { ...piece(1, 100, 112, 10), angle: Math.PI / 2 }]
  expect(levelsOf(turned, () => full)).toEqual([0, 0])
  expect(levelsOf(pieces, () => null)).toEqual([0, 0, 0, 0, 0, 0])
})

test('a folder with no list of interiors is not finished', () => {
  expect(finishedInteriors(join(tmpdir(), 'twinmap-no-such-folder'))).toBeNull()
})
