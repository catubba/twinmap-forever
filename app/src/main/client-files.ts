// Reads the player's own game files, straight from the game's archive (CASC) on their PC. Read
// only: nothing is written there, nothing leaves the PC. What the game keeps encrypted stays unread,
// but for the parts whose key the server has already sent to this PC (keys.ts). The game can be
// running meanwhile.
//
// The chain, from a file's number to its bytes:
//   .build.info            which build of the product is installed, and its build key
//   Data/config/../<key>   the build's configuration: where its "encoding" and "root" files are
//   Data/data/*.idx        local index: first 9 bytes of an encoded key -> archive, offset, size
//   Data/data/data.NNN     the archives; each record is a 30 byte header and a BLTE container.
//                          On some installs a record is the container alone, with no header
//                          (seen on a player's PC, issue 116): told by where the container starts
//   encoding               content key -> encoded key
//   root                   file number -> content key
import { wineInstallPaths } from './wine-prefixes'
import { execFileSync } from 'node:child_process'
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { salsa20 } from '../shared/salsa20'

/** World of Warcraft: Forever, as the game's own files call it. */
export const PRODUCT = 'wowf'

const KEY_NAMES_FILE = 1302851 // the game's table of the names of its keys
const RECORD_HEADER = 30 // bytes before the BLTE container of a record
const INDEX_ENTRY = 18 // bytes: 9 of key, 5 of archive and offset, 4 of size
const NO_NAMES = 0x10000000 // root block flag: the block carries no name hashes
const EN_US = 2 // root block locale bit

/** A file, or a part of one, that the game keeps encrypted and the server has sent this PC no key for. */
export class EncryptedFileError extends Error {
  constructor(readonly keyName: string) {
    super(`this game file is encrypted (key ${keyName}) and the game has not been given its key`)
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
  /**
   * The bytes of a file by its number, or null when the build has no such file. Throws
   * EncryptedFileError, unless skipHidden: then the parts still locked come as zeros,
   * unread (a table says which of its sections those are, and wdc5.ts leaves them out).
   */
  read(id: number, skipHidden?: boolean): Buffer | null
  /** Whether the parts locked with the key of this name are opened: the server has sent the key to this PC. */
  opens(keyName: string): boolean
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
  if (process.platform !== 'win32') return null
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

/** Common install locations, in the order they are checked for the Forever build. */
export function gameInstallPaths(): (string | null)[] {
  if (process.platform === 'linux') return wineInstallPaths()
  if (process.platform !== 'darwin') return [registryInstallPath()]
  return ['/Applications/World of Warcraft', join(homedir(), 'Applications', 'World of Warcraft')].filter((folder) => existsSync(folder))
}

/**
 * Decodes a BLTE container: chunks stored plain or deflated, one after the other. An encrypted
 * chunk is opened with the key keyOf gives for its name; with none it throws, or with skipHidden
 * it comes as zeros of its plain size.
 */
export function decodeBlte(b: Buffer, skipHidden = false, keyOf: (keyName: string) => Buffer | null = () => null): Buffer {
  if (b.toString('latin1', 0, 4) !== 'BLTE') throw new Error('not a BLTE container')
  const chunk = (c: Buffer, plainSize?: number, index = 0): Buffer => {
    const mode = String.fromCharCode(c[0] ?? 0)
    if (mode === 'N') return c.subarray(1)
    if (mode === 'Z') return inflateSync(c.subarray(1))
    if (mode === 'E') {
      // After the mode: the size of the key's name (8) and the name, the size of the nonce and the
      // nonce, the cipher ("S" for Salsa20), the data. The nonce is changed by the chunk's place in the file.
      const keyName = Buffer.from(c.subarray(2, 10)).reverse().toString('hex'), nonceSize = c[10] ?? 0
      const key = c[1] === 8 && nonceSize <= 8 && c[11 + nonceSize] === 0x53 ? keyOf(keyName) : null
      if (key) {
        const nonce = Buffer.alloc(8)
        c.copy(nonce, 0, 11, 11 + nonceSize)
        for (let k = 0; k < 4; k++) nonce[k]! ^= (index >>> (8 * k)) & 255
        return chunk(salsa20(key, nonce, c.subarray(12 + nonceSize)), plainSize, index)
      }
      if (skipHidden && plainSize !== undefined) return Buffer.alloc(plainSize)
      throw new EncryptedFileError(keyName)
    }
    throw new Error(`BLTE chunk of unknown kind "${mode}"`)
  }
  const headerSize = b.readUInt32BE(4)
  if (!headerSize) return chunk(b.subarray(8))
  const parts: Buffer[] = []
  for (let i = 0, count = b.readUIntBE(9, 3), at = headerSize; i < count; i++) {
    const size = b.readUInt32BE(12 + i * 24)
    parts.push(chunk(b.subarray(at, at + size), b.readUInt32BE(16 + i * 24), i))
    at += size
  }
  return Buffer.concat(parts)
}

/**
 * Opens the game files of a game folder. Reads the build's two big tables once: about half a second.
 * keys: the keys the server has sent to this PC, by the game's number of each (keys.ts); with them
 * the parts they lock are read like the rest.
 */
/** The language of the game's words, as its settings file says; null when it does not. */
export function gameLocale(gameFolder: string): string | null {
  try {
    return /^SET textLocale "([a-z]{2}[A-Z]{2})"/m.exec(readFileSync(join(gameFolder, '_forever_', 'WTF', 'Config.wtf'), 'utf8'))?.[1] ?? null
  } catch {
    return null
  }
}

/** The root's bit for each language of the game (its textLocale), as the archive marks a file written in it. */
export const LOCALE_BITS: Record<string, number> = {
  enUS: 0x2, koKR: 0x4, frFR: 0x10, deDE: 0x20, zhCN: 0x40, esES: 0x80, zhTW: 0x100, enGB: 0x200, esMX: 0x1000, ruRU: 0x2000, ptBR: 0x4000,
}

/** The game's files; one written in several languages is read in `locale` (the game's own), else in English, else in one the PC holds. */
export function openClientFiles(folder: string, keys: Map<number, Buffer> = new Map(), locale = 'enUS'): ClientFiles {
  const wanted = LOCALE_BITS[locale] ?? EN_US
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

  // A locked part names its key; the game's table of key names gives the number the key goes by.
  let numbers: Map<string, number> | undefined
  const keyOf = (keyName: string): Buffer | null => {
    if (!keys.size) return null
    if (!numbers) {
      numbers = new Map() // set first: reading the table of names must not ask for a key
      const table = files.read(KEY_NAMES_FILE, true)
      if (table && table.toString('latin1', 0, 4) === 'WDC5' && table.readUInt32LE(144) === 8) {
        // Each row is the 8 bytes of a name; the rows' numbers follow the rows and the texts of their section.
        for (let s = 0, sections = table.readUInt32LE(200); s < sections; s++) {
          const p = 204 + s * 40, rows = table.readUInt32LE(p + 8), count = table.readUInt32LE(p + 12), ids = rows + count * 8 + table.readUInt32LE(p + 16)
          for (let i = 0; i < count; i++) numbers.set(Buffer.from(table.subarray(rows + i * 8, rows + i * 8 + 8)).reverse().toString('hex'), table.readUInt32LE(ids + i * 4))
        }
      }
    }
    const number = numbers.get(keyName)
    return number === undefined ? null : keys.get(number) ?? null
  }

  const readEncoded = (ekey: Buffer, skipHidden = false): Buffer | null => {
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
        const record = Buffer.alloc(size), name = `data.${String(archive).padStart(3, '0')}`
        const fd = openSync(join(data, name), 'r')
        let got: number
        try {
          got = readSync(fd, record, 0, size, offset)
        } finally {
          closeSync(fd)
        }
        // The index lists it, the archive does not hold it: a game still downloading, or damaged.
        if (got < size) throw new Error(`${name} ends before the file (${got} of ${size} bytes at ${offset}): the game is not fully downloaded`)
        // The container comes after the header of the record, or at once where the record has none.
        const bare = record.toString('latin1', RECORD_HEADER, RECORD_HEADER + 4) !== 'BLTE' && record.toString('latin1', 0, 4) === 'BLTE'
        try {
          return decodeBlte(bare ? record : record.subarray(RECORD_HEADER), skipHidden, keyOf)
        } catch (e) {
          if (e instanceof EncryptedFileError) throw e
          // How it starts goes with the error: what tells one kind of unreadable record from another.
          throw new Error(`${e instanceof Error ? e.message : String(e)} (${name} at ${offset}, ${size} bytes, starts ${record.toString('hex', 0, 40)})`)
        }
      }
    }
    return null
  }

  // Encoding: pages of [key count, 5 bytes of size, content key, encoded keys], found through a page index.
  // An error says which file it was about: what tells a damaged game from a single bad file.
  const naming = <T>(what: string, read: () => T): T => {
    try {
      return read()
    } catch (e) {
      if (e instanceof EncryptedFileError) throw e
      throw new Error(`${what}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const encoding = naming('encoding file', () => readEncoded(Buffer.from(encodingKey, 'hex')))
  if (!encoding || encoding.toString('latin1', 0, 2) !== 'EN') throw new Error('the encoding file is missing or not one')
  const pageSize = encoding.readUInt16BE(5) * 1024, pages = encoding.readUInt32BE(9)
  const pageIndex = 22 + encoding.readUInt32BE(18), pageData = pageIndex + pages * 32
  const readContent = (ckey: Buffer, skipHidden = false): Buffer | null => {
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
      if (encoding.compare(ckey, 0, 16, at + 6, at + 22) === 0) return readEncoded(encoding.subarray(at + 22, at + 38), skipHidden)
      at += 22 + keys * 16
    }
    return null
  }

  // Root: blocks of file numbers (as steps from the one before) and their content keys.
  const root = naming('root file', () => readContent(Buffer.from(rootKey, 'hex')))
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
  // The same file in its other languages. A PC holds only the languages the player installed
  // (issue 140: a game without English), so the one wanted is not always there to read.
  // Each kept as where * 4 + how good its language is: 0 the game's, 1 English, 2 another.
  const others = new Map<number, number[]>()
  // How good the language of the one in keyAt is.
  const rank = new Map<number, number>()
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
    const good = locale & wanted ? 0 : locale & EN_US ? 1 : 2
    for (let i = 0, id = -1; i < n; i++) {
      id += root.readInt32LE(at + i * 4) + 1
      const where = keys + i * 16, had = keyAt.get(id)
      if (had === undefined) {
        keyAt.set(id, where)
        rank.set(id, good)
      } else {
        let rest = others.get(id)
        if (!rest) others.set(id, (rest = []))
        if (good < rank.get(id)!) {
          rest.push(had * 4 + rank.get(id)!)
          keyAt.set(id, where)
          rank.set(id, good)
        } else rest.push(where * 4 + good)
      }
    }
    at = keys + n * 16 + (total !== named && flags & NO_NAMES ? 0 : n * 8)
  }

  const files: ClientFiles = {
    version: build.version,
    buildKey: key,
    count: keyAt.size,
    read(id, skipHidden) {
      const first = keyAt.get(id)
      if (first === undefined) return null
      // The others when the best is not on the PC, the better languages first.
      const rest = (others.get(id) ?? []).sort((a, b) => (a % 4) - (b % 4)).map((kept) => Math.floor(kept / 4))
      for (const where of [first, ...rest]) {
        const bytes = naming(`game file ${id}`, () => readContent(root.subarray(where, where + 16), skipHidden))
        if (bytes) return bytes
      }
      return null
    },
    opens: (keyName) => keyOf(keyName) !== null,
  }
  return files
}
