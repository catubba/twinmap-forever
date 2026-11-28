import { mkdtempSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { expect, test } from 'vitest'
import { candidatePrefixes, decodeRegString, lutrisPrefix, regValue, steamLibraries, windowsToUnix, wineInstallPaths, WOW_KEYS } from './wine-prefixes'

test('registry strings decode as Wine writes them', () => {
  expect(decodeRegString('C:\\\\Program Files (x86)\\\\World of Warcraft\\\\')).toBe('C:\\Program Files (x86)\\World of Warcraft\\')
  expect(decodeRegString('a\\"b\\tc')).toBe('a"b\tc')
  expect(decodeRegString('\\x9b4f\\x5f8f')).toBe('\u9b4f\u5f8f')
  expect(decodeRegString('caf\\x00e9a')).toBe('caf\u00e9a')
  expect(decodeRegString('caf\\xe9z')).toBe('caf\u00e9z')
  expect(decodeRegString('C:\\\\Spiele\\\\W\\xf6W')).toBe('C:\\Spiele\\WöW')
  expect(decodeRegString('x\\1y\\e')).toBe('x\u0001y\u001b')
})
test('a value is read under its whole key whatever the case of the key path', () => {
  const reg = 'WINE REGISTRY Version 2\n\n[Software\\\\Wow6432Node\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\World of Warcraft] 1\n"InstallPath"="wrong"\n\n[Software\\\\WOW6432Node\\\\Blizzard Entertainment\\\\World of Warcraft] 1700000000\n#time=1d9\n@="x"\n"InstallPath"="C:\\\\Games\\\\World of Warcraft\\\\"\n"Other"="x"\n\n[Software\\\\Other] 1\n"InstallPath"="wrong"\n'
  expect(regValue(reg, WOW_KEYS[0]!, 'InstallPath')).toBe('C:\\Games\\World of Warcraft\\')
  expect(regValue(reg, 'Software\\Missing', 'InstallPath')).toBeNull()
})
test('Steam libraries are read from libraryfolders.vdf', () => {
  expect(steamLibraries('"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"/a/Steam"\n\t\t"apps"\n\t\t{\n\t\t\t"1"\t\t"2"\n\t\t}\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"/b/Lib"\n\t}\n}\n')).toEqual(['/a/Steam', '/b/Lib'])
})
test('a Lutris game config names its prefix, quoted or not', () => {
  expect(lutrisPrefix('game:\n  exe: drive_c/x.exe\n  prefix: /home/p/Games/battlenet\nwine:\n  version: x\n')).toBe('/home/p/Games/battlenet')
  expect(lutrisPrefix("game:\n  prefix: '/home/p/flat'\n")).toBe('/home/p/flat')
  expect(lutrisPrefix('game:\n  exe: x\n')).toBeNull()
})
test.skipIf(process.platform === 'win32')('C: maps to drive_c and other letters through dosdevices, lowercase', () => {
  const prefix = mkdtempSync(join(tmpdir(), 'twinmap-wine-'))
  const other = mkdtempSync(join(tmpdir(), 'twinmap-wine-'))
  mkdirSync(join(prefix, 'drive_c'))
  mkdirSync(join(prefix, 'dosdevices'))
  symlinkSync(other, join(prefix, 'dosdevices', 'd:'))
  expect(windowsToUnix(prefix, 'C:\\Games\\World of Warcraft\\')).toBe(join(prefix, 'drive_c', 'Games', 'World of Warcraft'))
  expect(windowsToUnix(prefix, 'D:\\Games\\World of Warcraft\\_forever_\\')).toBe(join(realpathSync(other), 'Games', 'World of Warcraft', '_forever_'))
  expect(windowsToUnix(prefix, 'Q:\\x')).toBeNull()
  expect(windowsToUnix(prefix, '\\\\srv\\share')).toBeNull()
  expect(windowsToUnix(prefix, 'D::\\x')).toBeNull()
})
test.skipIf(process.platform === 'win32')('candidate prefixes cover Wine, Lutris, Bottles and Steam in their usual places, skipping missing ones', () => {
  const home = mkdtempSync(join(tmpdir(), 'twinmap-wine-'))
  const dir = (p: string) => mkdirSync(join(home, p), { recursive: true })
  const file = (p: string, content: string) => { const path = join(home, p); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content) }
  for (const p of ['custom', '.wine', 'Games/bnet', 'old', 'flat', '.local/share/bottles/bottles/b1', '.var/app/com.usebottles.bottles/data/bottles/bottles/b2', 'lib2/steamapps/compatdata/123/pfx', 'lib2/steamapps/compatdata/456', '.steam']) dir(p)
  file('.local/share/lutris/games/bnet.yml', `game:\n  exe: x.exe\n  prefix: ${home}/Games/bnet\n`)
  file('.local/share/lutris/games/gone.yml', `game:\n  prefix: ${home}/missing\n`)
  file('.config/lutris/games/old.yml', `game:\n  prefix: ${home}/old\n`)
  file('.var/app/net.lutris.Lutris/data/lutris/games/f.yml', `game:\n  prefix: '${home}/flat'\n`)
  file('.local/share/Steam/steamapps/libraryfolders.vdf', `"path" "${home}/.local/share/Steam"\n"path" "${home}/lib2"\n`)
  symlinkSync('.', join(home, 'Games/bnet/pfx'))
  symlinkSync(join(home, '.local/share/Steam'), join(home, '.steam/steam'))
  expect(candidatePrefixes(home, { WINEPREFIX: join(home, 'custom') })).toEqual(['custom', '.wine', 'Games/bnet', 'old', 'flat', '.local/share/bottles/bottles/b1', '.var/app/com.usebottles.bottles/data/bottles/bottles/b2', 'lib2/steamapps/compatdata/123/pfx'].map(p => join(home, p)))
})
test.skipIf(process.platform === 'win32')('install paths come from each prefix registry, mapped to Unix paths, 64- and 32-bit keys', () => {
  const home = mkdtempSync(join(tmpdir(), 'twinmap-wine-'))
  const a = join(home, 'custom')
  const b = join(home, '.wine')
  mkdirSync(a); mkdirSync(b)
  writeFileSync(join(a, 'system.reg'), 'WINE REGISTRY Version 2\n;; All keys relative to REGISTRY\\\\Machine\n\n[Software\\\\Wow6432Node\\\\Blizzard Entertainment\\\\World of Warcraft] 1793952817\n#time=1dd6dc6b97868a2\n"InstallPath"="C:\\\\Games\\\\World of Warcraft\\\\_forever_\\\\"\n')
  writeFileSync(join(b, 'system.reg'), '[Software\\\\Blizzard Entertainment\\\\World of Warcraft] 1\n"InstallPath"="C:\\\\WoW"\n')
  expect(wineInstallPaths(home, { WINEPREFIX: a })).toEqual([join(a, 'drive_c', 'Games', 'World of Warcraft', '_forever_'), join(b, 'drive_c', 'WoW')])
})
