import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { createGame } from './game'
import { decodeRow, PROTOCOL, type Block } from './strip'

// Strips the addon really drew, recorded in the simulated game by addon/tests/record.js.
// Each is a string of cells, one digit 0 to 7 (R*4 + G*2 + B) per pixel.
const strips = JSON.parse(readFileSync(join(__dirname, 'strips.fixture.json'), 'utf8')) as Record<
  'session' | 'narrow' | 'protocol2' | 'instance',
  string[]
>

// The pixels of a strip as the capture gives them: blue, green, red, unused.
function pixels(cells: string, on = 255, off = 0): Uint8Array {
  const row = new Uint8Array(cells.length * 4)
  for (let i = 0; i < cells.length; i++) {
    const v = Number(cells[i])
    row.set([v & 1 ? on : off, v & 2 ? on : off, v & 4 ? on : off, 0], i * 4)
  }
  return row
}
const flip = (cells: string, at: number): string => cells.slice(0, at) + ((Number(cells[at]) + 1) % 8) + cells.slice(at + 1)

test('a recorded session decodes to the positions the game reported', () => {
  const game = createGame()
  const readings = strips.session.map((s) => decodeRow(pixels(s)))
  expect(readings.map((r) => r.kind)).toEqual(Array(6).fill('block'))
  expect(readings.map((r) => (r as Block).negative)).toEqual([false, true, false, true, false, true])

  game.feed(readings[0]!, 1000)
  expect(game.state.sections.pos).toEqual({ zone: 'Elwynn Forest', sub: 'Goldshire', map: 1429, x: 42.3, y: 65.7, facing: 90 })
  readings.slice(1).forEach((r) => game.feed(r, 2000))
  expect(game.state.sections.pos).toEqual({ zone: 'Stormwind City', sub: 'Trade District', map: 1453, x: 61.2, y: 70.8, facing: 180 })
  expect(game.state).toMatchObject({ blocks: 3, lost: 0, corrupt: 0, protocol: null, updatedAt: { pos: 2000 } })
})

test('into a dungeon and out: the position says which instance, and where in it while the game tells', () => {
  const game = createGame()
  const seen = strips.instance.map((s) => {
    game.feed(decodeRow(pixels(s)))
    return game.state.sections.pos
  })
  expect(seen).toEqual([
    { zone: 'Elwynn Forest', sub: 'Goldshire', map: 1429, x: 42.3, y: 65.7, facing: 90 },
    { zone: 'The Deadmines', sub: '', facing: 90, inst: { id: 36, name: 'Deadmines', kind: 'party', x: -16, y: -383 } },
    { zone: 'The Deadmines', sub: '', facing: 90, inst: { id: 36, name: 'Deadmines', kind: 'party', x: -64, y: -821 } },
    { zone: 'The Deadmines', sub: '', facing: 90, inst: { id: 36, name: 'Deadmines', kind: 'party' } },
    { zone: 'Westfall', sub: 'Moonbrook', map: 1436, x: 42.3, y: 65.7, facing: 90 },
  ])
})

test('a block read many times while it is up counts once', () => {
  const game = createGame()
  for (const s of strips.session) for (let i = 0; i < 5; i++) game.feed(decodeRow(pixels(s)))
  expect(game.state.blocks).toBe(3)
})

test('colors that are not pure still read: a cell is on above the middle of the two levels on the row', () => {
  const usual = decodeRow(pixels(strips.session[0]!))
  expect(usual.kind).toBe('block')
  expect(decodeRow(pixels(strips.session[0]!, 140, 110))).toEqual(usual)
  // A strip drawn dark and at low contrast, as in the camouflage trials.
  expect(decodeRow(pixels(strips.session[0]!, 30, 10))).toEqual(usual)
  expect(decodeRow(pixels(strips.session[1]!, 11, 10))).toEqual(decodeRow(pixels(strips.session[1]!)))
})

test('an even row, or one with no strip, is no strip', () => {
  expect(decodeRow(new Uint8Array(1920 * 4).fill(20))).toEqual({ kind: 'none' })
  expect(decodeRow(Uint8Array.from({ length: 1920 * 4 }, (_, i) => (i * 37) % 256))).toEqual({ kind: 'none' })
})

test('a section split into several blocks joins back, in whatever order the parts come', () => {
  const zone = 'Città di Roccavento è qui '.repeat(4)
  const readings = strips.narrow.map((s) => decodeRow(pixels(s)))
  expect(readings.length).toBeGreaterThan(1)

  const game = createGame()
  readings.slice(0, -1).forEach((r) => game.feed(r))
  expect(game.state.sections.pos).toBeUndefined()
  game.feed(readings.at(-1)!)
  expect(game.state.sections.pos?.zone).toBe(zone)

  const shuffled = createGame()
  ;[...readings].reverse().forEach((r) => shuffled.feed(r))
  expect(shuffled.state.sections.pos?.zone).toBe(zone)
})

test('a corrupted strip is refused and changes nothing', () => {
  const game = createGame()
  game.feed(decodeRow(pixels(strips.session[0]!)))
  const before = structuredClone(game.state.sections)

  // One wrong cell: in the id, in the data, in the checksum.
  for (const at of [10, 40, 200]) {
    const reading = decodeRow(pixels(flip(strips.session[2]!, at)))
    expect(reading).toEqual({ kind: 'corrupt' })
    game.feed(reading)
  }
  expect(game.state.sections).toEqual(before)
  expect(game.state).toMatchObject({ blocks: 1, corrupt: 3 })
})

test('a row that is not a strip is nothing at all', () => {
  expect(decodeRow(new Uint8Array(1920 * 4))).toEqual({ kind: 'none' })
  expect(decodeRow(new Uint8Array(1920 * 4).fill(255))).toEqual({ kind: 'none' })
  expect(decodeRow(new Uint8Array(0))).toEqual({ kind: 'none' })
  expect(decodeRow(pixels(flip(strips.session[0]!, 0)))).toEqual({ kind: 'none' }) // a broken magic byte
})

test('a strip cut short by a narrow capture is corrupt, not a crash', () => {
  expect(decodeRow(pixels(strips.session[0]!.slice(0, 60)))).toEqual({ kind: 'corrupt' })
})

test('a missing block is counted as lost; the numbers restarting is not a loss', () => {
  const game = createGame()
  const [first, , , , third] = strips.session.map((s) => decodeRow(pixels(s)))
  game.feed(first!)
  game.feed(third!)
  expect(game.state).toMatchObject({ blocks: 2, lost: 1 })
  game.feed(first!) // the interface reloaded
  expect(game.state).toMatchObject({ blocks: 3, lost: 1 })
})

test('an addon with a newer protocol is not read, and the app says to update the app', () => {
  const game = createGame()
  game.feed(decodeRow(pixels(strips.session[0]!)))
  const readings = strips.protocol2.map((s) => decodeRow(pixels(s)))
  expect(readings).toEqual([{ kind: 'protocol', protocol: 2 }, { kind: 'protocol', protocol: 2 }])

  game.feed(readings[0]!)
  game.feed(readings[1]!)
  expect(game.state.protocol, 'two odd readings are not yet believed').toBeNull()
  game.feed(readings[0]!)
  expect(game.state.protocol).toEqual({
    addon: 2,
    app: PROTOCOL,
    update: 'app',
    message: 'The Twinmap Forever addon is newer than this app (protocol 2, this app speaks 1). Update Twinmap.',
  })
  expect(game.state.sections.pos?.zone, 'what was known stays').toBe('Elwynn Forest')

  game.feed(decodeRow(pixels(strips.session[2]!)))
  expect(game.state.protocol, 'a strip it can read clears the message').toBeNull()
})

test('an addon with an older protocol: the app says to update the addon', () => {
  const game = createGame()
  for (let i = 0; i < 3; i++) game.feed({ kind: 'protocol', protocol: 0 })
  expect(game.state.protocol).toMatchObject({ addon: 0, update: 'addon' })
  expect(game.state.protocol?.message).toMatch(/Update the addon from CurseForge\.$/)
})
