import { expect, test } from 'vitest'
import { DEATH_STALE, deathFrom, deathPlaces } from './death'
import { unitsOfPlace } from './geo'
import type { GameMap } from './maps'

const elwynn: GameMap = { id: 1429, name: 'Elwynn Forest', parent: 1415, level: 'zone', continent: 0, rect: { minX: -10000, minY: -1000, maxX: -8000, maxY: 1000 }, area: 12 }
const doors = [
  { continent: 0 as const, x: 10, y: 20, names: ['The Stockade'], maps: [34] },
  { continent: 1 as const, x: 30, y: 40, names: ["Ruins of Ahn'Qiraj", "Ahn'Qiraj Temple"], maps: [509, 531], raid: true as const },
]

test('a death is read off its section; alive, old or odd is none', () => {
  expect(deathFrom({ dead: true, ghost: true, corpse: { map: 1429, x: 40, y: 60 }, yard: { map: 1429, x: 39.5, y: 62 } })).toEqual({ ghost: true, corpse: { map: 1429, x: 40, y: 60 }, yard: { map: 1429, x: 39.5, y: 62 } })
  expect(deathFrom({ dead: true, inst: 34, corpse: { map: 'x' } })).toEqual({ ghost: false, inst: 34 })
  expect(deathFrom({ dead: false })).toBeNull()
  expect(deathFrom(undefined)).toBeNull()
  expect(deathFrom({ dead: true }, DEATH_STALE + 1)).toBeNull()
})

test('the way back is to the corpse, or to the door of the dungeon it lies in', () => {
  const open = deathPlaces({ ghost: true, corpse: { map: 1429, x: 40, y: 60 }, yard: { map: 1429, x: 39.5, y: 62 } }, [elwynn], doors)
  expect(open.back).toEqual({ continent: 0, at: unitsOfPlace(elwynn.rect!, 40, 60), name: 'Your corpse', door: false })
  expect(open.yard).toEqual({ continent: 0, at: unitsOfPlace(elwynn.rect!, 39.5, 62) })
  expect(deathPlaces({ ghost: true, inst: 531 }, [elwynn], doors).back).toEqual({ continent: 1, at: { x: 30, y: 40 }, name: "Ahn'Qiraj Temple", door: true })
  // A map the app does not have, a dungeon with no door known: nowhere to show.
  expect(deathPlaces({ ghost: true, corpse: { map: 1, x: 1, y: 1 }, inst: 999 }, [elwynn], doors)).toEqual({ back: null, yard: null })
})
