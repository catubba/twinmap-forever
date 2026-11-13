import { execFile } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

const run = promisify(execFile)
const script = join(__dirname, 'curseforge.js')
const { gameVersionName } = require('./curseforge.js') as { gameVersionName: (iface: string) => string }

test('an interface number names its game version', () => {
  expect(gameVersionName('16001')).toBe('1.60.1')
  expect(gameVersionName('110207')).toBe('11.2.7')
})

test('the zip goes to the project with the game version of the .toc, and a .toc of another version stops it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'twinmap-cf-'))
  const zip = join(dir, 'TwinmapForever-1.2.3.zip')
  const toc = join(dir, 'TwinmapForever.toc')
  const notes = join(dir, 'notes.md')
  writeFileSync(zip, 'zip bytes')
  writeFileSync(toc, '## Interface: 16001\r\n## Version: 1.2.3\r\n')
  writeFileSync(notes, 'What changed.')

  const seen: { url: string; token: unknown; body: string }[] = []
  const server = createServer((request, answer) => {
    const parts: Buffer[] = []
    request.on('data', (part: Buffer) => parts.push(part))
    request.on('end', () => {
      seen.push({ url: request.url ?? '', token: request.headers['x-api-token'], body: Buffer.concat(parts).toString() })
      answer.setHeader('content-type', 'application/json')
      answer.end(request.url === '/api/game/versions' ? JSON.stringify([{ id: 7, name: '1.60.1' }, { id: 8, name: '11.2.7' }]) : JSON.stringify({ id: 4242 }))
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const env = { ...process.env, CF_API: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, CF_API_TOKEN: 'a-token', CF_PROJECT_ID: '99' }
  try {
    const { stdout } = await run(process.execPath, [script, zip, toc, '1.2.3', notes], { env })
    expect(stdout).toContain('file 4242')
    const sent = seen.find((s) => s.url === '/api/projects/99/upload-file')!
    expect(sent.token).toBe('a-token')
    expect(sent.body).toContain('"gameVersions":[7]')
    expect(sent.body).toContain('"relations":{"projects":[{"slug":"questiedb","type":"requiredDependency"}]}')
    expect(sent.body).toContain('"displayName":"Twinmap Forever 1.2.3"')
    expect(sent.body).toContain('zip bytes')

    await expect(run(process.execPath, [script, zip, toc, '9.9.9', notes], { env })).rejects.toThrow(/the release is 9\.9\.9/)
    expect(seen.filter((s) => s.url.endsWith('upload-file'))).toHaveLength(1)
  } finally {
    server.close()
  }
})
