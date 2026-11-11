// The app-to-game channel. The game reads a font file at the first use of its name, and a name must
// exist when the game starts, but its content can still change. So next to the addon there is a bank
// of hard-linked font names, changed in place through a few base files; the addon reads one new name
// every few seconds (Inbox.lua). The width of the letter A is a number: a new number means news.
// Small news rides the same font, a byte in the width of each of its other letters. News that does
// not fit, or that the addon missed, is in the slots: small addons the game loads on demand, fresh
// from disk, and only SLOTS of them in one session of its interface.
// Slots adapted from wow-ai, Copyright (c) 2026 chelinho139, MIT License: full text in THIRD-PARTY-LICENSES.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, writeFileSync, writeSync } from 'node:fs'
import { link } from 'node:fs/promises'
import { join } from 'node:path'

const EM = 1000, A_BASE = 100, A_STEP = 50 // same as Inbox.lua
const B_WIDTH = 1000, C_WIDTH = 500 // same as Inbox.lua
const LINKS = 1023 // names one file can have on NTFS
const BASES = 8
export const BANK = BASES * LINKS // same as Inbox.lua
const GLYPHS = 4 // .notdef, A, B, C; then the data letters
const DATA_FIRST = 0xe000 // private use area: no rule of any script applies to these letters
// Measured in the game on 10 November 2026: 1024 letters read in 4 ms, each width off by 7 units at
// most, also at 60,000 units. A byte a letter, 200 units apart, leaves that 14 times over.
const DATA_LETTERS = 1024 // same as Inbox.lua
const D_BASE = 100, D_STEP = 200
/** The bytes of news one font carries: two letters say how wide 0 and 255 are, four carry length and sum. */
export const CAPACITY = DATA_LETTERS - 6
export const SLOTS = 30 // same as Inbox.lua
const SEQ_MAX = 60 // only a change matters: small numbers stay close to the widths measured in the game
const SIGNAL = 'TwinmapForever_Signal' // a folder of its own: an update of the addon must not take the bank away

const advanceOf = (n: number): number => A_BASE + A_STEP * n
export const nameOf = (i: number): string => 'f' + String(i).padStart(4, '0') + '.ttf'
const slotName = (i: number): string => 'TwinmapForever_R' + String(i).padStart(2, '0')
const slotFile = (addons: string, i: number): string => join(addons, slotName(i), 'Inbox.lua')
const outboxFile = (addons: string): string => join(addons, SIGNAL, 'outbox.json')

function u16(...values: number[]): Buffer {
  const b = Buffer.alloc(values.length * 2)
  values.forEach((v, i) => b.writeUInt16BE(v & 0xffff, i * 2))
  return b
}
function u32(...values: number[]): Buffer {
  const b = Buffer.alloc(values.length * 4)
  values.forEach((v, i) => b.writeUInt32BE(v >>> 0, i * 4))
  return b
}
const concat = (...parts: Uint8Array[]): Buffer => Buffer.concat(parts)

function checksum(buf: Buffer): number {
  let sum = 0
  for (let i = 0; i < buf.length; i += 4) {
    let word = 0
    for (let k = 0; k < 4; k++) word = word * 256 + (buf[i + k] ?? 0)
    sum = (sum + word) % 2 ** 32
  }
  return sum
}

// A square: the font engine only needs a valid outline, the text is never seen.
const SQUARE = concat(u16(1, 0, 0, 100, 100, 3, 0), Buffer.from([1, 1, 1, 1]), u16(0, 100, 0, -100), u16(0, 0, 100, 0))

function nameTable(): Buffer {
  const strings: [number, string][] = [[1, 'TwinmapSignal'], [2, 'Regular'], [4, 'TwinmapSignal'], [6, 'TwinmapSignal']]
  const records: Buffer[] = [], blobs: Buffer[] = []
  let offset = 0
  for (const [id, string] of strings) {
    const text = Buffer.from(string, 'utf16le').swap16()
    records.push(u16(3, 1, 0x409, id, text.length, offset))
    blobs.push(text)
    offset += text.length
  }
  return concat(u16(0, strings.length, 6 + 12 * strings.length), ...records, ...blobs)
}

const sumOf = (bytes: Uint8Array): number => bytes.reduce((c, b) => (c * 31 + b) % 65536, 0) // same as Inbox.lua

/** The widths of the data letters for these bytes. No news is length 0, which the addon reads as "no data". */
export function dataAdvances(payload: Uint8Array = new Uint8Array(0)): number[] {
  if (payload.length > CAPACITY) throw new Error(`${payload.length} bytes do not fit in a font (${CAPACITY})`)
  const sum = sumOf(payload)
  const bytes = Buffer.concat([Buffer.from([payload.length >> 8, payload.length & 255, sum >> 8, sum & 255]), payload], DATA_LETTERS - 2)
  return [D_BASE, D_BASE + 255 * D_STEP, ...Array.from(bytes, (v) => D_BASE + D_STEP * v)]
}

/** A font whose letter A is as wide as the number n says; data: one width per data letter. */
export function buildFont(n: number, data: number[]): Buffer {
  const glyphs = GLYPHS + data.length
  // first letter, last letter, glyph minus letter
  const segs = [[65, 67, 1 - 65], [DATA_FIRST, DATA_FIRST + data.length - 1, GLYPHS - DATA_FIRST], [0xffff, 0xffff, 1]] as const
  const log = Math.floor(Math.log2(segs.length))
  const loca = [0]
  for (let g = 0; g < glyphs; g++) loca.push((g * SQUARE.length) / 2)
  const tables: Record<string, Buffer> = {
    'OS/2': concat(u16(1, 500, 400, 5, 0), Buffer.alloc(20), u16(0, 0, 0), Buffer.alloc(10), Buffer.alloc(16), Buffer.from('NONE'), u16(0x40, 65, segs[1][1], 800, -200, 0, 800, 200), u32(1, 0)),
    cmap: concat(
      u16(0, 1, 3, 1), u32(12), u16(4, 16 + 8 * segs.length, 0, 2 * segs.length, 2 << log, log, 2 * segs.length - (2 << log)),
      u16(...segs.map((s) => s[1])), u16(0), u16(...segs.map((s) => s[0])), u16(...segs.map((s) => s[2])), u16(...segs.map(() => 0)),
    ),
    glyf: concat(...Array<Buffer>(glyphs - 1).fill(SQUARE)),
    head: concat(u32(0x00010000, 0x00010000, 0, 0x5f0f3cf5), u16(0, EM), Buffer.alloc(16), u16(0, 0, 100, 100, 0, 8, 2, 0, 0)),
    hhea: concat(u32(0x00010000), u16(800, -200, 0, 65535, 0, 0, 100, 1, 0, 0), Buffer.alloc(8), u16(0, glyphs)),
    hmtx: u16(0, 0, advanceOf(n), 0, B_WIDTH, 0, C_WIDTH, 0, ...data.flatMap((a) => [a, 0])),
    loca: u16(...loca),
    maxp: concat(u32(0x00010000), u16(glyphs, 4, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)),
    name: nameTable(),
    post: concat(u32(0x00030000), Buffer.alloc(28)),
  }
  const tags = Object.keys(tables).sort()
  const header = concat(u32(0x00010000), u16(tags.length, 128, 3, tags.length * 16 - 128))
  let offset = 12 + tags.length * 16
  const dir: Buffer[] = [], body: Buffer[] = []
  for (const tag of tags) {
    const table = tables[tag]!
    dir.push(concat(Buffer.from(tag.padEnd(4)), u32(checksum(table), offset, table.length)))
    const padded = concat(table, Buffer.alloc((4 - (table.length % 4)) % 4))
    body.push(padded)
    offset += padded.length
  }
  const font = concat(header, ...dir, ...body)
  const headOffset = font.readUInt32BE(12 + tags.indexOf('head') * 16 + 8)
  font.writeUInt32BE((0xb1b0afba - checksum(font) + 2 ** 32) % 2 ** 32, headOffset + 8)
  return font
}

/** Where the widths are in a font of ours, and how many bytes. Each width takes 4: .notdef, A (the number), B, C, the data letters. */
export function hmtx(font: Buffer): [number, number] {
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const at = 12 + i * 16
    if (font.toString('latin1', at, at + 4) === 'hmtx') return [font.readUInt32BE(at + 8), font.readUInt32BE(at + 12)]
  }
  throw new Error('not a font of ours')
}

// In place, or a hard link would stop being one. Number and data go in one write: a read that
// catches the moment gets the old ones, or a sum that does not add up, and then a slot has the news.
function writeSignal(dir: string, n: number, payload?: Uint8Array): void {
  const widths = u16(advanceOf(n), 0, B_WIDTH, 0, C_WIDTH, 0, ...dataAdvances(payload).flatMap((a) => [a, 0]))
  for (let b = 0; b < BASES; b++) {
    const fd = openSync(join(dir, nameOf(b * LINKS)), 'r+')
    try {
      const head = Buffer.alloc(12 + 16 * 16)
      readSync(fd, head, 0, head.length, 0)
      writeSync(fd, widths, 0, widths.length, hmtx(head)[0] + 4)
    } finally {
      closeSync(fd)
    }
  }
}

function atomicWrite(file: string, content: string): void {
  writeFileSync(file + '.tmp', content)
  renameSync(file + '.tmp', file)
}

// The slots are code the game runs: only data comes out of here, and no text can leave its string.
function toLua(v: unknown): string {
  if (typeof v === 'string') return '"' + Array.from(Buffer.from(v), (b) => (b >= 32 && b < 127 && b !== 34 && b !== 92 ? String.fromCharCode(b) : '\\' + String(b).padStart(3, '0'))).join('') + '"'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'nil'
  if (typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return '{' + v.map(toLua).join(',') + '}'
  if (typeof v === 'object' && v) return '{' + Object.entries(v).map(([k, x]) => `[${toLua(k)}]=${toLua(x)}`).join(',') + '}'
  return 'nil'
}

/** Everything the game should have now, by part, and the number of the last send. */
interface Outbox {
  seq: number
  parts: Record<string, unknown>
}

function readOutbox(addons: string): Outbox {
  try {
    const read = JSON.parse(readFileSync(outboxFile(addons), 'utf8')) as Partial<Outbox> | null
    if (read && Number.isInteger(read.seq) && typeof read.parts === 'object' && read.parts) return { seq: read.seq!, parts: read.parts }
  } catch {
    // nothing was sent yet
  }
  return { seq: 0, parts: {} }
}

/** Whether the bank and the slots are all in this AddOns folder. */
export const channelInstalled = (addons: string): boolean => existsSync(join(addons, SIGNAL, nameOf(BANK - 1))) && existsSync(slotFile(addons, SLOTS))

/**
 * Puts the bank of font names and the slots into the game's AddOns folder, next to the addon. Does
 * nothing where they already are. True when something was made: the game sees new names only from
 * its next start.
 * ponytail: hard links need NTFS; on another file system this throws and the channel stays off. Copy the files if anyone has the game on one.
 */
export async function installChannel(addons: string): Promise<boolean> {
  if (channelInstalled(addons)) return false
  const dir = join(addons, SIGNAL)
  mkdirSync(dir, { recursive: true })
  const font = buildFont(readOutbox(addons).seq, dataAdvances())
  // A bank left half made is finished, never made again: a running game may already hold its names.
  for (let i = 0; i < BANK; i++) {
    const file = join(dir, nameOf(i))
    if (existsSync(file)) continue
    if (i % LINKS === 0) writeFileSync(file, font)
    else await link(join(dir, nameOf(i - (i % LINKS))), file)
  }
  for (let i = 1; i <= SLOTS; i++) {
    const name = slotName(i)
    mkdirSync(join(addons, name), { recursive: true })
    if (!existsSync(slotFile(addons, i))) writeFileSync(slotFile(addons, i), 'TwinmapForeverInbox = nil\n')
    writeFileSync(join(addons, name, name + '.toc'), [
      '## Interface: 16001',
      `## Title: Twinmap Forever slot ${String(i).padStart(2, '0')}`,
      '## Notes: Carries what Twinmap sends to the game. Loaded on demand; leave it enabled.',
      '## LoadOnDemand: 1',
      '## Dependencies: TwinmapForever',
      '',
      'Inbox.lua',
      '',
    ].join('\r\n'))
  }
  return true
}

/**
 * Sends news to the game. changed: the parts this send changes, by name; false for a part taken away.
 * The addon has it within a few seconds, out of combat. seq: the number of this send, which the
 * addon tells back once it has it. inFont: it went in the font and costs no slot (unless the addon
 * missed the send before it); bytes: how big the news was.
 */
export function send(addons: string, changed: Record<string, unknown>): { seq: number; inFont: boolean; bytes: number } {
  if (!channelInstalled(addons)) throw new Error('the channel is not installed')
  const box = readOutbox(addons)
  const prev = box.seq, seq = (prev % SEQ_MAX) + 1
  for (const [part, value] of Object.entries(changed)) {
    if (value === false) delete box.parts[part]
    else box.parts[part] = value
  }
  // The number first: a send cut short here is then a missed one, which a slot makes good.
  atomicWrite(outboxFile(addons), JSON.stringify({ seq, parts: box.parts }))
  // The slots before the signal: a new number must find the news there.
  const lua = `TwinmapForeverInbox = ${toLua({ seq, parts: box.parts })}\n`
  for (let i = 1; i <= SLOTS; i++) atomicWrite(slotFile(addons, i), lua)
  // prev: an addon that missed a send must not apply this one alone, so it loads a slot instead.
  const news = Buffer.from(JSON.stringify({ seq, prev, parts: changed }))
  const inFont = news.length <= CAPACITY
  writeSignal(join(addons, SIGNAL), seq, inFont ? news : undefined)
  return { seq, inFont, bytes: news.length }
}
