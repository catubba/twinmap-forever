import { describe, expect, it } from 'vitest'
import { workspacesOf } from './workspaces'

const layout = { grid: {}, panels: {} }

describe('workspacesOf', () => {
  it('takes what this version kept', () => {
    const kept = { version: 1, open: 2, spaces: [{ id: 'map', layout }, { id: 'character', layout }, { id: 'ah', layout }] }
    expect(workspacesOf(kept)).toEqual(kept)
  })
  it('opens the first when the one open is not there', () => {
    expect(workspacesOf({ version: 1, open: 5, spaces: [{ id: 'map', layout }] })?.open).toBe(0)
    expect(workspacesOf({ version: 1, open: 'ah', spaces: [{ id: 'map', layout }] })?.open).toBe(0)
  })
  it('leaves out what is not a layout of this version', () => {
    for (const kept of [
      null,
      'map',
      { version: 2, open: 0, spaces: [{ id: 'map', layout }] },
      { version: 1, open: 0, spaces: [] },
      { version: 1, open: 0, spaces: [{ id: 'map' }] },
      { version: 1, open: 0, spaces: [{ id: 'a b', layout }] },
      { version: 1, open: 0, spaces: [{ id: 'map', layout }, { id: 'map', layout }] },
      { version: 1, open: 0, spaces: Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, layout })) },
    ])
      expect(workspacesOf(kept)).toBeUndefined()
  })
  it('keeps nothing more than the id and the layout', () => {
    expect(workspacesOf({ version: 1, open: 0, spaces: [{ id: 'map', layout, more: 1 }], also: 2 })).toEqual({ version: 1, open: 0, spaces: [{ id: 'map', layout }] })
  })
})
