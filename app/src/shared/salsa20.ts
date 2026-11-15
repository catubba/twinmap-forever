// Salsa20, the cipher the game locks parts of its files with: a key of 16 bytes and a nonce of 8
// make a stream of bytes that is xored over the data. The same call locks and opens.

const turn = (v: number, by: number): number => (v << by) | (v >>> (32 - by))

function quarter(x: Uint32Array, a: number, b: number, c: number, d: number): void {
  x[b]! ^= turn((x[a]! + x[d]!) | 0, 7)
  x[c]! ^= turn((x[b]! + x[a]!) | 0, 9)
  x[d]! ^= turn((x[c]! + x[b]!) | 0, 13)
  x[a]! ^= turn((x[d]! + x[c]!) | 0, 18)
}

export function salsa20(key: Uint8Array, nonce: Uint8Array, data: Uint8Array): Buffer {
  if (key.length !== 16 || nonce.length !== 8) throw new Error('Salsa20 here takes a key of 16 bytes and a nonce of 8')
  const word = (b: Uint8Array, at: number): number => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0
  const k = [0, 4, 8, 12].map((at) => word(key, at)), c = new TextEncoder().encode('expand 16-byte k')
  // The sixteen words: constants on the diagonal, the key twice, the nonce, the count of blocks.
  const state = new Uint32Array([word(c, 0), k[0]!, k[1]!, k[2]!, k[3]!, word(c, 4), word(nonce, 0), word(nonce, 4), 0, 0, word(c, 8), k[0]!, k[1]!, k[2]!, k[3]!, word(c, 12)])
  const out = Buffer.alloc(data.length), block = Buffer.alloc(64)
  for (let at = 0; at < data.length; at += 64) {
    const x = new Uint32Array(state)
    for (let round = 0; round < 10; round++) {
      quarter(x, 0, 4, 8, 12); quarter(x, 5, 9, 13, 1); quarter(x, 10, 14, 2, 6); quarter(x, 15, 3, 7, 11)
      quarter(x, 0, 1, 2, 3); quarter(x, 5, 6, 7, 4); quarter(x, 10, 11, 8, 9); quarter(x, 15, 12, 13, 14)
    }
    for (let i = 0; i < 16; i++) block.writeUInt32LE((x[i]! + state[i]!) >>> 0, i * 4)
    for (let i = 0; i < 64 && at + i < data.length; i++) out[at + i] = data[at + i]! ^ block[i]!
    if (++state[8]! === 0) state[9]!++
  }
  return out
}
