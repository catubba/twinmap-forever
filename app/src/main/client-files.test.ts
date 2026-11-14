import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { EncryptedFileError, gameFolderFrom, installedBuild, openClientFiles, registryInstallPath } from './client-files'

const md5 = (b: Buffer): Buffer => createHash('md5').update(b).digest()
const u32le = (...v: number[]): Buffer => Buffer.concat(v.map((x) => { const b = Buffer.alloc(4); b.writeUInt32LE(x >>> 0); return b }))
const u32be = (...v: number[]): Buffer => Buffer.concat(v.map((x) => { const b = Buffer.alloc(4); b.writeUInt32BE(x >>> 0); return b }))

type Chunk = { mode: 'N' | 'Z' | 'E'; data: Buffer }
const plain = (text: string): Chunk => ({ mode: 'N', data: Buffer.from(text) })
const packed = (text: string): Chunk => ({ mode: 'Z', data: Buffer.from(text) })
const KEY_NAME = '0da4670db36fb2a9'
// An encrypted chunk: key name length, the name with its bytes in reverse, then what only the game can read.
const locked: Chunk = { mode: 'E', data: Buffer.concat([Buffer.from([8]), Buffer.from(KEY_NAME, 'hex').reverse(), Buffer.alloc(20, 7)]) }

function blte(chunks: Chunk[], headerless = false): Buffer {
  const bodies = chunks.map((c) => Buffer.concat([Buffer.from(c.mode), c.mode === 'Z' ? deflateSync(c.data) : c.data]))
  if (headerless) return Buffer.concat([Buffer.from('BLTE'), u32be(0), bodies[0]!])
  const table = bodies.map((b, i) => Buffer.concat([u32be(b.length, chunks[i]!.data.length), md5(b)]))
  return Buffer.concat([Buffer.from('BLTE'), u32be(12 + 24 * chunks.length), Buffer.from([0x0f, 0, 0, chunks.length]), ...table, ...bodies])
}

// bare: the record is the container alone, without the 30 bytes that come before it in most records.
interface FakeFile { id: number; chunks: Chunk[]; headerless?: boolean; locale?: number; bare?: boolean }

/**
 * A game folder built to the format client-files.ts reads: build info, configuration, the sixteen
 * index buckets, one archive, an encoding file and a root file in the old or the new layout.
 */
function fakeClient(files: FakeFile[], rootVersion: 1 | 2): string {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-client-'))
  const data = join(folder, 'Data', 'data')
  mkdirSync(data, { recursive: true })

  const archive: Buffer[] = []
  let offset = 0
  const index: { ekey: Buffer; offset: number; size: number }[] = []
  const contents: { ckey: Buffer; ekey: Buffer }[] = []
  // Stores a container as a record of the archive and lists it in the index.
  const store = (container: Buffer, bare = false): Buffer => {
    const ekey = md5(container), record = bare ? container : Buffer.concat([Buffer.alloc(30), container])
    archive.push(record)
    index.push({ ekey, offset, size: record.length })
    offset += record.length
    return ekey
  }
  const storeContent = (ckey: Buffer, container: Buffer, bare = false): void => { contents.push({ ckey, ekey: store(container, bare) }) }

  // Root: one block per file, so each can have its own language.
  const blocks = files.map((f) => {
    const ckey = md5(Buffer.concat(f.chunks.map((c) => c.data)))
    storeContent(ckey, blte(f.chunks, f.headerless), f.bare)
    const locale = f.locale ?? 2, body = Buffer.concat([u32le(f.id), ckey, Buffer.alloc(8)]) // first step: the number itself
    return rootVersion === 2 ? Buffer.concat([u32le(1, locale, 0, 0), Buffer.from([0]), body]) : Buffer.concat([u32le(1, 0, locale), body])
  })
  const header = rootVersion === 2
    ? Buffer.concat([Buffer.from('TSFM'), u32le(24, 2, files.length, files.length, 0)])
    : Buffer.concat([Buffer.from('TSFM'), u32le(0x1000000, 0x1000000)]) // totals too big to be a header size
  const root = Buffer.concat([header, ...blocks])
  const rootKey = md5(root)
  storeContent(rootKey, blte([{ mode: 'Z', data: root }]))

  // Encoding: one page of content keys in order.
  contents.sort((a, b) => a.ckey.compare(b.ckey))
  const page = Buffer.alloc(4096)
  contents.forEach((c, i) => Buffer.concat([Buffer.from([1, 0, 0, 0, 0, 0]), c.ckey, c.ekey]).copy(page, i * 38))
  const encodingHead = Buffer.alloc(22)
  encodingHead.write('EN', 'latin1')
  encodingHead.set([1, 16, 16], 2)
  encodingHead.writeUInt16BE(4, 5)
  encodingHead.writeUInt16BE(4, 7)
  encodingHead.writeUInt32BE(1, 9)
  const encoding = Buffer.concat([encodingHead, contents[0]!.ckey, Buffer.alloc(16), page])
  const encodingEkey = store(blte([{ mode: 'N', data: encoding }], true))

  writeFileSync(join(data, 'data.000'), Buffer.concat(archive))
  for (let bucket = 0; bucket < 16; bucket++) {
    const mine = index.filter(({ ekey }) => {
      let x = 0
      for (const byte of ekey.subarray(0, 9)) x ^= byte
      return ((x & 15) ^ (x >> 4)) === bucket
    }).sort((a, b) => a.ekey.compare(b.ekey, 0, 9, 0, 9))
    const entries = Buffer.concat(mine.map((e) => Buffer.concat([e.ekey.subarray(0, 9), Buffer.from([0]), u32be(e.offset), u32le(e.size)])))
    const name = bucket.toString(16).padStart(2, '0')
    writeFileSync(join(data, `${name}00000002.idx`), Buffer.concat([u32le(16, 0), Buffer.alloc(24), u32le(entries.length, 0), entries]))
    writeFileSync(join(data, `${name}00000001.idx`), Buffer.concat([u32le(16, 0), Buffer.alloc(24), u32le(0, 0)])) // an older, empty version
  }

  const buildKey = 'ab12' + '0'.repeat(28)
  mkdirSync(join(folder, 'Data', 'config', 'ab', '12'), { recursive: true })
  writeFileSync(join(folder, 'Data', 'config', 'ab', '12', buildKey), `# Build Configuration\n\nroot = ${rootKey.toString('hex')}\nencoding = ${'f'.repeat(32)} ${encodingEkey.toString('hex')}\n`)
  writeFileSync(join(folder, '.build.info'), [
    'Branch!STRING:0|Active!DEC:1|Build Key!HEX:16|Version!STRING:0|Product!STRING:0',
    `eu|1|${'c'.repeat(32)}|12.0.0.1|wow`,
    `eu|1|${buildKey}|1.60.1.70862|wowf`,
  ].join('\n'))
  return folder
}

const FILES: FakeFile[] = [
  { id: 5, chunks: [plain('stored as it is')], headerless: true },
  { id: 1957206, chunks: [packed('deflated, '), plain('then plain, '), packed('then deflated again')] },
  { id: 70000, chunks: [plain('readable start'), locked] },
  { id: 9, chunks: [plain('in English')], locale: 2 },
  { id: 9, chunks: [plain('in German')], locale: 0x20 },
  { id: 77, chunks: [packed('a record with no header before its container')], bare: true },
  { id: 78, chunks: [plain('bare and short')], headerless: true, bare: true },
]

for (const rootVersion of [1, 2] as const) {
  test(`a file is read by its number, whatever its chunks (root layout ${rootVersion})`, () => {
    const client = openClientFiles(fakeClient(FILES, rootVersion))
    expect([client.version, client.buildKey.slice(0, 4), client.count]).toEqual(['1.60.1.70862', 'ab12', 6])
    expect(client.read(5)?.toString()).toBe('stored as it is')
    expect(client.read(1957206)?.toString()).toBe('deflated, then plain, then deflated again')
    expect(client.read(9)?.toString()).toBe('in English')
    expect(client.read(6)).toBeNull()
    // A record that is the container alone is read all the same.
    expect(client.read(77)?.toString()).toBe('a record with no header before its container')
    expect(client.read(78)?.toString()).toBe('bare and short')
  })
}

test('a file with an encrypted part is refused, and the error names the key', () => {
  const client = openClientFiles(fakeClient(FILES, 2))
  expect(() => client.read(70000)).toThrow(EncryptedFileError)
  expect(() => client.read(70000)).toThrow(KEY_NAME)
})

test('asked to skip what is hidden, the encrypted part comes as zeros of its size and the rest is read', () => {
  const client = openClientFiles(fakeClient(FILES, 2))
  const start = Buffer.from('readable start')
  expect(client.read(70000, true)).toEqual(Buffer.concat([start, Buffer.alloc(locked.data.length)]))
})

test('a file the archive does not hold is refused, and the error names the file and the archive', () => {
  const folder = fakeClient(FILES, 2)
  const client = openClientFiles(folder)
  const archive = join(folder, 'Data', 'data', 'data.000'), whole = readFileSync(archive)
  // Zeros where the files were: listed in the index, not downloaded yet.
  writeFileSync(archive, Buffer.alloc(whole.length))
  expect(() => client.read(5)).toThrow(/^game file 5: not a BLTE container \(data\.000 at \d+, \d+ bytes, starts (00)+\)$/)
  expect(() => openClientFiles(folder)).toThrow(/^encoding file: not a BLTE container/)
  // An archive cut short.
  writeFileSync(archive, whole.subarray(0, 10))
  expect(() => client.read(5)).toThrow(/^game file 5: data\.000 ends before the file .*not fully downloaded$/)
})

test('the game folder is found from a path inside it, and only if it holds Forever', () => {
  const folder = fakeClient(FILES, 2)
  expect(gameFolderFrom([null, 'Z:\\nowhere\\Wow.exe', join(folder, '_forever_', 'Wow.exe')])).toBe(folder)
  writeFileSync(join(folder, '.build.info'), 'Build Key!HEX:16|Version!STRING:0|Product!STRING:0\nabc|12.0.0.1|wow')
  expect(installedBuild(folder)).toBeNull()
  expect(gameFolderFrom([join(folder, '_forever_', 'Wow.exe')])).toBeNull()
  expect(() => openClientFiles(folder)).toThrow(/no wowf game/)
})

// On a PC with the game: the real archive. UiMap is the table of the 60 maps; 1957206 is its file number.
const real = gameFolderFrom([registryInstallPath()])
test.skipIf(!real)('the real game opens and gives UiMap in under a second', () => {
  const started = performance.now()
  const client = openClientFiles(real!)
  const table = client.read(1957206)!
  const ms = performance.now() - started
  console.log(`real client ${client.version}: ${client.count} files, UiMap ${table.length} bytes, ${ms.toFixed(0)} ms`)
  expect(table.toString('latin1', 0, 4)).toBe('WDC5')
  expect(table.readUInt32LE(136)).toBe(60) // records
  expect(ms).toBeLessThan(1000)
})
