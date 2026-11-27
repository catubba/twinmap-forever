import { expect, test } from 'vitest'
import { roomOf } from './buildings'

// a chunk of a game file: its tag written backwards, its size, its data
const chunk = (tag: string, data: Buffer): Buffer => Buffer.concat([Buffer.from([...tag].reverse().join(''), 'latin1'), Buffer.from(new Uint32Array([data.length]).buffer), data])

test('a room keeps its own liquid: the squares that have some, level at the height of its corner', () => {
  // a room of one triangle, with a liquid of 2 x 1 squares starting at 10, 20, at height 5: the second square has none
  const head = Buffer.alloc(68)
  head.writeUInt32LE(7, 52) // which liquid
  const liquid = Buffer.alloc(30 + 3 * 2 * 8 + 2)
  ;[3, 2, 2, 1].forEach((n, i) => liquid.writeUInt32LE(n, i * 4))
  ;[10, 20, 5].forEach((v, i) => liquid.writeFloatLE(v, 16 + i * 4))
  liquid.set([64, 15], 30 + 3 * 2 * 8)
  const room = roomOf(chunk('MOGP', Buffer.concat([head, chunk('MOVT', Buffer.from(new Float32Array(9).buffer)), chunk('MOVI', Buffer.from(new Uint16Array([0, 1, 2]).buffer)), chunk('MLIQ', liquid)])))!
  expect(room.liquid?.type).toBe(7)
  expect(room.liquid?.tris.length).toBe(6)
  // the view's axes: east is the file's -y, up its z, south its -x
  expect([...room.liquid!.pos.slice(0, 3)]).toEqual([-20, 5, -10])
  expect(Math.min(...room.liquid!.pos.filter((_, k) => k % 3 === 2))).toBeCloseTo(-10 - 25 / 6, 4)
})
