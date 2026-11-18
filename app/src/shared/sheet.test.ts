import { expect, test } from 'vitest'
import { heldOf, mergeSheet, sheetNewsFrom, sheetsFrom, type Sheets } from './sheet'

const KEY = 'Catubbio Sucameli'
const first = { key: KEY, code: 'a1b2c3d4', rev: 4, p: { who: { name: KEY, level: 24 }, money: 3440, bags: [{ b: 0, n: 16, s: [[3, 159, 5]] }], gear: [] } }

test('only a sheet is taken from the strip', () => {
  expect(sheetNewsFrom(first)).toEqual(first)
  expect(sheetNewsFrom(null)).toBeNull()
  expect(sheetNewsFrom({ ...first, rev: -1 })).toBeNull()
  expect(sheetNewsFrom({ ...first, key: '' })).toBeNull()
  expect(sheetNewsFrom({ ...first, p: [] })).toBeNull()
})

test('the first news is the whole sheet; later news goes on top, and the app tells back what it holds', () => {
  let sheets: Sheets = mergeSheet({}, sheetNewsFrom(first)!, 1000)
  expect(heldOf(sheets)).toEqual({ [KEY]: { code: 'a1b2c3d4', rev: 4 } })
  sheets = mergeSheet(sheets, { key: KEY, code: 'a1b2c3d4', rev: 6, p: { money: 3415 } }, 2000)
  expect(sheets[KEY]!.pieces).toEqual({ ...first.p, money: 3415 })
  expect(sheets[KEY]!.at).toEqual({ who: 1000, money: 2000, bags: 1000, gear: 1000 })
  expect(heldOf(sheets)[KEY]!.rev).toBe(6)
})

test('news no newer than what is held changes nothing; another code starts the sheet over', () => {
  const sheets = mergeSheet({}, first, 1000)
  expect(mergeSheet(sheets, { ...first, rev: 4, p: { money: 1 } }, 2000)).toBe(sheets)
  const over = mergeSheet(sheets, { key: KEY, code: 'ffff0000', rev: 1, p: { money: 7 } }, 3000)
  expect(over[KEY]).toEqual({ code: 'ffff0000', rev: 1, pieces: { money: 7 }, at: { money: 3000 } })
})

test('each character keeps a sheet of its own', () => {
  const sheets = mergeSheet(mergeSheet({}, first, 1000), { key: 'Brunilde Ferrozampa', code: '00000001', rev: 2, p: { money: 9 } }, 2000)
  expect(Object.keys(heldOf(sheets)).sort()).toEqual(['Brunilde Ferrozampa', KEY])
})

test('what the file holds is read back, and what is not a sheet is dropped', () => {
  const sheets = mergeSheet({}, first, 1000)
  expect(sheetsFrom(JSON.parse(JSON.stringify(sheets)))).toEqual(sheets)
  expect(sheetsFrom({ x: { code: 1 }, ...sheets })).toEqual(sheets)
  expect(sheetsFrom('junk')).toEqual({})
})
