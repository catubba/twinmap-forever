import { expect, test } from 'vitest'
import { modelFrom, pictureDue, portraitsFrom, wornKey } from './portrait'

const box = { key: 'Catubbio Sucameli', x: 120, y: 360, w: 277, h: 384 }

test('the model is taken as told, and a closed window or a broken section is no model', () => {
  expect(modelFrom(box)).toEqual(box)
  expect(modelFrom([])).toBeNull() // the window is closed
  expect(modelFrom(undefined)).toBeNull()
  expect(modelFrom({ ...box, w: 0 })).toBeNull()
  expect(modelFrom({ ...box, x: -3 })).toBeNull()
  expect(modelFrom({ ...box, h: 1e6 })).toBeNull()
  expect(modelFrom({ ...box, key: '' })).toBeNull()
})

test('what is worn tells items, enchants and suffixes apart, and not how worn out they are', () => {
  const gear = [[1, 4245, 30, 35], [16, 1155, 100, 100, 'item:1155:803']]
  expect(wornKey(gear)).toBe('16=item:1155:803 1=4245')
  expect(wornKey([[1, 4245, 2, 35], [16, 1155, 0, 100, 'item:1155:803']])).toBe(wornKey(gear))
  expect(wornKey([[1, 4246, 30, 35], gear[1]])).not.toBe(wornKey(gear))
  expect(wornKey([gear[0], [16, 1155, 100, 100]])).not.toBe(wornKey(gear))
  expect(wornKey([gear[0]])).not.toBe(wornKey(gear))
  expect(wornKey(undefined)).toBe('')
})

test('a picture is taken at the first sight of the model, not again in the same things, again in others, and when asked', () => {
  const worn = '1=4245', have = { at: 1, gear: worn }
  expect(pictureDue(box, 2000, worn, undefined, null)).toBe(true)
  expect(pictureDue(box, 2000, worn, have, null)).toBe(false)
  expect(pictureDue(box, 2000, '1=4246', have, null)).toBe(true)
  expect(pictureDue(box, 2000, worn, have, box.key)).toBe(true)
  expect(pictureDue(box, 2000, worn, have, 'Brunilde Ferrozampa')).toBe(false) // asked for someone else
  expect(pictureDue(box, 300, worn, undefined, null)).toBe(false) // not still yet
  expect(pictureDue(null, 2000, worn, undefined, box.key)).toBe(false) // the window is closed
  expect(pictureDue(box, 2000, undefined, undefined, null)).toBe(false) // no sheet of the character yet
})

test('the pictures kept are read back, and what is not one is left out', () => {
  expect(portraitsFrom({ A: { at: 5, gear: 'x' }, B: { at: 'no' }, C: 3 })).toEqual({ A: { at: 5, gear: 'x' } })
  expect(portraitsFrom(null)).toEqual({})
})
