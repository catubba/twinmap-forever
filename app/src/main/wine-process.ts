import { existsSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, posix } from 'node:path'
import { windowsToUnix } from './wine-prefixes'

function readProc(pid: number, file: string, proc: string): string | null {
  try { return readFileSync(join(proc, String(pid), file), 'utf8') } catch { return null }
}

export function processAlive(pid: number, proc = '/proc'): boolean {
  const status = readProc(pid, 'status', proc)
  return status !== null && /^State:\s*[^Z\s]/m.test(status)
}

export function findPid(match: (pid: number, cmdline: string) => boolean, proc = '/proc', uid = process.getuid?.() ?? -1): number | null {
  let pids: number[]
  try { pids = readdirSync(proc).filter(name => /^\d+$/.test(name)).map(Number).sort((a, b) => a - b) } catch { return null }
  for (const pid of pids) {
    const status = readProc(pid, 'status', proc)
    const owner = status?.match(/^Uid:\s*(\d+)/m)?.[1]
    if (owner === undefined || Number(owner) !== uid || /^State:\s*Z\b/m.test(status!)) continue
    const cmdline = readProc(pid, 'cmdline', proc)
    if (cmdline !== null && match(pid, cmdline)) return pid
  }
  return null
}

export function argv0(cmdline: string): string { return cmdline.split('\0')[0] ?? '' }
export function isForeverArgv0(value: string): boolean { return /[\\/]_forever_[\\/]wow\.exe$/i.test(value) }

export function mapsPaths(maps: string): string[] {
  return maps.split('\n').flatMap(line => {
    const path = line.match(/^\S+\s+\S+\s+\S+\s+\S+\s+\d+\s+(.+)$/)?.[1]
    return path ? [path.replace(/ \(deleted\)$/, '')] : []
  })
}

export function wowImageFromMaps(maps: string): string | null {
  return mapsPaths(maps).find(isForeverArgv0) ?? null
}

export function foreverFolderFromMaps(maps: string): string | null {
  for (const path of mapsPaths(maps)) {
    const match = path.match(/^(.*\/_forever_)\//i)
    if (match) return match[1]!
  }
  return null
}

export function findForeverPid(proc = '/proc', uid = process.getuid?.() ?? -1): number | null {
  let fallback: number | null = null
  const preferred = findPid((pid, cmdline) => {
    const arg = argv0(cmdline)
    const cwd = processCwd(pid, proc)
    const relative = !posix.isAbsolute(arg) && !/^[a-z]:/i.test(arg) && cwd ? posix.resolve(cwd, arg.replace(/\\/g, '/')) : ''
    if (!isForeverArgv0(relative || arg) || (relative === '' && !posix.isAbsolute(arg) && !/^[a-z]:[\\/]/i.test(arg))) return false
    fallback ??= pid
    const maps = readProc(pid, 'maps', proc)
    return maps !== null && foreverFolderFromMaps(maps) !== null
  }, proc, uid)
  return preferred ?? fallback
}

export function processPrefix(pid: number, proc = '/proc'): string | null {
  const environ = readProc(pid, 'environ', proc)
  return environ?.split('\0').find(entry => entry.startsWith('WINEPREFIX='))?.slice('WINEPREFIX='.length) || null
}

export function processCwd(pid: number, proc = '/proc'): string | null {
  try { return readlinkSync(join(proc, String(pid), 'cwd')) } catch { return null }
}

export function programPath(pid: number, proc = '/proc'): string | null {
  const maps = readProc(pid, 'maps', proc) ?? ''
  const image = wowImageFromMaps(maps)
  const folder = foreverFolderFromMaps(maps)
  const cmdline = readProc(pid, 'cmdline', proc)
  const cwd = processCwd(pid, proc)
  const candidates = [
    image,
    image ? join(proc, String(pid), 'root', image) : null,
    folder ? join(folder, 'Wow.exe') : null,
    cmdline ? windowsToUnix(processPrefix(pid, proc) ?? join(homedir(), '.wine'), argv0(cmdline)) : null,
    cwd ? join(cwd, 'Wow.exe') : null,
  ].filter((path): path is string => path !== null)
  return candidates.find(path => existsSync(path)) ?? candidates[0] ?? null
}

export function matchesTestProgram(cmdline: string, marker: string, cwd: string): boolean {
  const tokens = cmdline.split(/[\0 ]+/).filter(Boolean)
  return !tokens.some(token => token.startsWith('--type=')) && tokens.some(token => posix.resolve(cwd, token) === marker)
}
