const { execFileSync } = require('node:child_process')
const { mkdirSync, mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

if (process.platform !== 'linux') process.exit(0)

if (process.argv[2] === 'test') {
  const dir = mkdtempSync(join(tmpdir(), 'twinmap-convert-'))
  try {
    const binary = join(dir, 'convert-test')
    execFileSync('cc', ['-std=c11', '-D_GNU_SOURCE', '-Wall', '-Wextra', '-Werror', join(__dirname, '../native/convert.c'), join(__dirname, '../native/convert-test.c'), '-o', binary], { stdio: 'inherit' })
    execFileSync(binary, [], { stdio: 'inherit' })
  } catch (error) {
    process.exitCode = error.status ?? 1
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
} else {
  let flags
  try {
    flags = execFileSync('pkg-config', ['--cflags', '--libs', 'libpipewire-0.3', 'gio-2.0', 'gio-unix-2.0'], { encoding: 'utf8' }).split(/\s+/).filter(Boolean)
  } catch {
    console.error('Install the PipeWire and GLib development files (pipewire, glib2 on Arch; libpipewire-0.3-dev, libglib2.0-dev on Debian/Ubuntu)')
    process.exit(1)
  }
  const root = join(__dirname, '..')
  mkdirSync(join(root, 'dist-native'), { recursive: true })
  try {
    execFileSync('cc', ['-std=c11', '-D_GNU_SOURCE', '-O2', '-Wall', '-Wextra', '-Werror', join(root, 'native/capture-linux.c'), join(root, 'native/convert.c'), ...flags, '-o', join(root, 'dist-native/twinmap-capture')], { stdio: 'inherit' })
  } catch (error) {
    process.exitCode = error.status ?? 1
  }
}
