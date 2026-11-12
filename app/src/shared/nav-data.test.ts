import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { navFrom, NAV_FORMAT } from './nav-data'

const file = (map: number): string => readFileSync(join(__dirname, '..', '..', 'resources', 'nav', `nav${map}.json`), 'utf8')

test('the grid the app ships covers the two continents, and says where it comes from', () => {
  const [east, kalimdor] = [navFrom(file(0))!, navFrom(file(1))!]
  expect(east.map).toBe(0)
  expect(kalimdor.map).toBe(1)
  for (const nav of [east, kalimdor]) {
    expect(nav.format).toBe(NAV_FORMAT)
    expect(nav.from).toMatch(/^Shortest Path Forever v\d/)
    expect(nav.source.join(' ')).toMatch(/wowf \d+\.\d+\.\d+\.\d+/)
    expect(nav.cells).toBe(67)
    // Every cluster with ground has its heights too, and no cluster lies outside the grid.
    const grids = Object.keys(nav.packed.grid)
    expect(grids.length).toBeGreaterThan(700)
    expect(Object.keys(nav.packed.height).length).toBe(grids.length)
    expect(Math.max(...grids.map(Number))).toBeLessThan(nav.nx * nav.ny)
  }
  expect(Object.keys(east.roads).length).toBeGreaterThan(100)
})

test('a cluster of the grid unpacks to one symbol a cell or a run of cells, never more cells than it has', () => {
  const nav = navFrom(file(0))!
  const [cluster, blocks] = Object.entries(nav.packed.grid)[100]!
  const symbols = Buffer.concat(blocks.map((b) => inflateSync(Buffer.from(b, 'base64')))).toString('latin1')
  expect(symbols, `cluster ${cluster}`).toMatch(/^[A-Za-z0-9+/]+$/)
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  // A symbol under 48 is a cell; one from 48 on repeats the cell before it (symbol - 47) times.
  const cells = [...symbols].reduce((n, c) => n + (B64.indexOf(c) < 48 ? 1 : B64.indexOf(c) - 47), 0)
  expect(cells).toBe(nav.cells * nav.cells)
})

test('what is not a grid of the format the app reads is none', () => {
  const good = JSON.parse(file(0)) as Record<string, unknown>
  expect(navFrom(JSON.stringify({ ...good, format: NAV_FORMAT + 1 })), 'a newer format').toBeNull()
  expect(navFrom(JSON.stringify({ ...good, packed: { grid: {} } })), 'fields missing').toBeNull()
  expect(navFrom(JSON.stringify({ ...good, cells: '67' }))).toBeNull()
  expect(navFrom('not json')).toBeNull()
  expect(navFrom('[]')).toBeNull()
})
