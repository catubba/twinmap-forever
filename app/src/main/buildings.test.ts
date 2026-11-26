import { describe, expect, it } from 'vitest'
import { skySeen } from './buildings'
import { servedFile } from './tiles'

// A box of side s at (x, y, z), its six faces in two triangles each, as points and triangles from first.
function box(x: number, y: number, z: number, s: number, first: number): { pos: number[]; tris: number[] } {
  const pos: number[] = []
  for (let i = 0; i < 8; i++) pos.push(x + (i & 1 ? s : 0), y + (i & 2 ? s : 0), z + (i & 4 ? s : 0))
  const faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
  return { pos, tris: faces.flatMap(([a, b, c, d]) => [a, b, c, a, c, d].map((v) => v! + first)) }
}

describe('the triangles the sky sees', () => {
  it('keeps a hall and a thin wall seen aslant, leaves out a room shut inside it', () => {
    const hall = box(0, 0, 0, 20, 0), room = box(8, 2, 8, 4, 8)
    // a wall a tenth of a pixel thick, standing on the roof of the hall: seen only aslant, between pixels
    const wall = { pos: [0, 20, 30, 10, 20, 30, 0, 25, 30.03], tris: [16, 17, 18] }
    const seen = skySeen(new Float32Array([...hall.pos, ...room.pos, ...wall.pos]), new Uint32Array([...hall.tris, ...room.tris, ...wall.tris]), 3)
    // the floor of the hall faces down: the sky sees it through no wall, yet from 15 degrees it sees the sides
    expect([...seen.subarray(0, 12)].filter(Boolean).length).toBeGreaterThanOrEqual(10)
    expect([...seen.subarray(12, 24)]).toEqual(new Array(12).fill(0))
    expect(seen[24]).toBe(1)
  })
})

describe('the files of the buildings the window may ask for', () => {
  it('serves a building, its textures and the lists of the continents, nothing else', () => {
    expect(servedFile('/b', '/buildings/7962574.bin')).toMatch(/buildings[\\/]7962574\.bin$/)
    expect(servedFile('/b', '/buildings/tex/189077.bin')).toMatch(/buildings[\\/]tex[\\/]189077\.bin$/)
    expect(servedFile('/b', '/buildings/tex/189077.png')).toMatch(/tex[\\/]189077\.png$/)
    expect(servedFile('/b', '/azeroth/buildings.json')).toMatch(/azeroth[\\/]buildings\.json$/)
    expect(servedFile('/b', '/buildings/format.json')).toBeNull()
    expect(servedFile('/b', '/buildings/../x.bin')).toBeNull()
  })
})
