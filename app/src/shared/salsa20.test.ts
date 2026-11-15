import { expect, test } from 'vitest'
import { salsa20 } from './salsa20'

const key = Buffer.from(Array.from({ length: 16 }, (_, i) => i + 1)), nonce = Buffer.from([101, 102, 103, 104, 105, 106, 107, 108])

test('the same call locks and opens, over more than one block', () => {
  const text = Buffer.from('a room of the drowned city, '.repeat(9)) // 252 bytes: four blocks, the last not whole
  const locked = salsa20(key, nonce, text)
  expect(locked.length).toBe(text.length)
  expect(locked.equals(text)).toBe(false)
  expect(salsa20(key, nonce, locked)).toEqual(text)
})

test('another key or another nonce gives another stream, and each block its own', () => {
  const zeros = Buffer.alloc(128), stream = salsa20(key, nonce, zeros)
  expect(stream.subarray(0, 64).equals(stream.subarray(64))).toBe(false)
  expect(salsa20(Buffer.alloc(16, 9), nonce, zeros).equals(stream)).toBe(false)
  expect(salsa20(key, Buffer.alloc(8), zeros).equals(stream)).toBe(false)
})

test('a key or a nonce of another size is refused', () => {
  expect(() => salsa20(Buffer.alloc(32), nonce, Buffer.alloc(1))).toThrow(/16 bytes/)
  expect(() => salsa20(key, Buffer.alloc(4), Buffer.alloc(1))).toThrow(/16 bytes/)
})
