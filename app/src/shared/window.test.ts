import { expect, test } from 'vitest'
import { WINDOW } from './window'

test('the first window is never smaller than its own minimum', () => {
  expect(WINDOW.width).toBeGreaterThanOrEqual(WINDOW.minWidth)
  expect(WINDOW.height).toBeGreaterThanOrEqual(WINDOW.minHeight)
})
