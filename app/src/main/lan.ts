// The map on the home network: the app's own page, served to a phone or a tablet in the house.
// Off until the player turns it on. Who asks must be on a private address and hold the code that
// the settings show; everyone else gets nothing. The page hears the app on /events and asks it
// things on /call/<name>, the same things the app's own window asks.
import { timingSafeEqual } from 'node:crypto'
import { createSocket } from 'node:dgram'
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname, join, sep } from 'node:path'

export const LAN_PORT = 8765 // always the same, so an address saved on the phone keeps working

const BODY_MOST = 256 * 1024 // bytes of what a page may send with one asking
const WAITING_MOST = 4 * 1024 * 1024 // bytes a screen may leave unread before it is let go: it comes back by itself

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

/** An address of a home network or of this computer: the private ranges, and no other. */
export function isHome(address: string | undefined): boolean {
  if (!address) return false
  const a = address.toLowerCase().replace(/^::ffff:/, '')
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(a)
  if (v4) {
    const x = Number(v4[1]), y = Number(v4[2])
    return x === 10 || x === 127 || (x === 192 && y === 168) || (x === 172 && y >= 16 && y <= 31) || (x === 169 && y === 254)
  }
  return a === '::1' || /^fe[89ab][0-9a-f]:/.test(a) || /^f[cd][0-9a-f]{2}:/.test(a)
}

/**
 * The address other devices of the house reach this computer at, or null when it is on no network.
 * The one the system would leave from (asked without sending anything), since a PC often has
 * more than one: virtual machines, VPNs.
 */
export function homeAddress(): Promise<string | null> {
  const first = (): string | null =>
    Object.values(networkInterfaces())
      .flatMap((list) => list ?? [])
      .find((i) => i.family === 'IPv4' && !i.internal && isHome(i.address))?.address ?? null
  return new Promise((resolve) => {
    const socket = createSocket('udp4')
    const done = (address: string | null): void => {
      socket.close()
      resolve(address && isHome(address) && !address.startsWith('127.') ? address : first())
    }
    socket.once('error', () => done(null))
    socket.connect(53, '1.1.1.1', () => done(socket.address().address))
  })
}

/** What a file of the map answers: the bytes and their kind, or a status alone. */
export interface Served {
  status: number
  type?: string
  bytes?: Uint8Array
}

export interface LanAsks {
  /** The code a device must show: in the address the first time, kept by its browser after. */
  code: string
  /** The folder of the built page. */
  page: string
  /** A file of the map, by its path under /tiles. */
  tile: (path: string) => Promise<Served>
  /** What a page may ask for, by name. Each checks what it is given, as for the app's own window. */
  calls: Record<string, (...args: unknown[]) => unknown>
}

export interface Lan {
  /** Tells every screen something new on a channel, and whoever comes later the latest of it. */
  tell: (channel: string, told: unknown) => void
  stop: () => void
}

const same = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

function body(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      if ((size += chunk.length) > BODY_MOST) return void req.destroy(new Error('too much'))
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Starts answering on the port. failed: called once if the port cannot be had. */
export function startLan(port: number, asks: LanAsks, failed: (message: string) => void): Lan {
  const screens = new Set<ServerResponse>()
  const last = new Map<string, string>()
  // Each piece of news carries the time of this computer when it left: a phone's clock is not this one's.
  const frame = (channel: string, text: string): string => `id: ${Date.now()}\nevent: ${channel}\ndata: ${text}\n\n`

  async function answer(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const plain = (status: number, text = ''): void => void res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }).end(text)
    if (!isHome(req.socket.remoteAddress)) return plain(403)
    const url = new URL(req.url ?? '/', 'http://twinmap')
    // The address of the settings carries the code. The page comes with it at once and the browser is
    // given the code to keep: the page then takes it off its address bar (renderer/src/web.ts).
    // Lax and not Strict, and no sending on to the plain address: a phone gets here from its camera
    // or from another app, and a browser holds a Strict cookie back on a visit that began elsewhere.
    const shown = url.searchParams.get('k'), fresh = shown !== null && same(shown, asks.code)
    const kept = /(?:^|;\s*)k=([^;]+)/.exec(req.headers.cookie ?? '')?.[1]
    if (!fresh && !(kept && same(kept, asks.code))) return plain(403, "Open Twinmap's settings on the computer and scan the code again.")

    if (url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
      for (const [channel, text] of last) res.write(frame(channel, text))
      screens.add(res)
      req.on('close', () => screens.delete(res))
      return
    }

    const call = /^\/call\/([a-z-]{1,40})$/.exec(url.pathname)
    if (call) {
      const asked = Object.hasOwn(asks.calls, call[1]!) ? asks.calls[call[1]!] : undefined
      if (!asked || req.method !== 'POST') return plain(404)
      let args: unknown
      try {
        args = JSON.parse(await body(req))
      } catch {
        return plain(400)
      }
      const out: unknown = await asked(...(Array.isArray(args) ? args : []))
      return void res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(out ?? null))
    }

    if (url.pathname.startsWith('/tiles/')) {
      const served = await asks.tile(url.pathname.slice('/tiles'.length))
      return void res.writeHead(served.status, served.bytes ? { 'content-type': served.type, 'cache-control': 'max-age=3600' } : {}).end(served.bytes)
    }

    // The page and what it is made of. Nothing above its folder.
    const file = join(asks.page, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname))
    const type = TYPES[extname(file)]
    const bytes = type && file.startsWith(asks.page + sep) ? await readFile(file).catch(() => null) : null
    if (!bytes) return plain(404)
    // The page itself is asked for every time, so an app that was updated shows its new one; its parts carry their own names.
    res.writeHead(200, {
      'content-type': type,
      'cache-control': file.endsWith('index.html') ? 'no-store' : 'max-age=31536000, immutable',
      ...(fresh ? { 'set-cookie': `k=${asks.code}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax` } : {}),
    }).end(bytes)
  }

  const server = createServer((req, res) => {
    answer(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })
  server.once('error', (e: NodeJS.ErrnoException) => failed(e.code === 'EADDRINUSE' ? `Port ${port} is taken by another program.` : e.message))
  server.listen(port)

  return {
    tell: (channel, told) => {
      const text = JSON.stringify(told)
      if (last.get(channel) === text) return
      last.set(channel, text)
      for (const screen of screens) {
        // A phone that went to sleep reads nothing: what waits for it must not pile up here.
        if (screen.writableLength > WAITING_MOST) screen.destroy()
        else screen.write(frame(channel, text))
      }
    },
    stop: () => {
      for (const screen of screens) screen.destroy()
      server.close()
      server.closeAllConnections()
    },
  }
}
