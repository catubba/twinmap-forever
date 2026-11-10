// Reads the player's own game files, straight from the game's archive (CASC) on their PC. Read
// only: nothing is written there, nothing leaves the PC, and what the game keeps encrypted stays
// unread. The game can be running meanwhile.
//
// The chain, from a file's number to its bytes:
//   .build.info            which build of the product is installed, and its build key
//   Data/config/../<key>   the build's configuration: where its "encoding" and "root" files are
//   Data/data/*.idx        local index: first 9 bytes of an encoded key -> archive, offset, size
//   Data/data/data.NNN     the archives; each record is a 30 byte header and a BLTE container
//   encoding               content key -> encoded key
//   root                   file number -> content key
import { execFileSync } from 'node:child_process'
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { inflateSync } from 'node:zlib'

/** World of Warcraft: Forever, as the game's own files call it. */
export const PRODUCT = 'wowf'

const RECORD_HEADER = 30 // bytes before the BLTE container of a record
const INDEX_ENTRY = 18 // bytes: 9 of key, 5 of archive and offset, 4 of size
const NO_NAMES = 0x10000000 // root block flag: the block carries no name hashes
const EN_US = 2 // root block locale bit

/** A file, or a part of one, that the game keeps encrypted. Twinmap never decrypts. */
export class EncryptedFileError extends Error {
  constructor(readonly keyName: string) {
    super(`this game file is encrypted (key ${keyName}): Twinmap does not read what the game keeps hidden`)
    this.name = 'EncryptedFileError'
  }
}

export interface ClientFiles {
  /** The installed build, as the game shows it: "1.60.1.70862". */
  version: string
  /** Changes with every build: what a cache made from these files is stamped with. */
  buildKey: string
  /** How many files the build lists. */
  count: number
  /** The bytes of a file by its number, or null when the build has no such file. Throws EncryptedFileError. */
  read(id: number): Buffer | null
}

/** The build of the product installed in a game folder, or null when the folder has none. */
export function installedBuild(folder: string): { version: string; buildKey: string } | null {
  const file = join(folder, '.build.info')
  if (!existsSync(file)) return null
  const [head, ...rows] = readFileSync(file, 'utf8').trim().split(/\r?\n/)
  const columns = (head ?? '').split('|').map((c) => c.split('!')[0])
  for (const row of rows) {
    const values = row.split('|')
    const get = (name: string): string => values[columns.indexOf(name)] ?? ''
    if (get('Product') === PRODUCT && get('Build Key')) return { version: get('Version'), buildKey: get('Build Key') }
  }
  return null
}

/**
 * The game folder (the one holding .build.info), given paths that may lie inside one: the program
 * of a running game, an install path from the registry. The first that leads to the product wins.
 */
export function gameFolderFrom(paths: (string | null)[]): string | null {
  for (const path of paths) {
    let dir = path
    while (dir) {
      if (installedBuild(dir)) return dir
      const up = dirname(dir)
      dir = up === dir ? null : up
    }
  }
  return null
}

/** Where the game's installer said it put the game, or null. */
export function registryInstallPath(): string | null {
  try {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\WOW6432Node\\Blizzard Entertainment\\World of Warcraft', '/v', 'InstallPath'], {
      encoding: 'utf8',
      windowsHide: true,
    })
    return /InstallPath\s+REG_SZ\s+(.+)/.exec(out)?.[1]?.trim() ?? null
  } catch {
    return null
  }
}

/** Decodes a BLTE container: chunks stored plain or deflated, one after the other. */
export function decodeBlte(b: Buffer): Buffer {
  if (b.toString('latin1', 0, 4) !== 'BLTE') throw new Error('not a BLTE container')
  const chunk = (c: Buffer): Buffer => {
    const mode = String.fromCharCode(c[0] ?? 0)
    if (mode === 'N') return c.subarray(1)
    if (mode === 'Z') return inflateSync(c.subarray(1))
    if (mode === 'E') throw new EncryptedFileError(Buffer.from(c.subarray(2, 10)).reverse().toString('hex'))
    throw new Error(`BLTE chunk of unknown kind "${mode}"`)
  }
  const headerSize = b.readUInt32BE(4)
  if (!headerSize) return chunk(b.subarray(8))
  const parts: Buffer[] = []
  for (let i = 0, count = b.readUIntBE(9, 3), at = headerSize; i < count; i++) {
    const size = b.readUInt32BE(12 + i * 24)
    parts.push(chunk(b.subarray(at, at + size)))
    at += size
  }
  return Buffer.concat(parts)
}

/** Opens the game files of a game folder. Reads the build's two big tables once: about half a second. */
export function openClientFiles(folder: string): ClientFiles {
  const build = installedBuild(folder)
  if (!build) throw new Error(`no ${PRODUCT} game in ${folder}`)
  const key = build.buildKey
  const config = new Map<string, string>()
  for (const line of readFileSync(join(folder, 'Data', 'config', key.slice(0, 2), key.slice(2, 4), key), 'utf8').split(/\r?\n/)) {
    const at = line.indexOf(' = ')
    if (at > 0) config.set(line.slice(0, at), line.slice(at + 3))
  }
  const encodingKey = config.get('encoding')?.split(' ')[1], rootKey = config.get('root')
  if (!encodingKey || !rootKey) throw new Error('the build configuration names no encoding or root file')

  // The local index: sixteen buckets, the newest file of each, read when first needed.
  const data = join(folder, 'Data', 'data')
  const newest = new Map<number, string>()
  for (const name of readdirSync(data).sort()) {
    const m = /^([0-9a-f]{2})[0-9a-f]{8}\.idx$/i.exec(name)
    if (m) newest.set(parseInt(m[1]!, 16), name) // sorted: a later version replaces an earlier one
  }
  const buckets = new Map<number, Buffer>()
  const entriesOf = (bucket: number): Buffer => {
    let entries = buckets.get(bucket)
    if (!entries) {
      const name = newest.get(bucket)
      entries = Buffer.alloc(0)
      if (name) {
        const file = readFileSync(join(data, name))
        const at = (8 + file.readUInt32LE(0) + 15) & ~15
        entries = file.subarray(at + 8, at + 8 + file.readUInt32LE(at))
      }
      buckets.set(bucket, entries)
    }
    return entries
  }

  const readEncoded = (ekey: Buffer): Buffer | null => {
    const short = ekey.subarray(0, 9)
    let x = 0
    for (const byte of short) x ^= byte
    const entries = entriesOf((x & 15) ^ (x >> 4))
    for (let lo = 0, hi = entries.length / INDEX_ENTRY - 1; lo <= hi; ) {
      const mid = (lo + hi) >> 1, at = mid * INDEX_ENTRY
      const order = entries.compare(short, 0, 9, at, at + 9)
      if (order < 0) lo = mid + 1
      else if (order > 0) hi = mid - 1
      else {
        // Five bytes: the archive number in the top ten bits, the offset in the other thirty.
        const low = entries.readUInt32BE(at + 10)
        const archive = (entries[at + 9]! << 2) | (low >>> 30), offset = low & 0x3fffffff, size = entries.readUInt32LE(at + 14)
        const record = Buffer.alloc(size)
        const fd = openSync(join(data, `data.${String(archive).padStart(3, '0')}`), 'r')
        try {
          readSync(fd, record, 0, size, offset)
        } finally {
          closeSync(fd)
        }
        return decodeBlte(record.subarray(RECORD_HEADER))
      }
    }
    return null
  }

  // Encoding: pages of [key count, 5 bytes of size, content key, encoded keys], found through a page index.
  const encoding = readEncoded(Buffer.from(encodingKey, 'hex'))
  if (!encoding || encoding.toString('latin1', 0, 2) !== 'EN') throw new Error('the encoding file is missing or not one')
  const pageSize = encoding.readUInt16BE(5) * 1024, pages = encoding.readUInt32BE(9)
  const pageIndex = 22 + encoding.readUInt32BE(18), pageData = pageIndex + pages * 32
  const readContent = (ckey: Buffer): Buffer | null => {
    let page = 0
    for (let lo = 0, hi = pages - 1; lo <= hi; ) {
      const mid = (lo + hi) >> 1
      if (encoding.compare(ckey, 0, 16, pageIndex + mid * 32, pageIndex + mid * 32 + 16) <= 0) {
        page = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    for (let at = pageData + page * pageSize, end = at + pageSize; at < end; ) {
      const keys = encoding[at]!
      if (!keys) break
      if (encoding.compare(ckey, 0, 16, at + 6, at + 22) === 0) return readEncoded(encoding.subarray(at + 22, at + 38))
      at += 22 + keys * 16
    }
    return null
  }

  // Root: blocks of file numbers (as steps from the one before) and their content keys.
  const root = readContent(Buffer.from(rootKey, 'hex'))
  if (!root) throw new Error('the root file is missing')
  let at: number, version = 0, total: number, named: number
  if (root.readUInt32LE(4) < 0x100) {
    at = root.readUInt32LE(4)
    version = root.readUInt32LE(8)
    total = root.readUInt32LE(12)
    named = root.readUInt32LE(16)
  } else {
    total = root.readUInt32LE(4)
    named = root.readUInt32LE(8)
    at = 12
  }
  const keyAt = new Map<number, number>() // file number -> where its content key is in the root
  while (at < root.length) {
    const n = root.readUInt32LE(at)
    let flags: number, locale: number
    if (version >= 2) {
      locale = root.readUInt32LE(at + 4)
      flags = (root.readUInt32LE(at + 8) | root.readUInt32LE(at + 12) | (root[at + 16]! << 17)) >>> 0
      at += 17
    } else {
      flags = root.readUInt32LE(at + 4)
      locale = root.readUInt32LE(at + 8)
      at += 12
    }
    const keys = at + n * 4
    for (let i = 0, id = -1; i < n; i++) {
      id += root.readInt32LE(at + i * 4) + 1
      // ponytail: a file in several languages is read in English. Choose by the game's language when texts are shown.
      if (!keyAt.has(id) || locale & EN_US) keyAt.set(id, keys + i * 16)
    }
    at = keys + n * 16 + (total !== named && flags & NO_NAMES ? 0 : n * 8)
  }

  return {
    version: build.version,
    buildKey: key,
    count: keyAt.size,
    read(id) {
      const where = keyAt.get(id)
      return where === undefined ? null : readContent(root.subarray(where, where + 16))
    },
  }
}
