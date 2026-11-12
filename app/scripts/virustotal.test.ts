import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

const run = promisify(execFile)
const script = join(__dirname, 'virustotal.js')

test('the badge is green only when no engine flags the file', async () => {
  const { badge } = (await import('./virustotal.js')) as { badge: (stats: Record<string, number>) => { message: string; color: string } }
  expect(badge({ malicious: 0, suspicious: 0, undetected: 60, harmless: 12, timeout: 3 })).toMatchObject({ message: '0 / 72', color: 'brightgreen' })
  expect(badge({ malicious: 1, suspicious: 1, undetected: 70 })).toMatchObject({ message: '2 / 72', color: 'yellow' })
  expect(badge({ malicious: 9, undetected: 60 })).toMatchObject({ message: '9 / 69', color: 'red' })
})

test('a file is sent, waited for, and its result written for the badge and for the release notes', async () => {
  // A stand-in for VirusTotal: an address to upload to, the upload, and an analysis that is done at the second look.
  const asked: string[] = []
  let looks = 0
  const server = createServer((req, res) => {
    asked.push(`${req.method} ${req.url} ${req.headers['x-apikey']}`)
    const say = (body: unknown): void => void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    if (req.url === '/files/upload_url') return say({ data: `${base}/upload-here` })
    if (req.url === '/upload-here') return req.resume().on('end', () => say({ data: { type: 'analysis', id: 'abc' } }))
    if (req.url === '/analyses/abc') return say({ data: { attributes: ++looks < 2 ? { status: 'queued', stats: {} } : { status: 'completed', stats: { malicious: 0, suspicious: 0, undetected: 61, harmless: 10 } } } })
    res.writeHead(404).end()
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  try {
    const folder = mkdtempSync(join(tmpdir(), 'twinmap-vt-'))
    const file = join(folder, 'Twinmap-Setup-9.9.9.exe')
    writeFileSync(file, 'not a real installer')
    const env = { ...process.env, VT_API_KEY: 'key-of-the-trial', VT_API: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, VT_EVERY: '20' }
    await run(process.execPath, [script, file, folder], { env })
    expect(JSON.parse(readFileSync(join(folder, 'virustotal.json'), 'utf8'))).toEqual({ schemaVersion: 1, label: 'VirusTotal', message: '0 / 71', color: 'brightgreen' })
    const sha256 = createHash('sha256').update('not a real installer').digest('hex')
    const notes = readFileSync(join(folder, 'virustotal.md'), 'utf8')
    expect(notes).toContain('0 / 71 engines flag `Twinmap-Setup-9.9.9.exe`')
    expect(notes).toContain(`https://www.virustotal.com/gui/file/${sha256}`)
    expect(asked).toEqual(['GET /files/upload_url key-of-the-trial', 'POST /upload-here key-of-the-trial', 'GET /analyses/abc key-of-the-trial', 'GET /analyses/abc key-of-the-trial'])
    // With no key nothing is sent, and the script says so.
    await expect(run(process.execPath, [script, file, folder], { env: { ...env, VT_API_KEY: '' } })).rejects.toMatchObject({ stderr: expect.stringContaining('VT_API_KEY is not set') })
  } finally {
    server.close()
  }
})
