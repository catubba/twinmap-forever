import { describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { canReplace, justUpdated, selfUpdates } from './update-gate'

describe('self-update gate', () => {
  it.each([
    ['win32', {}, true],
    ['win32', { APPIMAGE: '/x' }, true],
    ['linux', { APPIMAGE: '/x.AppImage' }, false],
    ['linux', { APPIMAGE: '' }, false],
    ['linux', {}, false],
    ['darwin', {}, false],
  ] as const)('selects supported installations on %s', (platform, env, expected) => {
    expect(selfUpdates(platform, env)).toBe(expected)
  })

  it.each([
    [['--updated'], {}, true],
    [[], { APPIMAGE_SILENT_INSTALL: 'true' }, true],
    [[], { APPIMAGE_SILENT_INSTALL: 'false' }, false],
    [[], {}, false],
  ] as const)('recognizes a just-installed update', (argv, env, expected) => {
    expect(justUpdated([...argv], env)).toBe(expected)
  })

  it('allows a missing AppImage path', () => {
    expect(canReplace({})).toBe(true)
  })

  it.skipIf(process.platform === 'win32')('checks the AppImage parent directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'twinmap-update-'))
    try {
      expect(canReplace({ APPIMAGE: join(dir, 'app.AppImage') })).toBe(true)
      if (process.getuid?.() !== 0) {
        chmodSync(dir, 0o555)
        expect(canReplace({ APPIMAGE: join(dir, 'app.AppImage') })).toBe(false)
      }
      expect(canReplace({ APPIMAGE: join(dir, 'missing', 'app.AppImage') })).toBe(false)
    } finally {
      chmodSync(dir, 0o755)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
