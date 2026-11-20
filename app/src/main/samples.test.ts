import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { inflateSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { sampleFor } from '../../../server/src/index'
import type { InsideReport } from './minimap'
import { roundPng, sendSamples, startSamples } from './samples'

let shade = 0 // each picture another one, as a minimap is when the character moves
const box = (size = 64) => ({ size, rgb: new Uint8Array(size * size * 3).fill(100 + (shade++ % 100)) })
const found = (u: number, score = 0.9): InsideReport => ({ dungeon: 36, pictures: 1, zoom: 0, picture: 0, place: { u, v: 10, score } })
const lost: InsideReport = { dungeon: 36, pictures: 1, zoom: 0, why: 'not sure' }
const own = (): boolean => true

test('the picture is black outside the circle of the minimap and whole inside it', () => {
  const png = roundPng({ size: 64, rgb: new Uint8Array(64 * 64 * 3).fill(200) }), raw = inflateSync(png.subarray(41, png.length - 16))
  expect(png.readUInt32BE(16)).toBe(64)
  expect([raw[1], raw[2], raw[3]]).toEqual([0, 0, 0]) // the corner
  expect(raw[1 + 32 * 3]).toBe(200) // the middle of the first row, inside the circle
})

test('a picture too heavy for the server is halved', () => {
  let seed = 1
  const noise = { size: 400, rgb: new Uint8Array(400 * 400 * 3).map(() => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 16) & 255) }
  const png = roundPng(noise)
  expect(png.readUInt32BE(16)).toBe(200)
  expect(png.length).toBeLessThanOrEqual(200_000)
})

test('with the choice off nothing is kept, and turning it off lets go of what was', () => {
  let on = false
  const samples = startSamples(() => on)
  samples.take(lost, box(), own, 0)
  expect(samples.take(null, null, own, 1000)).toBeNull()
  on = true
  samples.take(lost, box(), own, 2000)
  on = false
  expect(samples.take(null, null, own, 3000)).toBeNull()
})

test('a sample for each place not found, one a room where it is, and the run when the dungeon is left', () => {
  const samples = startSamples(() => true)
  expect(samples.take(found(10), box(), own, 0)).toBeNull()
  samples.take(found(11), box(), own, 500) // the same room, too soon
  samples.take(found(90), box(), own, 1000) // another room
  samples.take(found(12), box(), own, 31_000) // the first room, half a minute on: it has its sample
  samples.take(found(12), box(), own, 301_000) // and five minutes on it still has
  samples.take(lost, box(), own, 302_000)
  samples.take(lost, box(), own, 303_000) // lost a moment ago
  samples.take(found(13, 0.65), box(), own, 313_000) // followed under SURE: a place not found for sure, with where it was put
  samples.take(lost, box(), () => false, 330_000) // something lies over the game: not taken
  samples.take({ dungeon: 36, pictures: 1, zoom: 0, why: 'minimap turns' }, box(), own, 350_000) // no look at the screen
  const run = samples.take(null, null, own, 360_000)!
  expect(run.id).toMatch(/^[0-9a-f]{16}$/)
  expect(run.samples.map((s) => s.fields)).toEqual([
    { n: '0', map: '36', zoom: '0', u: '10', v: '10', score: '0.9' },
    { n: '1', map: '36', zoom: '0', u: '90', v: '10', score: '0.9' },
    { n: '2', map: '36', zoom: '0' },
    { n: '3', map: '36', zoom: '0', u: '13', v: '10', score: '0.65' },
  ])
  // What is sent is what the server takes.
  for (const sample of run.samples) expect(sampleFor(new URLSearchParams({ run: run.id, app: '0.12.1', build: '1.60.1.70959', locale: 'enUS', ...sample.fields }), sample.png)).toHaveProperty('key')
  // The next dungeon is another run, and one with nothing kept is no run.
  samples.take(lost, box(), own, 400_000)
  expect(samples.take({ ...lost, dungeon: 48 }, box(), own, 401_000)!.id).not.toBe(run.id)
  expect(startSamples(() => true).take(null, null, own, 0)).toBeNull()
})

test('a run holds a hundred samples at most', () => {
  const samples = startSamples(() => true)
  for (let i = 0; i < 150; i++) samples.take(lost, box(), own, i * 10_000)
  expect(samples.take(null, null, own, 2e6)!.samples).toHaveLength(100)
  // Standing lost, the same picture again and again is kept once.
  const still = box()
  for (let i = 0; i < 5; i++) samples.take(lost, still, own, i * 10_000)
  expect(samples.take(null, null, own, 2e6)!.samples).toHaveLength(1)
})

// A server on this computer plays api.twinmap.app: nothing in this test leaves it.
test('the server is asked what it wants, then the samples go one by one, stop when the choice is turned off, and stop at the first refusal', async () => {
  const got: string[] = []
  let refuse = false, want: unknown = { minimap: { found: 9, failed: 9 } }
  const server = createServer((request, answer) => {
    if (request.method === 'GET') return void answer.writeHead(request.url === '/want?map=36&app=0.12.1' && want ? 200 : 500).end(JSON.stringify(want))
    got.push(request.url!)
    request.resume().on('end', () => answer.writeHead(refuse ? 503 : 201).end('{}'))
  })
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
  const to = `http://127.0.0.1:${(server.address() as AddressInfo).port}/sample`
  const samples = startSamples(() => true)
  for (let i = 0; i < 3; i++) samples.take(lost, box(), own, i * 10_000)
  samples.take(found(10), box(), own, 40_000)
  const run = samples.take(null, null, own, 1e6)!, said = { app: '0.12.1', build: '1.60.1.70959', locale: 'enUS' }
  expect(await sendSamples(run, said, () => true, to, 0)).toBe(4)
  expect(got[0]).toBe(`/sample?run=${run.id}&app=0.12.1&build=1.60.1.70959&locale=enUS&n=0&map=36&zoom=0`)
  let asked = 0
  expect(await sendSamples(run, said, () => asked++ < 2, to, 0)).toBe(1)
  expect(await sendSamples(run, said, () => false, to, 0)).toBe(0)
  refuse = true
  expect(await sendSamples(run, said, () => true, to, 0)).toBe(0)
  expect(got).toHaveLength(4 + 1 + 0 + 1)
  // No more than the server wants of each kind, and nothing when it does not answer what it wants.
  refuse = false
  want = { minimap: { found: 0, failed: 2 } }
  expect(await sendSamples(run, said, () => true, to, 0)).toBe(2)
  expect(got.slice(-2).map((url) => /&n=(\d+)/.exec(url)![1])).toEqual(['0', '1'])
  want = { minimap: { found: 1, failed: 0 } }
  expect(await sendSamples(run, said, () => true, to, 0)).toBe(1)
  expect(got.at(-1)).toContain('&n=3&')
  // The kind switched off on the server is not in the answer: nothing goes.
  want = {}
  expect(await sendSamples(run, said, () => true, to, 0)).toBe(0)
  want = null
  expect(await sendSamples(run, said, () => true, to, 0)).toBe(0)
  expect(await sendSamples(run, said, () => true, 'http://127.0.0.1:9/sample', 0)).toBe(0)
  server.close()
})
