import { expect, test } from 'vitest'
import { gameMaps, UI_MAP_ASSIGNMENT_FILE, UI_MAP_FILE } from '../shared/maps'
import { readTable, type Row, type Table } from '../shared/wdc5'
import { gameFolderFrom, openClientFiles, registryInstallPath } from './client-files'

// A row with the given values by column; an array is a column of several numbers.
function row(id: number, values: Record<number, number | string | number[]>): Row {
  const at = (field: number, k: number): number => {
    const v = values[field] ?? 0
    return Array.isArray(v) ? v[k] ?? 0 : (v as number)
  }
  return { id, parent: undefined, int: (f, k = 0) => at(f, k), float: (f, k = 0) => at(f, k), text: (f) => String(values[f] ?? '') }
}
const table = (rows: Row[]): Table => ({ fields: 15, rows, encryptedRows: 0 })

test('a map gets its name, its place in the nesting, and its rectangle in the world', () => {
  const maps = gameMaps(
    table([
      row(1429, { 0: 'Elwynn Forest', 2: 1415, 5: 3 }),
      row(947, { 0: 'Azeroth', 5: 1 }),
      row(1414, { 0: 'Kalimdor', 2: 947, 5: 2 }),
      row(2000, { 0: 'Nowhere', 5: 9 }),
    ]),
    table([
      row(1, { 2: [-10254.2, -1935.4, -1e6, -7939.6, 1535.4, 1e6], 4: 1429, 6: 0, 7: 12 }),
      row(2, { 2: [-11733.3, -19733.2, -1e6, 12799.9, 17066.6, 1e6], 4: 1414, 6: 1 }),
      // The whole world lies on both continents: the first in order is kept.
      row(3, { 2: [9, 9, 0, 9, 9, 0], 4: 947, 5: 1, 6: 1 }),
      row(4, { 2: [-16000, -7466.7, -1e6, 6933.3, 8000, 1e6], 4: 947, 5: 0, 6: 0 }),
    ]),
  )
  expect(maps.map((m) => m.id)).toEqual([947, 1414, 1429, 2000])
  expect(maps[2]).toEqual({
    id: 1429, name: 'Elwynn Forest', parent: 1415, level: 'zone', continent: 0, area: 12,
    rect: { minX: -10254.2, minY: -1935.4, maxX: -7939.6, maxY: 1535.4 },
  })
  expect([maps[0]!.level, maps[0]!.rect?.maxY, maps[1]!.level, maps[1]!.continent]).toEqual(['world', 8000, 'continent', 1])
  expect(maps[3]).toMatchObject({ level: 'other', continent: null, rect: null })
})

// On a PC with the game: the real tables. The rectangles are the ones known for these zones
// since the first version of the game (left, top, width, height in yards).
const real = gameFolderFrom([registryInstallPath()])
test.skipIf(!real)('the real game lists its 60 maps, with names and the known rectangles', () => {
  const client = openClientFiles(real!)
  const maps = gameMaps(readTable(client.read(UI_MAP_FILE)!), readTable(client.read(UI_MAP_ASSIGNMENT_FILE)!))
  expect(maps).toHaveLength(60)
  expect(maps.every((m) => m.name.length > 0 && m.rect !== null)).toBe(true)
  const known: [number, string, number, number, number, number, 0 | 1][] = [
    [1429, 'Elwynn Forest', 1535.42, -7939.58, 3470.83, 2314.58, 0],
    [1411, 'Durotar', -1962.5, 1808.33, 5287.5, 3525, 1],
    [1432, 'Loch Modan', -1993.75, -4487.5, 2758.33, 1839.58, 0],
  ]
  for (const [id, name, left, top, width, height, continent] of known) {
    const m = maps.find((x) => x.id === id)!
    expect([m.name, m.level, m.continent]).toEqual([name, 'zone', continent])
    expect(m.rect!.maxY).toBeCloseTo(left, 1)
    expect(m.rect!.maxX).toBeCloseTo(top, 1)
    expect(m.rect!.maxY - m.rect!.minY).toBeCloseTo(width, 1)
    expect(m.rect!.maxX - m.rect!.minX).toBeCloseTo(height, 1)
  }
  console.log(maps.map((m) => `${m.id} ${m.name} (${m.level}${m.continent === null ? '' : ', ' + m.continent})`).join('; '))
})
