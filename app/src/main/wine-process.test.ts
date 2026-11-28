import { existsSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'
import { argv0, findForeverPid, findPid, foreverFolderFromMaps, isForeverArgv0, mapsPaths, matchesTestProgram, processAlive, processCwd, processPrefix, programPath, wowImageFromMaps } from './wine-process'

const UID = 1000
const FOREVER = 'D:\\Games\\World of Warcraft\\_forever_\\Wow.exe'
type Fake = { uid?: number; state?: string; argv?: string[]; maps?: string; environ?: string; cwd?: string }
function fakeProc(pids: Record<number, Fake>): string {
  const proc = mkdtempSync(join(tmpdir(), 'twinmap-proc-'))
  mkdirSync(join(proc, 'self'))
  for (const [pid, p] of Object.entries(pids)) {
    const dir = join(proc, pid)
    mkdirSync(join(dir, 'root'), { recursive: true })
    if (p.uid !== undefined) writeFileSync(join(dir, 'status'), `Name:\tx\nState:\t${p.state ?? 'S (sleeping)'}\nUid:\t${p.uid}\t${p.uid}\t${p.uid}\t${p.uid}\n`)
    if (p.argv) writeFileSync(join(dir, 'cmdline'), p.argv.join('\0') + '\0'.repeat(200))
    if (p.maps !== undefined) writeFileSync(join(dir, 'maps'), p.maps)
    if (p.environ !== undefined) writeFileSync(join(dir, 'environ'), p.environ)
    if (p.cwd !== undefined) symlinkSync(p.cwd, join(dir, 'cwd'))
  }
  return proc
}

test.skipIf(process.platform === 'win32')('a cached zombie is not alive even while its proc directory exists', () => {
  const proc = fakeProc({ 200: { uid: UID, state: 'Z (zombie)', argv: [FOREVER] }, 201: { uid: UID, argv: [FOREVER] } })
  expect(existsSync(join(proc, '200'))).toBe(true)
  expect(processAlive(200, proc)).toBe(false)
  expect(processAlive(201, proc)).toBe(true)
  expect(processAlive(202, proc)).toBe(false)
})

const maps = '140000000-140001000 r--p 00000000 08:02 99 /g/World of Warcraft/_forever_/libxell.dll\n7f00-7f10 r-xp 0 0 0 /usr/lib/x.so (deleted)\n7f10-7f20 rw-p 0 0 0\n'

test('recognizes only Forever executable argv0 paths', () => {
  expect(argv0(`${FOREVER}\0-launcherlogin\0`)).toBe(FOREVER)
  expect(isForeverArgv0(FOREVER)).toBe(true)
  expect(isForeverArgv0('c:\\x\\_forever_\\wow.exe')).toBe(true)
  expect(isForeverArgv0('/home/p/Games/wow/drive_c/World of Warcraft/_forever_/WOW.EXE')).toBe(true)
  expect(isForeverArgv0('C:\\World of Warcraft\\_retail_\\Wow.exe')).toBe(false)
  expect(isForeverArgv0(FOREVER + '.bak')).toBe(false)
})

test('parses mapped paths with spaces and deleted suffixes', () => {
  expect(mapsPaths(maps)).toEqual(['/g/World of Warcraft/_forever_/libxell.dll', '/usr/lib/x.so'])
  expect(foreverFolderFromMaps(maps)).toBe('/g/World of Warcraft/_forever_')
  expect(wowImageFromMaps(maps)).toBeNull()
})

test('matches an exact test program argument and rejects child processes', () => {
  expect(matchesTestProgram('/e/electron scripts/strip-window.cjs\0', '/x/app/scripts/strip-window.cjs', '/x/app')).toBe(true)
  expect(matchesTestProgram('electron\0/x/app/scripts/strip-window.cjs\0', '/x/app/scripts/strip-window.cjs', '/')).toBe(true)
  expect(matchesTestProgram('/e/electron scripts/strip-window.cjs.bak', '/x/app/scripts/strip-window.cjs', '/x/app')).toBe(false)
  expect(matchesTestProgram('/e/electron --type=renderer scripts/strip-window.cjs', '/x/app/scripts/strip-window.cjs', '/x/app')).toBe(false)
})

test.skipIf(process.platform === 'win32')('the Forever process of this user is found by argv0, launcher arguments ignored', () => {
  const proc = fakeProc({ 200: { uid: UID, argv: [FOREVER, '-launcherlogin', '-uid', 'wowf'], maps: '' } })
  expect(findForeverPid(proc, UID)).toBe(200)
  expect(findPid((pid) => pid === 200, proc, UID)).toBe(200)
})

test.skipIf(process.platform === 'win32')('processes of other users, other clients, other programs and zombies are skipped', () => {
  const proc = fakeProc({ 300: { uid: 1001, argv: [FOREVER] }, 301: { uid: UID, argv: ['C:\\World of Warcraft\\_retail_\\Wow.exe'] }, 302: { uid: UID, argv: ['/usr/bin/wine64-preloader', FOREVER] }, 303: { uid: UID, argv: [FOREVER + '.bak'] }, 304: { uid: UID, state: 'Z (zombie)', argv: [FOREVER] } })
  expect(findForeverPid(proc, UID)).toBeNull()
})

test.skipIf(process.platform === 'win32')('a process with files mapped from _forever_ wins over one without', () => {
  const first = { uid: UID, argv: [FOREVER], maps: '7f00-7f10 r-xp 0 0 0 /usr/lib/libc.so.6\n' }
  const second = { uid: UID, argv: [FOREVER], maps }
  expect(findForeverPid(fakeProc({ 100: first, 300: second }), UID)).toBe(300)
  expect(findForeverPid(fakeProc({ 100: first }), UID)).toBe(100)
})

test.skipIf(process.platform === 'win32')('programPath finds Wow.exe beside mapped _forever_ files, as under Proton', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'twinmap-proc-'))
  const game = join(tmp, 'World of Warcraft', '_forever_', 'Wow.exe')
  mkdirSync(dirname(game), { recursive: true })
  writeFileSync(game, '')
  const proc = fakeProc({ 300: { uid: UID, argv: [FOREVER], maps: `1400-1401 r--p 0 0 99 ${join(dirname(game), 'libxell.dll')}\n` } })
  expect(programPath(300, proc)).toBe(game)
})

test.skipIf(process.platform === 'win32')('programPath falls back to the prefix and argv0, then the working folder', () => {
  const prefix = mkdtempSync(join(tmpdir(), 'twinmap-proc-'))
  const game = join(prefix, 'drive_c', 'World of Warcraft', '_forever_', 'Wow.exe')
  mkdirSync(dirname(game), { recursive: true })
  writeFileSync(game, '')
  const cwd = mkdtempSync(join(tmpdir(), 'twinmap-proc-'))
  writeFileSync(join(cwd, 'Wow.exe'), '')
  const proc = fakeProc({ 300: { argv: ['C:\\World of Warcraft\\_forever_\\Wow.exe'], environ: `A=1\0WINEPREFIX=${prefix}/\0` }, 301: { cwd } })
  expect(processPrefix(300, proc)).toBe(`${prefix}/`)
  expect(processCwd(301, proc)).toBe(cwd)
  expect(programPath(300, proc)).toBe(game)
  expect(programPath(301, proc)).toBe(join(cwd, 'Wow.exe'))
})

test.skipIf(process.platform === 'win32')('programPath prefers the host path over the process root, and reports a guess when nothing exists', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'twinmap-proc-'))
  const game = join(tmp, '_forever_', 'Wow.exe')
  mkdirSync(dirname(game), { recursive: true })
  writeFileSync(game, '')
  const line = (path: string) => `1400-1401 r--p 0 0 99 ${path}\n`
  const proc = fakeProc({ 300: { maps: line(game) }, 301: { maps: line('/nowhere/_forever_/Wow.exe') }, 302: { maps: line('/gone/_forever_/Wow.exe') }, 303: {} })
  const rootGame = join(proc, '301', 'root', 'nowhere', '_forever_', 'Wow.exe')
  mkdirSync(dirname(rootGame), { recursive: true })
  writeFileSync(rootGame, '')
  expect(programPath(300, proc)).toBe(game)
  expect(programPath(301, proc)).toBe(rootGame)
  expect(programPath(302, proc)).toBe('/gone/_forever_/Wow.exe')
  expect(programPath(303, proc)).toBeNull()
})

test.skipIf(process.platform === 'win32')('unreadable or vanished proc entries are skipped', () => {
  const proc = fakeProc({ 400: {}, 401: { uid: UID } })
  expect(findForeverPid(proc, UID)).toBeNull()
  expect(findPid(() => true, proc, UID)).toBeNull()
  writeFileSync(join(proc, '400', 'status'), 'State:\tS (sleeping)\n')
  writeFileSync(join(proc, '400', 'cmdline'), `${FOREVER}\0`)
  expect(findPid(() => true, proc, -1)).toBeNull()
})
test.skipIf(process.platform === 'win32')('recognizes relative executable paths only within the Forever folder', () => {
  const proc = fakeProc({ 100: { uid: UID, argv: ['Wow.exe'], cwd: '/games/_retail_' }, 101: { uid: UID, argv: ['./Wow.exe'], cwd: '/games/_forever_' }, 102: { uid: UID, argv: ['../_retail_/Wow.exe'], cwd: '/games/_forever_' } })
  expect(findForeverPid(proc, UID)).toBe(101)
})
