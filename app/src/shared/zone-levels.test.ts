import { expect, test } from 'vitest'
import { greyLevel, zoneDifficulty } from './zone-levels'

test('a zone is red five levels over the character, then orange, yellow round it, green, and grey where it gives no XP', () => {
  // Westfall, 10 to 20.
  expect([4, 5, 7, 8, 10, 15, 20, 22, 23, 26, 27].map((level) => zoneDifficulty([10, 20], level))).toEqual(['red', 'red', 'orange', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'green', 'green', 'grey'])
  expect(zoneDifficulty([55, 60], 60)).toBe('yellow')
  expect(zoneDifficulty([1, 10], 60)).toBe('grey')
})

test('the grey level follows the game: none up to 5, then a step every ten levels and every five', () => {
  expect([5, 6, 10, 20, 39, 40, 59, 60].map(greyLevel)).toEqual([0, 1, 4, 13, 31, 31, 47, 51])
})
