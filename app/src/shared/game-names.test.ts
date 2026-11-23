import { afterEach, expect, test } from 'vitest'
import { gameName, pairNames, setGameNames, wingNames } from './game-names'

afterEach(() => setGameNames({}))

const table = (rows: [number, string][]) => ({ rows: rows.map(([id, name]) => ({ id, text: () => name })) })

test('a name the app keeps in English is said as the game says it, by the same row of its tables in the two languages', () => {
  const names: Record<string, string> = {}
  pairNames(table([[1, 'Deadmines'], [2, 'Dire Maul - East'], [3, 'Same']]), table([[1, 'Мертвые копи'], [2, 'Забытый город: восток'], [3, 'Same']]), 0, names)
  expect(names).toEqual({ Deadmines: 'Мертвые копи', 'Dire Maul - East': 'Забытый город: восток' })
  setGameNames(names)
  // As the pins write it: with "The", and a colon for the game's dash.
  expect(gameName('The Deadmines')).toBe('Мертвые копи')
  expect(gameName('Dire Maul: East')).toBe('Забытый город: восток')
  expect(gameName('Hogger'), 'English where the game has no other').toBe('Hogger')
})

test('the first name a table gives stays, and a row the other language lacks gives none', () => {
  const names: Record<string, string> = { Armory: 'Оружейная' }
  pairNames(table([[1, 'Armory'], [2, 'Stockade']]), table([[1, 'Арсенал']]), 0, names)
  expect(names).toEqual({ Armory: 'Оружейная' })
})

test('the wings of Scarlet Monastery are its name in the game and the word of the wing in that language', () => {
  const names: Record<string, string> = { 'Scarlet Monastery': '血色修道院' }
  wingNames(['Scarlet Monastery: Library', 'The Deadmines'], 'zhCN', names)
  expect(names['Scarlet Monastery: Library']).toBe('血色修道院：图书馆')
  expect(names['The Deadmines']).toBeUndefined()
})
