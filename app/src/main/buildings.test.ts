import { describe, expect, it } from 'vitest'
import { servedFile } from './tiles'

describe('the files of the buildings the window may ask for', () => {
  it('serves a building, its textures and the lists of the continents, nothing else', () => {
    expect(servedFile('/b', '/buildings/7962574.bin')).toMatch(/buildings[\\/]7962574\.bin$/)
    expect(servedFile('/b', '/buildings/tex/189077.bin')).toMatch(/buildings[\\/]tex[\\/]189077\.bin$/)
    expect(servedFile('/b', '/buildings/tex/189077.png')).toMatch(/tex[\\/]189077\.png$/)
    expect(servedFile('/b', '/azeroth/buildings.json')).toMatch(/azeroth[\\/]buildings\.json$/)
    expect(servedFile('/b', '/buildings/7962574-out.bin')).toBeNull()
    expect(servedFile('/b', '/buildings/format.json')).toBeNull()
    expect(servedFile('/b', '/buildings/../x.bin')).toBeNull()
  })
})
