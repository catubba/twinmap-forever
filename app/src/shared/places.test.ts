import { expect, test } from 'vitest'
import { unitsOfPlace, unitsOfWorld } from './geo'
import type { GameMap } from './maps'
import { fitNames, places, tierShows } from './places'
import type { Row, Table } from './wdc5'

// A row with the given values by column; an array is a column of several numbers.
function row(id: number, parent: number | undefined, values: Record<number, number | string | number[]>): Row {
  const at = (field: number, k: number): number => {
    const v = values[field] ?? 0
    return Array.isArray(v) ? v[k] ?? 0 : (v as number)
  }
  return { id, parent, int: (f, k = 0) => at(f, k), float: (f, k = 0) => at(f, k), text: (f) => String(values[f] ?? '') }
}
const table = (rows: Row[]): Table => ({ fields: 22, rows, encryptedRows: 0 })

const ELWYNN = { minX: -10254.2, minY: -1935.4, maxX: -7939.6, maxY: 1535.4 }
const MAPS = [
  { id: 1429, name: 'Elwynn Forest', parent: 1415, level: 'zone', continent: 0, rect: ELWYNN, area: 12 },
  { id: 1453, name: 'Stormwind City', parent: 1415, level: 'zone', continent: 0, rect: { minX: -9154.2, minY: -14.6, maxX: -7995.8, maxY: 1722.9 }, area: 1519 },
] as GameMap[]
const point = (name: string, north: number, west: number, importance: number, continent = 0): Row => row(1, continent, { 0: name, 3: [north, west, 0], 20: importance })
const overlay = (art: number, area: number, left: number, top: number, width: number, height: number): Row => row(1, art, { 2: width, 3: height, 4: left, 5: top, 12: [area, 0, 0, 0] })
const ARTS = table([row(1, 1429, { 1: 500 }), row(2, 9999, { 1: 501 })])
const AREAS = table([row(87, undefined, { 1: 'Goldshire' }), row(57, undefined, { 1: 'Crystal Lake' }), row(1519, undefined, { 1: 'Stormwind City' }), row(60, undefined, { 1: 'Elsewhere' })])

test('towns and points come from AreaPOI at their place in the world, towns by their importance', () => {
  const found = places(table([point('Goldshire', -9480.1, 63.5, 3), point('Mirror Lake', -9400, 500, 0)]), table([]), ARTS, AREAS, MAPS)
  expect(found.map((p) => [p.name, p.kind, p.continent])).toEqual([['Goldshire', 'town', 0], ['Mirror Lake', 'poi', 0]])
  expect(found[0]).toMatchObject(unitsOfWorld(-9480.1, 63.5))
})

test('a point off every map, on another world, or named like many others is left out', () => {
  const marks = Array.from({ length: 3 }, () => point('Under Attack', -9480, 60, 3))
  const found = places(table([point('Far Away', 5000, 5000, 3), point('Alterac Tower', -9480, 60, 0, 30), ...marks, point('Goldshire', -9480.1, 63.5, 3)]), table([]), ARTS, AREAS, MAPS)
  expect(found.map((p) => p.name)).toEqual(['Goldshire'])
})

test('an area is named at the middle of its part of the zone map', () => {
  const [lake] = places(table([]), table([overlay(500, 57, 451, 284, 100, 100)]), ARTS, AREAS, MAPS)
  expect(lake).toMatchObject({ name: 'Crystal Lake', kind: 'area', continent: 0 })
  const middle = unitsOfPlace(ELWYNN, 50, 50)
  expect(lake!.x).toBeCloseTo(middle.x, 1)
  expect(lake!.y).toBeCloseTo(middle.y, 1)
})

test('an area gives way to a point of its name, to a zone of its name, and is named once', () => {
  const poi = table([point('Goldshire', -9480.1, 63.5, 3)])
  const overlays = table([overlay(500, 87, 300, 300, 100, 100), overlay(500, 1519, 100, 100, 200, 200), overlay(500, 57, 451, 284, 100, 100), overlay(500, 57, 600, 400, 50, 50), overlay(501, 60, 10, 10, 50, 50), overlay(500, 999, 10, 10, 50, 50)])
  expect(places(poi, overlays, ARTS, AREAS, MAPS).map((p) => `${p.name} ${p.kind}`)).toEqual(['Goldshire town', 'Crystal Lake area'])
})

test('each kind of name has its zooms: far away the regions, closer the towns, close the areas', () => {
  const at = (zoom: number): string[] => (['region', 'town', 'poi', 'area'] as const).filter((t) => tierShows(t, zoom))
  expect(at(1)).toEqual(['region'])
  expect(at(2.5)).toEqual(['region'])
  expect(at(4.5)).toEqual(['region', 'town'])
  expect(at(5)).toEqual(['town', 'poi'])
  expect(at(7)).toEqual(['town', 'poi', 'area'])
  expect(at(8.5)).toEqual(['poi', 'area'])
})

test('a name that would touch one already shown, or the arrow, is not shown', () => {
  const box = (id: number, x: number, y: number) => ({ id, x, y, width: 100, height: 20 })
  expect([...fitNames([box(1, 100, 100), box(2, 150, 105), box(3, 100, 140), box(4, 300, 100)])]).toEqual([1, 3, 4])
  expect([...fitNames([box(1, 100, 100), box(2, 300, 100)], [{ left: 80, top: 90, right: 110, bottom: 110 }])]).toEqual([2])
  expect([...fitNames([box(2, 150, 105), box(1, 100, 100)])], 'the first in order wins').toEqual([2])
})
