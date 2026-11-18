import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { afterAll, expect, test } from 'vitest'
import { packHeights, SIDE } from '../shared/heights'
import type { Interiors, Piece } from '../shared/inside'
import { BLOCK_YARDS } from '../shared/world'
import { CAVES_FILE, makeCaves, makeUnder } from './caves'
import { heightsFile } from './heights'

const base = mkdtempSync(join(tmpdir(), 'twinmap-caves-test-'))
afterAll(() => rmSync(base, { recursive: true, force: true }))

// One block of the Eastern Kingdoms, column 30 and row 40, level at 100 yards; a mine under it and a house on it.
const u = 30.5 * BLOCK_YARDS, v = 40.5 * BLOCK_YARDS
const room = (building: number, top: number): Piece => ({ file: 1, u, v, width: 20, height: 20, angle: 0, bottom: top - 6, top, building, level: 0 })
const inside: Interiors = { format: 1, dropped: 0, maps: [{ id: 0, name: 'Eastern Kingdoms', kind: 'world', ground: 'azeroth', bosses: [], pieces: [room(3, 80), room(7, 108)] }] }

test('no list while the continent has no heights, and nothing written', () => {
  expect(makeCaves(base, inside)).toBeNull()
  expect(() => readFileSync(join(base, CAVES_FILE))).toThrow()
})

test('the buildings under the ground are listed by continent, once', () => {
  const file = heightsFile(join(base, 'azeroth'), 30, 40)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, deflateSync(packHeights(new Float32Array(SIDE * SIDE).fill(100))))
  expect(makeCaves(base, inside)).toEqual({ 0: [3] })
  expect(JSON.parse(readFileSync(join(base, CAVES_FILE), 'utf8')).worlds).toEqual({ 0: [3] })
  // Made already: the file is what is given back, whatever the rooms say now.
  expect(makeCaves(base, { ...inside, maps: [] })).toEqual({ 0: [3] })
})

test('the rooms inside the ground, each with its floor from the walking grid and the ground over it', () => {
  // The mine's box goes down to 74, one walks at 76; nothing is walked in the house, and it is not under the ground.
  expect(makeUnder(base, inside, { 0: [3] }, () => [76, 300])).toEqual({ 0: [[0, 76, 24]] })
})

test('a room the grid tells nothing of is as far over its bottom as the rooms of its building', () => {
  // Two rooms of the mine side by side: one walked 2 yards over the bottom of its box, the other not walked at all.
  const beside: Piece = { ...room(3, 80), file: 2, u: u + 40 }
  const two: Interiors = { ...inside, maps: [{ ...inside.maps[0]!, pieces: [room(3, 80), beside] }] }
  rmSync(join(base, 'under.json'))
  expect(makeUnder(base, two, { 0: [3] }, (_continent, at) => (at < u + 20 ? [76] : []))).toEqual({ 0: [[0, 76, 24], [1, 76, 24]] })
})
