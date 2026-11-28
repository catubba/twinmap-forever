import { describe, expect, it } from 'vitest'
import { floorsAt, floorsOf, pinOn, standsOn, walkedOn } from './floors'
import { solidAt, type Piece } from './inside'

// A hall 20 yards a side with its floor at 0, a bridge over its middle at 10 (x 8 to 12), a ceiling at 30 and a pool:
// two triangles a square, their normals up, the ceiling's down.
const square = (x0: number, x1: number, y: number): number[] => [x0, y, 0, x1, y, 0, x1, y, 20, x0, y, 20]
const position = [...square(0, 20, 0), ...square(8, 12, 10), ...square(0, 20, 30), ...square(0, 20, 1)]
const normal = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]
const index = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15]
const draws = [{ start: 0, count: 12 }, { start: 12, count: 6, ceiling: true }, { start: 18, count: 6, liquid: 1 }]
const piece = (bottom: number, top: number, level: number): Piece => ({ file: level, u: 110, v: 110, width: 20, height: 20, angle: 0, bottom, top, building: 0, room: level, level })

describe('the floors of a dungeon', () => {
  const walked = walkedOn(position, normal, index, draws)
  // the building stands at 100, 5, 100 of the map, not turned
  const floors = floorsOf(walked, 100, 5, 100, 0, 1)
  const hall = piece(5, 35, 0), all = (): boolean => true

  it('are the triangles that look up, not the ceilings nor the liquids', () => {
    expect(walked.length / 9).toBe(4)
  })

  it('lie under a place, the highest first', () => {
    expect(floorsAt(floors, 102, 110)).toEqual([5])
    expect(floorsAt(floors, 110, 110)).toEqual([15, 5])
    expect(floorsAt(floors, 130, 110)).toEqual([])
  })

  it('turn and grow with the building', () => {
    // a quarter turn round y takes x to -z; twice the size
    const turned = floorsOf(walked, 100, 5, 100, Math.PI / 2, 2)
    expect(floorsAt(turned, 110, 100 - 20)).toEqual([25, 5])
    expect(floorsAt(turned, 110, 100 - 4)).toEqual([5])
  })

  it('begin on the lowest floor of the room the 2D map shows, and go on along the nearest to before', () => {
    expect(standsOn(floors, [hall], 110, 110, undefined, null, all)).toBe(5)
    expect(standsOn(floors, [hall], 110, 110, undefined, 14, all)).toBe(15)
    expect(standsOn(floors, [hall], 110, 110, undefined, 6, all)).toBe(5)
    // off the bridge the only floor is the hall's, whatever was before
    expect(standsOn(floors, [hall], 104, 110, undefined, 15, all)).toBe(5)
  })

  it('take the room drawn last among those of the level, where its picture is solid', () => {
    const gallery = piece(14, 20, 1)
    expect(standsOn(floors, [hall, gallery], 110, 110, 1, null, all)).toBe(15)
    expect(standsOn(floors, [hall, gallery], 110, 110, 0, null, all)).toBe(5)
    expect(standsOn(floors, [hall, gallery], 110, 110, 1, null, (p) => p === hall)).toBe(5)
    expect(standsOn(floors, [hall, gallery], 110, 110, 1, null, () => undefined)).toBeUndefined()
  })

  it('put a pin on the floor nearest to the height it is told, or at that height with no floor near it', () => {
    expect(pinOn(floors, [hall], 110, 110, 16, all)).toBe(15)
    expect(pinOn(floors, [hall], 110, 110, 4, all)).toBe(5)
    // a boss that swims 9 yards over the floor, one on a ledge the building does not have
    expect(pinOn(floors, [hall], 104, 110, 14, all)).toBe(14)
    expect(pinOn(floors, [hall], 130, 110, 14, all)).toBe(14)
    // no height told: the lowest floor of the room the 2D map shows there, as the character coming there first
    expect(pinOn(floors, [hall], 110, 110, undefined, all)).toBe(5)
    expect(pinOn(floors, [hall], 130, 110, undefined, all)).toBeNull()
    expect(pinOn(floors, [hall], 110, 110, undefined, () => undefined)).toBeUndefined()
  })

  it('look a few yards round a place with no floor under it', () => {
    expect(standsOn(floors, [hall], 123, 110, undefined, null, all)).toBe(5)
    expect(standsOn(floors, [hall], 130, 110, undefined, null, all)).toBeNull()
    expect(standsOn(floors, [hall], 130, 110, undefined, 5, all)).toBeNull()
  })

  it('count the ground of a dungeon that has one, and the floors of its other buildings', () => {
    const onGround = { ...floors, ground: (): number => 40 }
    expect(floorsAt({ ...onGround, also: (): number[] => [50] }, 110, 110)).toEqual([50, 40, 15, 5])
    expect(floorsAt(onGround, 110, 110, false, true)).toEqual([15, 5])
    // the ground a few yards under a floor of a building is covered by it, the paving of a courtyard: not walked
    expect(floorsAt({ ...floors, ground: (): number => 2 }, 110, 110)).toEqual([15, 5])
    expect(floorsAt({ ...floors, ground: (): number => -10 }, 110, 110)).toEqual([15, 5, -10])
    // under the sky nothing that lies under the ground: rooms far under it are not where the character is
    expect(floorsAt(onGround, 110, 110, true)).toEqual([40])
    expect(standsOn(onGround, [hall], 110, 110, undefined, null, all, true)).toBe(40)
    expect(standsOn(onGround, [hall], 110, 110, undefined, 14, all, true)).toBe(40)
    // under a roof: the room's floor, whatever the ground over it, and then the nearest to before
    expect(standsOn(onGround, [hall], 110, 110, undefined, null, all)).toBe(5)
    expect(standsOn(onGround, [hall], 110, 110, undefined, 14, all)).toBe(15)
    // a ground that crosses the room's box is not its floor: a floor of the building is
    expect(standsOn({ ...floors, ground: (): number => 9 }, [hall], 110, 110, undefined, null, all, true)).toBe(15)
    // in no room, the lowest of what is there
    expect(standsOn(onGround, [], 110, 110, undefined, null, all, true)).toBe(40)
    expect(standsOn(onGround, [], 110, 110, undefined, null, all)).toBe(5)
  })
})

describe('a room picture', () => {
  it('is solid where its block is not see-through', () => {
    // 8 x 8 pixels, four blocks: the first all see-through (first colour not the greater, every choice the fourth), the others solid
    const p: Piece = { ...piece(0, 10, 0), u: 2, v: 2, width: 4, height: 4 }
    const dxt = new Uint8Array(32)
    dxt.set([0, 0, 0, 0, 255, 255, 255, 255], 0)
    for (const block of [8, 16, 24]) dxt.set([1, 0, 0, 0, 255, 255, 255, 255], block)
    expect(solidAt(p, dxt, 1, 1)).toBe(false)
    expect(solidAt(p, dxt, 3, 1)).toBe(true)
    expect(solidAt(p, dxt, 1, 3)).toBe(true)
    expect(solidAt(p, dxt, 9, 9)).toBe(false)
  })
})
