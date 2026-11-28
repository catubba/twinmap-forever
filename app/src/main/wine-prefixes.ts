import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const WOW_KEYS = ['Software\\Wow6432Node\\Blizzard Entertainment\\World of Warcraft', 'Software\\Blizzard Entertainment\\World of Warcraft']

export function decodeRegString(raw: string): string {
  const escapes: Record<string, string> = { a: '\x07', b: '\b', t: '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b', '\\': '\\', '"': '"' }
  return raw.replace(/\\(x[0-9a-fA-F]{1,4}|[0-7]{1,3}|.)/g, (_, code: string) => {
    if (code[0] === 'x' && code.length > 1) return String.fromCharCode(parseInt(code.slice(1), 16))
    if (/^[0-7]/.test(code)) return String.fromCharCode(parseInt(code, 8))
    return escapes[code] ?? code
  })
}

export function regValue(systemReg: string, keyPath: string, name: string): string | null {
  let inside = false
  for (const line of systemReg.split(/\r?\n/)) {
    const key = line.match(/^\[(.*)\](?:\s+\d+)?\s*$/)
    if (key) {
      inside = decodeRegString(key[1]!).toLowerCase() === keyPath.toLowerCase()
      continue
    }
    if (!inside || line.startsWith('#') || line.startsWith('@=')) continue
    const value = line.match(/^"((?:[^"\\]|\\.)*)"="((?:[^"\\]|\\.)*)"\s*$/)
    if (value && decodeRegString(value[1]!).toLowerCase() === name.toLowerCase()) return decodeRegString(value[2]!)
  }
  return null
}

export function windowsToUnix(prefix: string, winPath: string): string | null {
  const match = winPath.match(/^([a-z]):(?!:)(?:[\\/]|$)(.*)$/i)
  if (!match) return null
  const drive = match[1]!.toLowerCase()
  try {
    const root = drive === 'c' ? join(prefix, 'drive_c') : realpathSync(join(prefix, 'dosdevices', `${drive}:`))
    return join(root, ...match[2]!.split(/[\\/]+/).filter(Boolean))
  } catch {
    return null
  }
}

export function steamLibraries(vdf: string): string[] {
  return Array.from(vdf.matchAll(/^\s*"path"\s+"((?:[^"\\]|\\.)*)"/gm), match => match[1]!.replace(/\\\\/g, '\\'))
}

export function lutrisPrefix(yml: string): string | null {
  return yml.match(/^\s+prefix:\s*['"]?(.*?)['"]?\s*$/m)?.[1] ?? null
}

export function candidatePrefixes(home: string, env: Record<string, string | undefined>): string[] {
  const candidates: string[] = []
  const seen = new Set<string>()
  const add = (path: string | undefined) => {
    if (!path) return
    try {
      if (!statSync(path).isDirectory()) return
      const real = realpathSync(path)
      if (!seen.has(real)) { seen.add(real); candidates.push(path) }
    } catch {}
  }
  const entries = (path: string): string[] => {
    try { return readdirSync(path).sort() } catch { return [] }
  }
  add(env.WINEPREFIX)
  add(join(home, '.wine'))
  for (const base of ['.local/share/lutris/games', '.config/lutris/games', '.var/app/net.lutris.Lutris/data/lutris/games']) {
    const dir = join(home, base)
    for (const file of entries(dir).filter(file => file.endsWith('.yml'))) {
      try { add(lutrisPrefix(readFileSync(join(dir, file), 'utf8')) ?? undefined) } catch {}
    }
  }
  for (const base of ['Games', '.local/share/bottles/bottles', '.var/app/com.usebottles.bottles/data/bottles/bottles']) {
    const dir = join(home, base)
    for (const file of entries(dir)) add(join(dir, file))
  }
  for (const base of ['.local/share/Steam', '.steam/steam', '.var/app/com.valvesoftware.Steam/.local/share/Steam']) {
    try {
      const vdf = readFileSync(join(home, base, 'steamapps/libraryfolders.vdf'), 'utf8')
      for (const library of steamLibraries(vdf)) {
        const dir = join(library, 'steamapps/compatdata')
        for (const app of entries(dir)) add(join(dir, app, 'pfx'))
      }
    } catch {}
  }
  return candidates
}

export function wineInstallPaths(home = homedir(), env: Record<string, string | undefined> = process.env): string[] {
  const paths: string[] = []
  for (const prefix of candidatePrefixes(home, env)) {
    try {
      const registry = readFileSync(join(prefix, 'system.reg'), 'utf8')
      for (const key of WOW_KEYS) {
        const value = regValue(registry, key, 'InstallPath')
        if (value !== null) {
          const path = windowsToUnix(prefix, value)
          if (path !== null) paths.push(path)
          break
        }
      }
    } catch {}
  }
  return paths
}
