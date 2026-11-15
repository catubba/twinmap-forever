// The keys the game's server has sent to this PC. The game locks the files of what is not out yet;
// when it comes out the server sends every player its key, and the game keeps it in its cache
// (_forever_/Cache/ADB/<language>/DBCache.bin). Twinmap opens with those keys only: what the server
// has not unlocked for this player stays shut. Nothing is written to the game's folder.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROW = 'XFTH' // how each row of the cache starts
const KEY_TABLE = 0xdf2f53cf // the game's number for its table of keys
const VALID = 1 // a row's state; the others are "deleted", "invalid" and "not public", with no key in them

/** The keys in a cache file: the game's number of each -> its 16 bytes. A later row replaces an earlier one. */
export function keysIn(cache: Buffer): Map<number, Buffer> {
  const keys = new Map<number, Buffer>(), table = Buffer.alloc(4)
  table.writeUInt32LE(KEY_TABLE)
  // A row: "XFTH", three numbers, the table, the row's number, the size of its data, its state, the data.
  for (let at = -1; (at = cache.indexOf(table, at + 1)) >= 0; ) {
    if (at < 16 || at + 16 > cache.length || cache.toString('latin1', at - 16, at - 12) !== ROW) continue
    const id = cache.readUInt32LE(at + 4)
    if (cache.readUInt32LE(at + 8) === 16 && cache[at + 12] === VALID && at + 32 <= cache.length) keys.set(id, Buffer.from(cache.subarray(at + 16, at + 32)))
    else keys.delete(id)
  }
  return keys
}

/** The keys the server has sent to the game in this folder, whatever language it runs in. None when the cache is not there or not readable. */
export function sentKeys(gameFolder: string): Map<number, Buffer> {
  const keys = new Map<number, Buffer>(), caches = join(gameFolder, '_forever_', 'Cache', 'ADB')
  if (!existsSync(caches)) return keys
  for (const language of readdirSync(caches)) {
    try {
      for (const [id, key] of keysIn(readFileSync(join(caches, language, 'DBCache.bin')))) keys.set(id, key)
    } catch {
      // No cache for this language, or the game is writing it: the map does without, and looks again at the next start.
    }
  }
  // ponytail: only the cache is looked at. If a build moves a key into the game's own table of keys (file 1302850), read it there too.
  return keys
}
