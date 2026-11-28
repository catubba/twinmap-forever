import { describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { waitForMappedWindow } = require('./probe-window.cjs')

describe('synthetic probe window readiness', () => {
  test('waits for the exact mapped visible window before continuing', async () => {
    let calls = 0
    const query = async () => ++calls === 1
      ? [{ title: 'probe', pid: 42, mapped: true, hidden: true }, { title: 'probe', pid: 42, mapped: false }]
      : [{ title: 'probe', pid: 41, mapped: true }, { title: 'probe', pid: 42, mapped: true, hidden: false }]
    await waitForMappedWindow('probe', 42, { query, timeout: 100, interval: 1 })
    expect(calls).toBe(2)
  })

  test('times out instead of opening the picker for an unmapped window', async () => {
    await expect(waitForMappedWindow('probe', 42, {
      query: async () => [{ title: 'probe', pid: 42, mapped: false }], timeout: 20, interval: 1
    })).rejects.toThrow('not mapped')
  })

  test('bounds a stalled compositor query', async () => {
    await expect(waitForMappedWindow('probe', 42, {
      query: () => new Promise(() => {}), timeout: 20, interval: 1
    })).rejects.toThrow('not mapped')
  })
})
