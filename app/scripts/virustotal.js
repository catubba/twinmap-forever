// Sends a file to VirusTotal, waits for its engines, and writes down what they said.
//   node scripts/virustotal.js <file> <out folder>
// Needs VT_API_KEY in the environment. Writes two files into the out folder:
//   virustotal.json  what a shields.io "endpoint" badge reads: label, message, color
//   virustotal.md    a line for the release notes, with the link to the report
// VT_API, for trials, is an address to talk to instead of VirusTotal's.
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const API = process.env.VT_API ?? 'https://www.virustotal.com/api/v3'
const EVERY = Number(process.env.VT_EVERY ?? 30000) // ms between two looks at the analysis: the free key allows four requests a minute
const GIVE_UP = Number(process.env.VT_GIVE_UP ?? 20 * 60000) // ms after which the scan is left unfinished

/** What the badge says for these counts: how many engines flag the file, out of how many looked at it. */
function badge(stats) {
  const flagged = (stats.malicious ?? 0) + (stats.suspicious ?? 0)
  const looked = flagged + (stats.undetected ?? 0) + (stats.harmless ?? 0)
  return { schemaVersion: 1, label: 'VirusTotal', message: `${flagged} / ${looked}`, color: flagged === 0 ? 'brightgreen' : flagged <= 3 ? 'yellow' : 'red' }
}

async function scan(file, key) {
  const ask = async (url, options = {}) => {
    const answer = await fetch(url, { ...options, headers: { 'x-apikey': key, ...options.headers } })
    if (!answer.ok) throw new Error(`VirusTotal answered ${answer.status} to ${new URL(url).pathname}`)
    return answer.json()
  }
  const sha256 = createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  // A file over 32 MB goes to an address asked for each time.
  const { data: uploadTo } = await ask(`${API}/files/upload_url`)
  const form = new FormData()
  form.append('file', await fs.openAsBlob(file), path.basename(file))
  const { data: analysis } = await ask(uploadTo, { method: 'POST', body: form })
  for (const started = Date.now(); Date.now() - started < GIVE_UP; ) {
    await new Promise((done) => setTimeout(done, EVERY))
    const { data } = await ask(`${API}/analyses/${analysis.id}`)
    if (data.attributes.status === 'completed') return { sha256, stats: data.attributes.stats }
  }
  throw new Error('VirusTotal did not finish in time')
}

async function main() {
  const [file, out] = process.argv.slice(2)
  if (!file || !out) throw new Error('usage: node scripts/virustotal.js <file> <out folder>')
  if (!process.env.VT_API_KEY) throw new Error('VT_API_KEY is not set')
  const { sha256, stats } = await scan(file, process.env.VT_API_KEY)
  const told = badge(stats)
  const report = `https://www.virustotal.com/gui/file/${sha256}`
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'virustotal.json'), JSON.stringify(told))
  fs.writeFileSync(
    path.join(out, 'virustotal.md'),
    `**VirusTotal**: ${told.message} engines flag \`${path.basename(file)}\`. [Full report](${report}).\n\nSHA-256: \`${sha256}\`\n`,
  )
  console.log(told.message, report)
}

if (require.main === module)
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
module.exports = { badge }
