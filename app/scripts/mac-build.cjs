const { execFileSync } = require('node:child_process')
const { mkdirSync, readdirSync, lstatSync, openSync, readSync, closeSync, rmSync } = require('node:fs')
const { join } = require('node:path')

if (process.platform !== 'darwin') process.exit(0)

const app = join(__dirname, '..')
const bundle = join(app, 'dist', 'mac-arm64', 'Twinmap.app')
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' })

// Every Mach-O file and every nested bundle in the app, deepest first. codesign --deep misses loose
// binaries inside frameworks (Electron's Libraries/*.dylib, Squirrel's ShipIt) and koffi's .node, and
// notarization rejects any of them without a Developer ID signature, timestamp and hardened runtime.
const MACHO = new Set(['cffaedfe', 'cefaedfe', 'cafebabe', 'bebafeca'])
const depth = (path) => path.split('/').length
function codeIn(dir, files = [], bundles = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name), stat = lstatSync(path)
    if (stat.isSymbolicLink()) continue
    if (stat.isDirectory()) {
      if (/\.(app|framework)$/.test(name)) bundles.push(path)
      codeIn(path, files, bundles)
      continue
    }
    if (stat.size < 4) continue
    const fd = openSync(path, 'r'), head = Buffer.alloc(4)
    readSync(fd, head, 0, 4, 0); closeSync(fd)
    if (MACHO.has(head.toString('hex'))) files.push(path)
  }
  return { files, bundles }
}

if (process.argv[2] === 'sign') {
  // TWINMAP_MAC_IDENTITY: a Developer ID ("Developer ID Application: …") keeps macOS permissions such as
  // Screen Recording across rebuilds; without it the build is signed ad hoc, which this Mac alone accepts
  // and which loses those permissions with every rebuild.
  const identity = process.env.TWINMAP_MAC_IDENTITY || '-'
  if (identity === '-') {
    run('codesign', ['--force', '--deep', '--sign', '-', bundle])
  } else {
    // Notarization needs the hardened runtime and a secure timestamp on every binary, inside out.
    const flags = ['--force', '--options', 'runtime', '--timestamp', '--sign', identity]
    const jit = ['--entitlements', join(app, 'build', 'entitlements.mac.plist')] // apps only: Electron's V8
    const { files, bundles } = codeIn(join(bundle, 'Contents'))
    for (const path of [...files.sort((a, b) => depth(b) - depth(a)), ...bundles.sort((a, b) => depth(b) - depth(a)), bundle]) {
      run('codesign', [...flags, ...(path.endsWith('.app') ? jit : []), path])
    }
  }
  run('codesign', ['--verify', '--deep', '--strict', bundle])
  // TWINMAP_MAC_NOTARY_PROFILE: a notarytool keychain profile (xcrun notarytool store-credentials). The secret
  // stays in the keychain; this only names it. Notarized and stapled, the app opens on any Mac without a warning.
  const profile = process.env.TWINMAP_MAC_NOTARY_PROFILE
  if (profile && identity !== '-') {
    const zip = join(app, 'dist', 'Twinmap-notarize.zip')
    rmSync(zip, { force: true })
    run('ditto', ['-c', '-k', '--keepParent', bundle, zip])
    run('xcrun', ['notarytool', 'submit', zip, '--keychain-profile', profile, '--wait', '--timeout', '30m'])
    run('xcrun', ['stapler', 'staple', bundle])
    run('spctl', ['--assess', '--type', 'execute', '-vv', bundle])
    rmSync(zip, { force: true })
  }
} else {
  const output = join(app, 'dist-native')
  mkdirSync(output, { recursive: true })
  execFileSync('swiftc', [
    '-O', '-target', 'arm64-apple-macos14.0', '-parse-as-library',
    join(app, 'native', 'capture-mac.swift'), '-o', join(output, 'twinmap-capture'),
  ], { stdio: 'inherit' })
}
