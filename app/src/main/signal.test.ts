import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { BANK, buildFont, CAPACITY, channelInstalled, dataAdvances, hmtx, hear, installChannel, nameOf, send, sendOld, SLOTS } from './signal'

// What the addon does with the widths of a font: the number in the letter A, and the bytes in the data letters.
function read(font: Buffer): { n: number; data: Buffer } {
  const [at, length] = hmtx(font)
  const width = (glyph: number): number => font.readUInt16BE(at + 4 * glyph)
  const w0 = width(4), w255 = width(5)
  const byte = (i: number): number => Math.round(((width(6 + i) - w0) / (w255 - w0)) * 255)
  const size = byte(0) * 256 + byte(1)
  expect(length).toBe(4 * 1028)
  return { n: (width(1) - 100) / 50, data: Buffer.from(Array.from({ length: size }, (_, i) => byte(4 + i))) }
}

let addons: string
const signal = (i: number): string => join(addons, 'TwinmapForever_Signal', nameOf(i))
beforeAll(async () => {
  addons = mkdtempSync(join(tmpdir(), 'twinmap-signal-'))
  expect(channelInstalled(addons)).toBe(false)
  expect(await installChannel(addons), 'something was made: the game must be restarted').toBe(true)
}, 60_000)
afterAll(() => rmSync(addons, { recursive: true, force: true }))

test('a font is a whole TrueType file that carries a number and up to 1018 bytes', () => {
  const news = Buffer.from(Array.from({ length: CAPACITY }, (_, i) => (i * 7) % 256))
  const font = buildFont(42, dataAdvances(news))
  // The sum of the whole file, as the format asks.
  let sum = 0
  for (let i = 0; i < font.length; i += 4) sum = (sum + font.readUInt32BE(i)) % 2 ** 32
  expect(font.length % 4).toBe(0)
  expect(sum).toBe(0xb1b0afba)
  expect(read(font)).toEqual({ n: 42, data: news })
  expect(read(buildFont(0, dataAdvances())).data.length).toBe(0)
  expect(() => dataAdvances(Buffer.alloc(CAPACITY + 1))).toThrow('do not fit')
})

test('the bank and the slots are made once, next to the addon, with no step by hand', async () => {
  expect(readdirSync(join(addons, 'TwinmapForever_Signal')).length).toBe(BANK)
  expect(statSync(signal(1)).nlink, 'the names are hard links').toBe(1023)
  expect(statSync(signal(BANK - 1)).nlink).toBe(1023)
  expect(read(readFileSync(signal(5000)))).toEqual({ n: 0, data: Buffer.alloc(0) })
  expect(readdirSync(addons).length).toBe(1 + SLOTS)
  expect(readFileSync(join(addons, 'TwinmapForever_R30', 'TwinmapForever_R30.toc'), 'utf8')).toContain('## LoadOnDemand: 1\r\n## Dependencies: TwinmapForever\r\n\r\nInbox.lua')
  expect(channelInstalled(addons)).toBe(true)
  expect(await installChannel(addons), 'nothing to make the second time').toBe(false)
})

const told = (i = 9): { n: number; text: string } => {
  const got = read(readFileSync(signal(i)))
  return { n: got.n, text: got.data.toString() }
}
const news = (): Record<string, unknown> => JSON.parse(told().text) as Record<string, unknown>
const PIN = { m: 1429, x: 43.7, y: 65.8 }
let id: string

test('a send changes every name in place and keeps the links; to an addon never heard it tells everything', () => {
  expect(send(addons, { pin: PIN })).toEqual({ seq: 1, pieces: 1, bytes: 36 })
  id = news().id as string
  for (const i of [0, 500, 5000, BANK - 1]) {
    expect(told(i).n).toBe(1)
    expect(JSON.parse(told(i).text)).toEqual({ id, seq: 1, all: true, parts: { pin: PIN } })
  }
  expect(statSync(signal(500)).nlink).toBe(1023)
  expect(existsSync(join(addons, 'TwinmapForever_R17', 'Inbox.lua')) && readFileSync(join(addons, 'TwinmapForever_R17', 'Inbox.lua'), 'utf8'), 'no slot is written').toBe('TwinmapForeverInbox = nil\n')
})

test('once the addon says what it has, a font tells what changed since, whatever was missed between', () => {
  hear(addons, { id, seq: 1 })
  expect(told().n, 'the addon has everything: the font is left alone').toBe(1)
  send(addons, { follow: 7 })
  expect(news()).toEqual({ id, seq: 2, from: 1, parts: { follow: 7 } })
  // Not read yet, and more is sent: the font tells both, and a part taken away as false.
  send(addons, { pin: false, step: 2 })
  expect(news()).toEqual({ id, seq: 3, from: 1, parts: { follow: 7, step: 2, pin: false } })
  // The addon read the font between the two sends: it is told only the second.
  hear(addons, { id, seq: 2 })
  expect(news()).toEqual({ id, seq: 3, from: 2, parts: { step: 2, pin: false } })
  const before = told().n
  hear(addons, { id, seq: 3 })
  hear(addons, { id, seq: 3 })
  expect(told().n, 'nothing to tell: nothing written').toBe(before)
})

test('an addon that follows another history, or is too far behind to be told what was taken away, is told everything', () => {
  hear(addons, { id: 'another', seq: 3 })
  expect(news()).toEqual({ id, seq: 3, all: true, parts: { follow: 7, step: 2 } })
  // Another account of the game, which last heard the first send: that the pin went is no longer kept.
  hear(addons, { id, seq: 1 })
  expect(news()).toEqual({ id, seq: 3, all: true, parts: { follow: 7, step: 2 } })
  hear(addons, { id, seq: 9 })
  expect(news().all, 'ahead of everything sent: an outbox put back from a copy').toBe(true)
  hear(addons, { id, seq: 3 })
})

test('news too big for a font goes in pieces, one for each read of the addon, and what changes meanwhile waits', () => {
  const sent = send(addons, { route: 'é' + 'x'.repeat(3000) })
  expect(sent).toMatchObject({ seq: 4, pieces: 4 })
  const pieces: Buffer[] = []
  for (let i = 1; i <= 4; i++) {
    const got = read(readFileSync(signal(9))).data, line = got.indexOf(10)
    expect(got.subarray(0, line).toString()).toBe(`#${id} 4 ${i} 4`)
    expect(got.length).toBeLessThanOrEqual(CAPACITY)
    pieces.push(got.subarray(line + 1))
    send(addons, { tick: i }) // sent while the pieces go
    expect(read(readFileSync(signal(9))).data.equals(got), 'the piece was written over').toBe(true)
    if (i < 4) hear(addons, { id, seq: 3, got: [4, i] })
  }
  expect(JSON.parse(Buffer.concat(pieces).toString())).toEqual({ id, seq: 4, from: 3, parts: { route: 'é' + 'x'.repeat(3000) } })
  // A /reload in the game loses the pieces held: it says so by telling none, and they start over.
  hear(addons, { id, seq: 3 })
  expect(told().text.startsWith(`#${id} 4 1 4\n`)).toBe(true)
  // Once it has the whole, the rest is told.
  hear(addons, { id, seq: 4 })
  expect(news()).toEqual({ id, seq: 8, from: 4, parts: { tick: 4 } })
  hear(addons, { id, seq: 8 })
})

test('the number in the letter A is new at every write, goes round after 60 and never comes back to 0', () => {
  const first = told().n
  const numbers = Array.from({ length: 60 }, (_, i) => (send(addons, { tick: 100 + i }), told().n))
  expect(numbers[0]).toBe((first % 60) + 1)
  expect(new Set(numbers).size).toBe(60)
  expect(Math.min(...numbers)).toBe(1)
  expect(numbers[59]).toBe(first)
})

test('an addon from before is told the old way: the change alone in the font, everything in the slots', () => {
  const before = told().n, next = (n: number): number => (n % 60) + 1
  const first = sendOld(addons, { pin: PIN })
  expect(first).toMatchObject({ seq: next(before), inFont: true })
  expect(JSON.parse(told(500).text)).toEqual({ seq: first.seq, prev: before, parts: { pin: PIN } })
  // Too big: the font carries the number alone, the slots carry everything sent so far.
  const sent = sendOld(addons, { route: 'x'.repeat(1100) })
  expect(sent.inFont).toBe(false)
  expect(read(readFileSync(signal(7000)))).toEqual({ n: next(first.seq), data: Buffer.alloc(0) })
  expect(readFileSync(join(addons, 'TwinmapForever_R17', 'Inbox.lua'), 'utf8')).toContain(`TwinmapForeverInbox = {["seq"]=${sent.seq},["parts"]={`)
  expect(sendOld(addons, { route: false }).inFont).toBe(true)
  expect(readFileSync(join(addons, 'TwinmapForever_R01', 'Inbox.lua'), 'utf8')).not.toContain('route')
  // An addon of today that comes after it follows a history it was never told: everything.
  send(addons, { route: false })
  expect(news().id).not.toBe(id)
  expect(news().all).toBe(true)
})

test('a bank left half made is finished, and nothing is sent before it is whole', async () => {
  unlinkSync(signal(BANK - 1))
  unlinkSync(signal(4000))
  expect(() => send(addons, { pin: false })).toThrow('not installed')
  const before = readFileSync(signal(0))
  expect(await installChannel(addons)).toBe(true)
  expect(existsSync(signal(4000)) && statSync(signal(BANK - 1)).nlink === 1023).toBe(true)
  expect(readFileSync(signal(0)).equals(before), 'a name the game may hold was written again').toBe(true)
}, 60_000)
