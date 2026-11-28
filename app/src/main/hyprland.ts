import { connect } from 'node:net'
import { join } from 'node:path'

export function hyprlandSocket(env: Record<string, string | undefined>): string | null {
  const dir = env.XDG_RUNTIME_DIR, instance = env.HYPRLAND_INSTANCE_SIGNATURE
  return dir && instance && !instance.includes('/') ? join(dir, 'hypr', instance, '.socket.sock') : null
}
export function clientsShowGame(json: string, pid: number): boolean {
  try {
    const clients: unknown = JSON.parse(json)
    return Array.isArray(clients) && clients.some(c => c && c.pid === pid && c.mapped === true && c.hidden !== true)
  } catch { return false }
}
export function askClients(path: string, timeoutMs = 500): Promise<string | null> {
  return new Promise(resolve => {
    const socket = connect(path)
    let result = '', done = false
    const finish = (value: string | null): void => {
      if (done) return
      done = true
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(timeoutMs, () => finish(null))
    socket.on('connect', () => socket.write('j/clients'))
    socket.on('data', data => { result += data; if (result.length > 4_000_000) finish(null) })
    socket.on('end', () => finish(result))
    socket.on('error', () => finish(null))
  })
}
