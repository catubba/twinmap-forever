// Uploads the zip of the addon to its project on CurseForge, as a release for the game version its .toc names.
//   node scripts/curseforge.js <zip> <toc> <version> <changelog file>
// Needs CF_API_TOKEN and CF_PROJECT_ID in the environment.
// The file names QuestieDB as a required dependency: the CurseForge app installs it with the addon, and the map reads it.
// CF_API, for trials, is an address to talk to instead of CurseForge's.
const fs = require('node:fs')
const path = require('node:path')

const API = process.env.CF_API ?? 'https://wow.curseforge.com'

/** The game version an interface number stands for: 16001 is 1.60.1, 110207 is 11.2.7. */
function gameVersionName(iface) {
  const n = Number(iface)
  return `${Math.floor(n / 10000)}.${Math.floor(n / 100) % 100}.${n % 100}`
}

async function upload(zip, toc, version, changelog, token, project) {
  const text = fs.readFileSync(toc, 'utf8')
  const said = /^## Version:\s*(\S+)/m.exec(text)?.[1]
  if (said !== version) throw new Error(`the .toc says version ${said}, the release is ${version}`)
  const name = gameVersionName(/^## Interface:\s*(\d+)/m.exec(text)?.[1])

  const versions = await fetch(`${API}/api/game/versions`, { headers: { 'X-Api-Token': token } })
  if (!versions.ok) throw new Error(`CurseForge answered ${versions.status} to the list of game versions`)
  const ids = (await versions.json()).filter((v) => v.name === name).map((v) => v.id)
  if (!ids.length) throw new Error(`CurseForge knows no game version named ${name}`)

  const form = new FormData()
  form.append('metadata', JSON.stringify({ changelog, changelogType: 'markdown', displayName: `Twinmap Forever ${version}`, gameVersions: ids, releaseType: 'release', relations: { projects: [{ slug: 'questiedb', type: 'requiredDependency' }] } }))
  form.append('file', new Blob([fs.readFileSync(zip)]), path.basename(zip))
  const answer = await fetch(`${API}/api/projects/${project}/upload-file`, { method: 'POST', headers: { 'X-Api-Token': token }, body: form })
  if (!answer.ok) throw new Error(`CurseForge answered ${answer.status} to the upload: ${(await answer.text()).slice(0, 300)}`)
  return (await answer.json()).id
}

if (require.main === module) {
  const [zip, toc, version, notes] = process.argv.slice(2)
  upload(zip, toc, version, fs.readFileSync(notes, 'utf8'), process.env.CF_API_TOKEN, process.env.CF_PROJECT_ID).then(
    (id) => console.log(`Uploaded to CurseForge as file ${id}`),
    (error) => {
      console.error(String(error.message ?? error))
      process.exit(1)
    },
  )
}

module.exports = { gameVersionName }
