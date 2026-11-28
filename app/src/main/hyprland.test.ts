import { createServer } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { askClients, clientsShowGame, hyprlandSocket } from './hyprland'

test('locates the instance socket', () => {
  expect(hyprlandSocket({ XDG_RUNTIME_DIR: '/run/user/1000', HYPRLAND_INSTANCE_SIGNATURE: 'abc' })).toBe('/run/user/1000/hypr/abc/.socket.sock')
  expect(hyprlandSocket({ XDG_RUNTIME_DIR: '/run/user/1000' })).toBeNull()
})
test('matches only the mapped visible game process', () => {
  const wow = { pid: 42, class: 'steam_app_battlenet', mapped: true }
  expect(clientsShowGame(JSON.stringify([wow]), 42)).toBe(true)
  expect(clientsShowGame(JSON.stringify([wow]), 43)).toBe(false)
  expect(clientsShowGame(JSON.stringify([{ ...wow, mapped: false }]), 42)).toBe(false)
  expect(clientsShowGame(JSON.stringify([{ ...wow, hidden: true }]), 42)).toBe(false)
  expect(clientsShowGame(JSON.stringify([{ ...wow, pid: 7, class: 'wow.exe' }]), 42)).toBe(false)
  expect(clientsShowGame('not json', 42)).toBe(false)
})
test.skipIf(process.platform === 'win32')('queries the socket and handles missing sockets and timeouts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'twinmap-hypr-'))
  const path = join(dir, 's.sock')
  let received = ''
  const server = createServer(socket => { socket.on('data', data => { received += data; socket.end('[]') }) })
  await new Promise<void>(resolve => server.listen(path, resolve))
  expect(await askClients(path)).toBe('[]')
  expect(received).toBe('j/clients')
  await new Promise<void>(resolve => server.close(() => resolve()))
  expect(await askClients(path)).toBeNull()
  const hanging = createServer(socket => { socket.resume() })
  await new Promise<void>(resolve => hanging.listen(path, resolve))
  expect(await askClients(path, 30)).toBeNull()
  await new Promise<void>(resolve => hanging.close(() => resolve()))
  rmSync(dir, { recursive: true, force: true })
})
