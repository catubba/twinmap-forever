import { test, expect } from 'vitest'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

test.each([
  { version: '2.39', max: undefined, status: 0 },
  { version: '2.40', max: undefined, status: 1 },
  { version: '2.40', max: '2.40', status: 0 },
  { version: '2.39', max: '2.35', status: 1 }
])('checks GLIBC $version against max $max', ({ version, max, status }) => {
  const dir = mkdtempSync(join(tmpdir(), 'twinmap-check-test-'))
  try {
    const image = join(dir, 'image')
    writeFileSync(image, `#!/bin/sh
mkdir -p squashfs-root/resources/nav
printf x > squashfs-root/resources/LICENSE.txt
printf x > squashfs-root/resources/app-update.yml
printf 'unshare -Ur true --no-sandbox' > squashfs-root/AppRun
printf 'StartupWMClass=app.twinmap' > squashfs-root/app.twinmap.desktop
cp /bin/true squashfs-root/resources/twinmap-capture
`)
    chmodSync(image, 0o755)
    writeFileSync(join(dir, 'objdump'), `#!/bin/sh\necho "GLIBC_${version}"\n`, { mode: 0o755 })
    writeFileSync(join(dir, 'ldd'), '#!/bin/sh\necho "libc => /lib/libc.so"\n', { mode: 0o755 })
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}` }
    if (max) env.TWINMAP_GLIBC_MAX = max
    else delete env.TWINMAP_GLIBC_MAX
    const result = spawnSync(process.execPath, [resolve('scripts/check-appimage.cjs'), image, '--helper'], { encoding: 'utf8', env })
    expect(result.status).toBe(status)
    if (status) expect(result.stderr).toContain('GLIBC')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
