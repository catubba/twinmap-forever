// Publishes the site: uploads every file of site/ to the web server by SFTP.
//   node scripts/deploy-site.js          uploads
//   node scripts/deploy-site.js --dry    only lists what would go where
//   node scripts/deploy-site.js --check  signs in and lists what the server's folder holds, sends nothing
//
// Where and as whom is read from a file that is never in the repository. By default it is sftp.env
// in the folder above the repository; TWINMAP_SFTP names another. One KEY=value per line:
//   SFTP_HOST=example.org
//   SFTP_PORT=22
//   SFTP_USER=name
//   SFTP_PASSWORD=secret
//   SFTP_PATH=/public_html        the folder on the server that the site is served from
//
// The password goes to curl on its standard input, never on a command line and never on screen.
// The first time, the server's key is asked for and its fingerprint kept beside that file
// (sftp.hostkey); from then on a server that shows another key is refused.
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const SITE = path.join(__dirname, '..', 'site')
const SETTINGS = process.env.TWINMAP_SFTP ?? path.join(__dirname, '..', '..', 'sftp.env')

function settings() {
  if (!fs.existsSync(SETTINGS)) throw new Error(`no settings file at ${SETTINGS}: see the top of this script for what it holds`)
  const read = {}
  for (const line of fs.readFileSync(SETTINGS, 'utf8').split(/\r?\n/)) {
    const at = line.indexOf('=')
    if (at > 0 && !line.trimStart().startsWith('#')) read[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  for (const name of ['SFTP_HOST', 'SFTP_USER', 'SFTP_PASSWORD', 'SFTP_PATH']) if (!read[name]) throw new Error(`${name} is missing in the settings file`)
  return { host: read.SFTP_HOST, port: read.SFTP_PORT || '22', user: read.SFTP_USER, password: read.SFTP_PASSWORD, folder: read.SFTP_PATH.replace(/\/+$/, '') }
}

/** Every file under a folder, as paths from it with forward slashes. */
function filesOf(folder, under = '') {
  return fs.readdirSync(path.join(folder, under), { withFileTypes: true }).flatMap((entry) => {
    const at = under ? `${under}/${entry.name}` : entry.name
    if (/\.(webp|png|jpg)\.json$/.test(entry.name)) return [] // a picture's record of where it comes from stays in the repository
    return entry.isDirectory() ? filesOf(folder, at) : [at]
  })
}

/** The fingerprint of the server's key: the one kept from the first time, or asked for now and kept. */
function hostKey({ host, port }) {
  const kept = path.join(path.dirname(SETTINGS), 'sftp.hostkey')
  if (fs.existsSync(kept)) return fs.readFileSync(kept, 'utf8').trim()
  const keys = execFileSync('ssh-keyscan', ['-p', port, '-t', 'ed25519,ecdsa,rsa', host], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const first = keys.split('\n').find((line) => line && !line.startsWith('#'))
  if (!first) throw new Error(`${host} gave no key on port ${port}`)
  const told = execFileSync('ssh-keygen', ['-l', '-E', 'sha256', '-f', '-'], { input: first + '\n', encoding: 'utf8' })
  const print = /SHA256:(\S+)/.exec(told)?.[1]
  if (!print) throw new Error('the fingerprint of the server key could not be read')
  fs.writeFileSync(kept, print + '\n')
  console.log(`First time on ${host}: its key is SHA256:${print}. Kept in ${kept}; check it against what your host shows.`)
  return print
}

function main() {
  const dry = process.argv.includes('--dry')
  const to = settings()
  const files = filesOf(SITE)
  if (dry) {
    for (const file of files) console.log(`${file} -> ${to.folder}/${file}`)
    return console.log(`${files.length} files would go to ${to.host}`)
  }
  const print = hostKey(to)
  // What curl is told on its standard input: who it is, and which key the server must show.
  const quoted = (text) => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const config = `user = ${quoted(`${to.user}:${to.password}`)}\nhostpubsha256 = ${quoted(print)}\n`
  if (process.argv.includes('--check')) {
    // Only looks: signs in and lists what is in the folder now. Nothing is sent or changed.
    execFileSync('curl', ['--config', '-', '--silent', '--show-error', '--fail', '--list-only', `sftp://${to.host}:${to.port}${to.folder}/`], { input: config, stdio: ['pipe', 'inherit', 'inherit'] })
    return console.log(`signed in to ${to.host}; the lines above are what ${to.folder} holds now`)
  }
  for (const file of files) {
    const url =`sftp://${to.host}:${to.port}${to.folder}/${file.split('/').map(encodeURIComponent).join('/')}`
    execFileSync('curl', ['--config', '-', '--silent', '--show-error', '--fail', '--ftp-create-dirs', '--upload-file', path.join(SITE, file), url], { input: config, stdio: ['pipe', 'inherit', 'inherit'] })
    console.log(`sent ${file}`)
  }
  console.log(`${files.length} files published to ${to.host}`)
}

try {
  main()
} catch (e) {
  // What failed, without the command that failed: its input holds the password.
  console.error(e.stderr ? String(e.stderr).trim() || 'the upload failed' : e.message)
  process.exit(1)
}
