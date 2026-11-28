import { expect, test } from 'vitest'
import { createTrust } from './capture-trust'

test('trust belongs only to the session that decoded a block', () => {
  const trust = createTrust()
  expect(trust.trusted(1)).toBe(false)
  trust.decoded(1)
  expect(trust.trusted(1)).toBe(true)
  expect(trust.trusted(null)).toBe(false)
  expect(trust.trusted(2)).toBe(false)
  trust.decoded(2)
  expect(trust.trusted(1)).toBe(false)
  expect(trust.trusted(2)).toBe(true)
  trust.clear()
  expect(trust.trusted(2)).toBe(false)
})
