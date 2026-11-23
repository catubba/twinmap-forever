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
  // TWINMAP_MAC_IDENTITY: absent means ad hoc, which loses Screen Recording permission on rebuilds.
  // A self-signed certificate keeps permission across updates signed with the same certificate.
  // "Developer ID Application: …" also enables hardened runtime, timestamps and optional notarization.
  const identity = process.env.TWINMAP_MAC_IDENTITY || '-'
  // Resolve SHA-1 hashes and partial names; omit -v so untrusted self-signed certificates remain visible.
  const identities = identity === '-' ? '' : execFileSync('security', ['find-identity', '-p', 'codesigning'], { encoding: 'utf8' })
  const name = [...identities.matchAll(/^\s*\d+\)\s+([0-9a-f]{40})\s+"([^"]+)"/gim)]
    .find(([, hash, name]) => hash.toLowerCase() === identity.toLowerCase() || name.includes(identity))?.[2] ?? identity
  const developerId = name.startsWith('Developer ID Application: ')
  const profile = process.env.TWINMAP_MAC_NOTARY_PROFILE
  if (profile && !developerId) throw new Error('TWINMAP_MAC_NOTARY_PROFILE requires a Developer ID Application: … identity; ad hoc and self-signed certificates cannot be notarized.')
  if (identity === '-') {
    run('codesign', ['--force', '--deep', '--sign', '-', bundle])
  } else {
    // Notarization needs the hardened runtime and a secure timestamp on every binary, inside out. A self-signed
    // certificate gets neither: Apple's timestamp server serves only its own certificates, and the hardened
    // runtime's library validation refuses code without a Team ID, Electron's own frameworks included.
    const flags = ['--force', ...(developerId ? ['--options', 'runtime', '--timestamp'] : []), '--sign', identity]
    const jit = ['--entitlements', join(app, 'build', 'entitlements.mac.plist')] // apps only: Electron's V8
    const { files, bundles } = codeIn(join(bundle, 'Contents'))
    for (const path of [...files.sort((a, b) => depth(b) - depth(a)), ...bundles.sort((a, b) => depth(b) - depth(a)), bundle]) {
      run('codesign', [...flags, ...(developerId && path.endsWith('.app') ? jit : []), path])
    }
  }
  run('codesign', ['--verify', '--deep', '--strict', bundle])
  // TWINMAP_MAC_NOTARY_PROFILE: a notarytool keychain profile (xcrun notarytool store-credentials). The secret
  // stays in the keychain; this only names it. Notarized and stapled, the app opens on any Mac without a warning.
  if (profile && developerId) {
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
