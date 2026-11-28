import { expect, test } from 'vitest'
import { boxOf, buildingsAt, inPiece, killedIn, nameOfBoss, partAt, partsOf, piecesIn, RARE_BOSSES, roomPixels, yardsInside, YARDS_PER_UNIT, type Piece, buriedBuildings, inRock, rockCut, ROCK_CUT } from './inside'
import { DUNGEON_PINS } from './dungeon-pins'
import { MORE_BOSS_PINS } from './more-boss-pins'

const piece = (over: Partial<Piece>): Piece => ({ file: 1, u: 100, v: 100, width: 32, height: 16, angle: 0, bottom: 0, top: 5, building: 0, room: 0, level: 0, ...over })

test('a unit of the map is a 256th of the square of 64 blocks', () => {
  expect(YARDS_PER_UNIT * 256).toBeCloseTo((64 * 1600) / 3, 6)
})

test('a place inside an instance is counted from the middle of the square: north is up, west is left', () => {
  const middle = (32 * 1600) / 3
  expect(yardsInside({ id: 36, x: 0, y: 0 })).toEqual({ u: middle, v: middle })
  // The entrance of the Deadmines: 16 yards south and 383 east of the middle.
  expect(yardsInside({ id: 36, x: -16, y: -383 })).toEqual({ u: middle + 383, v: middle + 16 })
  expect(yardsInside({ id: 36 })).toBeUndefined()
})

test('a place of the map falls on the picture of a piece, turned as the piece is', () => {
  // Not turned: the picture's top left is 16 yards west and 8 north of its middle.
  expect(inPiece(piece({}), 84, 92)).toEqual([0, 0])
  expect(inPiece(piece({}), 110, 104)).toEqual([26, 12])
  expect(inPiece(piece({}), 117, 100)).toBeNull()
  // Turned a quarter anticlockwise the picture stands 16 wide and 32 tall, and its top left is at the bottom left.
  const turned = piece({ angle: Math.PI / 2 })
  expect(inPiece(turned, 100, 117)).toBeNull()
  expect(inPiece(turned, 107, 100)).not.toBeNull()
  expect(inPiece(turned, 100, 115)!.map(Math.round)).toEqual([1, 8])
  expect(inPiece(piece({}), 100, 115)).toBeNull()
})

test('the pieces of a part of the map, up to a level', () => {
  const pieces = [piece({ file: 1 }), piece({ file: 2, u: 500 }), piece({ file: 3, level: 1 }), piece({ file: 4, level: 2 })]
  expect(piecesIn(pieces, [0, 0, 200, 200]).map((p) => p.file)).toEqual([1, 3, 4])
  expect(piecesIn(pieces, [0, 0, 200, 200], 1).map((p) => p.file)).toEqual([1, 3])
  expect(piecesIn(pieces, [0, 0, 200, 200], 0).map((p) => p.file)).toEqual([1])
  expect(piecesIn(pieces, [300, 0, 600, 200]).map((p) => p.file)).toEqual([2])
  // A piece just past the edge still counts if its corner may reach in.
  expect(piecesIn(pieces, [117, 0, 200, 200]).length).toBe(3)
})

test('the building under a place, and what holds every piece', () => {
  const pieces = [piece({ building: 3 }), piece({ building: 3, u: 130 }), piece({ building: 7, u: 400 })]
  expect([...buildingsAt(pieces, 100, 100)]).toEqual([3])
  expect([...buildingsAt(pieces, 400, 100)]).toEqual([7])
  expect(buildingsAt(pieces, 250, 100).size).toBe(0)
  const box = boxOf(pieces)!
  expect(box[0]).toBeLessThan(84)
  expect(box[2]).toBeGreaterThan(416)
  expect(boxOf([])).toBeNull()
})

test('a room picture decodes with its shape cut out', () => {
  // Two blocks side by side: the left all of one color, the right see-through but for its first pixel.
  const dxt = new Uint8Array(16)
  dxt.set([0x00, 0xf8, 0x00, 0x00, 0, 0, 0, 0], 0) // first color red and the greater: every pixel red
  dxt.set([0x00, 0x00, 0xe0, 0x07, 0xfd, 0xff, 0xff, 0xff], 8) // first color black, second green: pixel 0 the second color, the rest the fourth choice
  const rgba = roomPixels(dxt, 8, 4)
  expect([...rgba.slice(0, 4)]).toEqual([255, 0, 0, 255])
  expect([...rgba.slice(16, 20)]).toEqual([0, 255, 0, 255])
  expect([...rgba.slice(20, 24)]).toEqual([0, 0, 0, 0])
  expect(rgba.filter((_, i) => i % 4 === 3 && rgba[i] === 255).length).toBe(17)
})

test('the bosses killed are those the addon tells of this map, by name however written', () => {
  const section = { map: 34, list: ['Targorr the Dread', "Rhahk'Zor", 7] }
  expect([...killedIn(section, 34)]).toEqual(['targorr the dread', 'rhahk zor'])
  expect(killedIn(section, 34).has(nameOfBoss('Rhahk’Zor'))).toBe(true)
  expect(killedIn(section, 36).size).toBe(0)
  expect(killedIn(section, undefined).size).toBe(0)
  expect(killedIn('nonsense', 34).size).toBe(0)
  // A kill told with the name of the fight marks the creatures whose skull is on the map.
  const fights = (map: number, ...list: string[]): Set<string> => killedIn({ map, list }, map)
  expect(fights(3065, 'Infurnus').has(nameOfBoss('Magmatus'))).toBe(true)
  expect(fights(2999, 'The Butcher').has(nameOfBoss('The Baron'))).toBe(true)
  expect(['Baelog', 'Eric "The Swift"', 'Olaf'].every((dwarf) => fights(70, 'The Lost Dwarves').has(nameOfBoss(dwarf)))).toBe(true)
  expect(fights(230, 'The Seven').has(nameOfBoss("Doom'rel"))).toBe(true)
  expect(['Sneed', "Sneed's Shredder"].every((boss) => fights(36, 'Sneed').has(nameOfBoss(boss)))).toBe(true)
  expect(fights(3065, 'Plunder').has(nameOfBoss('Magmatus'))).toBe(false)
})

test('every rare boss is a boss on the pins, written as the pins have it', () => {
  const pinned = new Set(DUNGEON_PINS.flatMap((d) => d.bosses.map(([name]) => nameOfBoss(name))))
  expect([...RARE_BOSSES].filter((name) => !pinned.has(name))).toEqual([])
  expect(RARE_BOSSES.size).toBe(7)
})

test('the bosses the pins lacked are marked killed by the name the game gives their fight', () => {
  const fights = (map: number, fight: string): Set<string> => killedIn({ map, list: [fight] }, map)
  expect(fights(289, 'Kirtonos').has(nameOfBoss('Kirtonos the Herald'))).toBe(true)
  expect(fights(289, 'Ras Frostwhisperer').has(nameOfBoss('Ras Frostwhisper'))).toBe(true)
  // Those placed by the players' kills, by the number of their fight, in every language.
  for (const [map, id] of [[109, 3587], [109, 3588], [129, 2781], [230, 230], [230, 2791], [2959, 3301], [2959, 3310], [2959, 3311]]) {
    const pin = MORE_BOSS_PINS.find(([m, name]) => m === map && killedIn({ map, list: [], ids: [id] }, map).has(nameOfBoss(name)))
    expect(pin, `fight ${id}`).toBeDefined()
  }
  // And none of them is a pin twice.
  const pinned = new Set(DUNGEON_PINS.flatMap((d) => d.bosses.map(([name]) => `${d.map} ${nameOfBoss(name)}`)))
  expect(MORE_BOSS_PINS.filter(([map, name]) => pinned.has(`${map} ${nameOfBoss(name)}`))).toEqual([])
})

test('a kill in a game in another language marks its boss by the number of the fight', () => {
  // Die Todesminen: the names are German, the numbers those of every game.
  const killed = killedIn({ map: 36, list: ['Schnitter', 'Kapitän Grünhaut'], ids: [2742, 2744] }, 36)
  expect(['Sneed', "Sneed's Shredder", 'Captain Greenskin'].every((boss) => killed.has(nameOfBoss(boss)))).toBe(true)
  // A number the table does not have, or not a number, marks nothing.
  expect(killedIn({ map: 36, list: [], ids: [999999, 'x'] }, 36).size).toBe(0)
  // An addon before the numbers: the names alone, as before.
  expect(killedIn({ map: 36, list: ['Cookie'] }, 36).has('cookie')).toBe(true)
})

test('a building counts as under the ground when half of its floor has the terrain over its ceiling', () => {
  const room = (building: number, u: number, top: number, width = 10): Piece => ({ file: 1, u, v: 0, width, height: 10, angle: 0, bottom: top - 5, top, building, room: 0, level: 0 })
  // The terrain: 100 yards high everywhere, 60 east of u = 500, none at all east of u = 900.
  const groundAt = (u: number): number | null => (u >= 900 ? null : u >= 500 ? 60 : 100)
  const pieces = [
    room(0, 0, 80), room(0, 20, 85), // a mine: both rooms under 100
    room(1, 100, 105), room(1, 120, 110), // a house on the ground
    room(2, 480, 80), room(2, 490, 80), room(2, 510, 80, 5), // a mine with its mouth where the terrain falls away
    room(3, 300, 80), room(3, 320, 110, 30), // a cellar under a large house
    room(4, 950, 0), // out at sea, where there is no terrain
    room(5, 200, 99.5), // level with the ground, less than a yard under: not buried
  ]
  expect(buriedBuildings(pieces, groundAt)).toEqual([0, 2])
})

test('a map in groups of rooms far apart is in parts, the one with the most rooms first; near rooms are one part', () => {
  const near = [piece({ u: 100 }), piece({ u: 600 }), piece({ u: 1200 })] // each under 1000 yards from the next
  expect(partsOf(near)).toHaveLength(1)
  expect(partsOf([])).toEqual([])
  const far = [piece({ u: 5000 }), ...near, piece({ u: 5100 }), piece({ u: 5200 }), piece({ u: 5300 })]
  const parts = partsOf(far)
  expect(parts).toHaveLength(2)
  expect(parts[0]![0]).toBeGreaterThan(4900) // the four rooms past 5000 come first
  expect(partAt(parts, { u: 600, v: 100 })).toBe(1)
  expect(partAt(parts, { u: 4000, v: 100 })).toBe(0) // in none: the nearest by its middle
})

test('a dungeon is dug in rock where the ground over its rooms is 50 yards or more over their ceilings, unless its bosses stand on the ground', () => {
  // the ground: 300 high west of u = 1000 (rock over a mine), 40 east of it (a land over cellars)
  const groundAt = (u: number): number | null => (u < 1000 ? 300 : 40)
  // the mine and the cellar 220 and 60 yards under, a hall 30
  const mine = piece({ u: 100, bottom: 0, top: 80, building: 0 }), shallow = piece({ u: 200, bottom: 100, top: 270, building: 1 })
  const cellar = piece({ u: 1100, bottom: -60, top: -20, building: 2 })
  expect([...inRock([mine, shallow, cellar], groundAt, [])]).toEqual([0, 2])
  // bosses with a height: on the ground more than under it, nothing is in rock
  expect(inRock([mine, cellar], groundAt, [[1100, 100, 40], [1150, 100, 38], [100, 100, 2]]).size).toBe(0)
  expect([...inRock([mine, cellar], groundAt, [[1100, 100, 40], [100, 100, 2], [110, 100, 3]])]).toEqual([0, 2])
  // a boss with none is under the ground where a room with its ceiling under the ground is
  expect([...inRock([mine, cellar], groundAt, [[100, 100], [2000, 100]])]).toEqual([0, 2])
})

test('the ground round a room in rock is cut over its floor, rising a yard a yard away from it', () => {
  const rooms = [{ piece: piece({ u: 100, v: 100, width: 20, height: 20 }), floor: 10 }]
  expect(rockCut(rooms, 105, 95)).toBe(10 + ROCK_CUT)
  expect(rockCut(rooms, 140, 100)).toBeCloseTo(10 + ROCK_CUT + 30)
  expect(rockCut([], 100, 100)).toBe(Infinity)
})
