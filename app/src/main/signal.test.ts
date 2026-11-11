import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { BANK, buildFont, CAPACITY, channelInstalled, dataAdvances, hmtx, installChannel, nameOf, send, SLOTS } from './signal'

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

test('a send changes every name in place, keeps the links, and says whether it fitted in the font', () => {
  expect(send(addons, { pin: { m: 1429, x: 43.7, y: 65.8 } })).toEqual({ seq: 1, inFont: true, bytes: 63 })
  for (const i of [0, 500, 5000, BANK - 1]) {
    const got = read(readFileSync(signal(i)))
    expect(got.n).toBe(1)
    expect(JSON.parse(got.data.toString())).toEqual({ seq: 1, prev: 0, parts: { pin: { m: 1429, x: 43.7, y: 65.8 } } })
  }
  expect(statSync(signal(500)).nlink).toBe(1023)
  // Too big: the font carries the number alone, the slots carry everything sent so far.
  const sent = send(addons, { route: 'x'.repeat(1100) })
  expect(sent.inFont).toBe(false)
  expect(read(readFileSync(signal(7000)))).toEqual({ n: 2, data: Buffer.alloc(0) })
  const slot = readFileSync(join(addons, 'TwinmapForever_R17', 'Inbox.lua'), 'utf8')
  expect(slot.startsWith('TwinmapForeverInbox = {["seq"]=2,["parts"]={["pin"]={["m"]=1429,["x"]=43.7,["y"]=65.8},["route"]="xxx')).toBe(true)
  // A part taken away is gone from the slots too.
  expect(send(addons, { route: false }).inFont).toBe(true)
  expect(readFileSync(join(addons, 'TwinmapForever_R01', 'Inbox.lua'), 'utf8')).toBe('TwinmapForeverInbox = {["seq"]=3,["parts"]={["pin"]={["m"]=1429,["x"]=43.7,["y"]=65.8}}}\n')
})

test('the number goes round after 60 and never comes back to 0', () => {
  const numbers = Array.from({ length: 60 }, () => (send(addons, { tick: true }), read(readFileSync(signal(9))).n))
  expect(numbers.slice(0, 3)).toEqual([4, 5, 6])
  expect(numbers.slice(56)).toEqual([60, 1, 2, 3])
})

test('a bank left half made is finished, and nothing is sent before it is whole', async () => {
  unlinkSync(signal(BANK - 1))
  unlinkSync(signal(4000))
  expect(() => send(addons, { pin: false })).toThrow('not installed')
  const before = readFileSync(signal(0))
  expect(await installChannel(addons)).toBe(true)
  expect(existsSync(signal(4000)) && statSync(signal(BANK - 1)).nlink === 1023).toBe(true)
  expect(readFileSync(signal(0)).equals(before), 'a name the game may hold was written again').toBe(true)
})
