import { expect, test } from 'vitest'
import { frameLayout, inFrame, parseHelperLine, readHeader } from './capture-linux-frame'

test('the layout puts header, top band, bottom row, both columns and the snapshot in that order', () => {
  expect(frameLayout(4, 3, 3)).toEqual({ width: 4, height: 3, topRows: 3, top: 24, bottom: 72, left: 88, right: 100, snapshot: 112, length: 160 })
  expect(frameLayout(1920, 1080, 129)).toEqual({ width: 1920, height: 1080, topRows: 129, top: 24, bottom: 990744, left: 998424, right: 1002744, snapshot: 1007064, length: 9301464 })
  expect(frameLayout(100, 50, 50)).not.toBeNull()
})
test('a layout whose band does not match the height, or with bad numbers, is refused', () => {
  for (const [w, h, t] of [[1920, 1080, 128], [100, 50, 129], [0, 10, 10], [1.5, 10, 10], [16385, 10, 10]]) expect(frameLayout(w!, h!, t!)).toBeNull()
})
test('helper lines parse into messages and anything else is ignored', () => {
  expect(parseHelperLine('{"layout":{"width":1920,"height":1080,"topRows":129}}')).toEqual({ layout: { width: 1920, height: 1080, topRows: 129 } })
  expect(parseHelperLine('{"token":null}')).toEqual({ token: null })
  expect(parseHelperLine('{"token":"4f0c2a8e-6a51-4c43-9b7e-1d2f3a4b5c6d"}')).toEqual({ token: '4f0c2a8e-6a51-4c43-9b7e-1d2f3a4b5c6d' })
  expect(parseHelperLine('{"state":"unsupported","why":"no ScreenCast portal"}')).toEqual({ state: 'unsupported', why: 'no ScreenCast portal' })
  for (const bad of ['{"layout":{"width":1920,"height":1080,"topRows":128}}', '{"token":""}', '{"state":"exploded"}', 'not json']) expect(parseHelperLine(bad)).toBeNull()
})
test('a rectangle is in the frame only when wholly inside it', () => {
  const l = { width: 4, height: 3 }
  expect(inFrame(l, 0, 0, 4, 3)).toBe(true)
  expect(inFrame(l, 1, 1, 3, 2)).toBe(true)
  for (const r of [[1, 0, 4, 1], [0, 3, 1, 1], [-1, 0, 1, 1], [0, 0, 0, 1], [0.5, 0, 1, 1]]) expect(inFrame(l, r[0]!, r[1]!, r[2]!, r[3]!)).toBe(false)
})
test('the header reads little-endian counters, session, time and size', () => {
  const b = Buffer.alloc(24); b.writeUInt32LE(7, 0); b.writeUInt32LE(2, 4); b.writeBigUInt64LE(123456789n, 8); b.writeUInt32LE(1920, 16); b.writeUInt32LE(1080, 20)
  expect(readHeader(b)).toEqual({ frames: 7, session: 2, lastFrameMs: 123456789, width: 1920, height: 1080 })
})
test('helper messages reject invalid tokens, reasons and malformed JSON values', () => {
  for (const line of ['null', '[]', '{}', '{"token":"a b"}', '{"token":"\\u007f"}', JSON.stringify({ token: 'a'.repeat(513) }), '{"state":"closed","why":null}', '{"layout":null}']) expect(parseHelperLine(line)).toBeNull()
  expect(parseHelperLine(JSON.stringify({ token: 'a'.repeat(512) }))).toEqual({ token: 'a'.repeat(512) })
  for (const state of ['cancelled', 'refused', 'closed', 'unsupported']) expect(parseHelperLine(JSON.stringify({ state }))).toEqual({ state })
})
test('helper messages reject extra or conflicting keys at every level', () => {
  expect(parseHelperLine('{"token":null,"state":"closed","why":42}')).toBeNull()
  expect(parseHelperLine('{"layout":{"width":4,"height":3,"topRows":3,"extra":1}}')).toBeNull()
  expect(parseHelperLine('{"state":"closed","extra":true}')).toBeNull()
  expect(parseHelperLine('{"state":"closed"}')).toEqual({ state: 'closed' })
})
