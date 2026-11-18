import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { gameFolderFrom, openClientFiles, registryInstallPath, type ClientFiles } from './client-files'
import { gamePictures, itemIconFile, itemIconLooked, itemIcons } from './item-icons'
import { servedFile } from './tiles'

const real = gameFolderFrom([registryInstallPath()])
const PNG = '89504e47'

test('an item picture, or a spell picture by its file, is served from the folder of the build, and nothing else is', () => {
  expect(servedFile('/b', '/items/159.png')).toBe(join('/b', 'items', '159.png'))
  expect(servedFile('/b', '/items/../x.png')).toBeNull()
  expect(servedFile('/b', '/items/12345678.png')).toBeNull()
  expect(servedFile('/b', '/pictures/136197.png')).toBe(join('/b', 'pictures', '136197.png'))
  expect(servedFile('/b', '/pictures/x.png')).toBeNull()
})

// Water, linen cloth, the hearthstone, an item of Forever's own, and boots with their picture only on their look (ItemAppearance).
test.skipIf(!real)('the real game gives the pictures of items once; then they come from the folder, without the game', () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-items-'))
  // The boots were marked missing by an app that did not look at the appearances: they are looked for again.
  mkdirSync(join(folder, 'items'), { recursive: true })
  writeFileSync(join(folder, 'items', '277218.none'), '')
  let opened = 0
  let files: ClientFiles | undefined
  const make = itemIcons(() => (opened++, (files ??= openClientFiles(real!))), folder)
  for (const item of [159, 2589, 6948, 255716, 277218]) {
    expect(make(item), `item ${item}`).toBe(true)
    expect(readFileSync(itemIconFile(folder, item)).subarray(0, 4).toString('hex')).toBe(PNG)
  }
  expect(make(1)).toBe(false) // no such item
  expect(itemIconLooked(folder, 1)).toBe(true)

  // Another run of the app: what was made and what is missing are known without opening the game.
  const again = itemIcons(() => {
    throw new Error('the game was opened again')
  }, folder)
  for (const item of [159, 2589, 6948, 255716, 277218]) expect(again(item)).toBe(true)
  expect(again(1)).toBe(false)
  expect(opened).toBeGreaterThan(0)
})

// Shadow Bolt's picture is made once; a file that is no picture (the table SpellEffect) is marked and not read again.
test.skipIf(!real)('the real game gives the picture of a spell by its file', () => {
  const folder = mkdtempSync(join(tmpdir(), 'twinmap-pictures-'))
  const make = gamePictures(() => openClientFiles(real!), folder)
  expect(make(136197)).toBe(true)
  expect(readFileSync(join(folder, 'pictures', '136197.png')).subarray(0, 4).toString('hex')).toBe(PNG)
  expect(make(1140088)).toBe(false)
  const again = gamePictures(() => {
    throw new Error('the game was opened again')
  }, folder)
  expect([again(136197), again(1140088)]).toEqual([true, false])
}, 60_000)
