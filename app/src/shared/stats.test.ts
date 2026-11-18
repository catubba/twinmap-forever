import { expect, test } from 'vitest'
import { statsOf } from './stats'

test('the statistics come as the game words them, and what is not a line is left out', () => {
  const piece = [
    ['General', [['Health', '1,099'], ['Mana', '1,683']]],
    ['Primary Attributes', [['Strength', '29', '19ff19'], ['Agility', '35'], ['Bad', 3], 'no', ['Odd', '1', 'red']]],
    ['Empty', []],
    'no',
    [7, []],
  ]
  expect(statsOf(piece)).toEqual([
    { name: 'General', lines: [{ label: 'Health', value: '1,099' }, { label: 'Mana', value: '1,683' }] },
    { name: 'Primary Attributes', lines: [{ label: 'Strength', value: '29', color: '#19ff19' }, { label: 'Agility', value: '35' }, { label: 'Odd', value: '1' }] },
  ])
  expect(statsOf(undefined)).toEqual([]) // a sheet from an addon before the statistics
})
