const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const image = process.argv[2]
if (!image) {
  console.error('usage: node scripts/check-appimage.cjs <AppImage> [--helper]')
  process.exit(1)
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'twinmap-appimage-'))
try {
  execFileSync(path.resolve(image), ['--appimage-extract'], { cwd: temp, stdio: 'ignore' })
  const root = path.join(temp, 'squashfs-root')
  const missing = []
  const requireItem = (condition, item) => { if (!condition) missing.push(item) }
  for (const item of ['resources/nav', 'resources/LICENSE.txt', 'resources/app-update.yml']) {
    requireItem(fs.existsSync(path.join(root, item)), item)
  }
  for (const [item, strings] of [
    ['AppRun', ['unshare -Ur true', '--no-sandbox']],
    ['app.twinmap.desktop', ['StartupWMClass=app.twinmap']]
  ]) {
    const file = path.join(root, item)
    const contents = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    for (const string of strings) requireItem(contents.includes(string), `${item}: ${string}`)
  }
  if (process.argv.includes('--helper')) {
    const file = path.join(root, 'resources/twinmap-capture')
    if (!fs.existsSync(file)) missing.push('resources/twinmap-capture')
    else {
      const bytes = fs.readFileSync(file)
      requireItem(bytes.length >= 20 && bytes.subarray(0, 4).equals(Buffer.from('7f454c46', 'hex')) && bytes[4] === 2 && bytes.readUInt16LE(18) === 0x3e, 'resources/twinmap-capture: x86_64 ELF')
      requireItem((fs.statSync(file).mode & 0o111) !== 0, 'resources/twinmap-capture: executable')
      const symbols = execFileSync('objdump', ['-T', file], { encoding: 'utf8' })
      const versions = [...symbols.matchAll(/\bGLIBC_(\d+)\.(\d+)(?:\.(\d+))?\b/g)].map((match) => match.slice(1).map((part) => Number(part || 0)))
      const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
      versions.sort(compare)
      const max = process.env.TWINMAP_GLIBC_MAX || '2.39'
      if (!/^\d+\.\d+(?:\.\d+)?$/.test(max)) throw new Error('Invalid TWINMAP_GLIBC_MAX')
      const limit = max.split('.').map(Number)
      while (limit.length < 3) limit.push(0)
      const highest = versions.at(-1)
      requireItem(!!highest, 'resources/twinmap-capture: GLIBC symbols')
      if (highest) {
        console.log(`GLIBC_${highest.slice(0, highest[2] ? 3 : 2).join('.')}`)
        requireItem(compare(highest, limit) <= 0, `resources/twinmap-capture: GLIBC exceeds ${max}`)
      }
      const libraries = execFileSync('ldd', [file], { encoding: 'utf8', env: { ...process.env, LD_LIBRARY_PATH: path.join(root, 'usr/lib') } })
      requireItem(!libraries.includes('squashfs-root') && !libraries.includes('not found'), 'resources/twinmap-capture: system libraries')
    }
  }
  if (missing.length) {
    for (const item of missing) console.error(`missing: ${item}`)
    process.exitCode = 1
  } else console.log('ok')
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
