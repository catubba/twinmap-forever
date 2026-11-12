import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { thirdParties } from './licences'

test('the entries of a licence file come back with name, what it is for, and the full text', () => {
  const bar = '='.repeat(80)
  const text = `Preamble.\r\n\r\n${bar}\r\nkoffi\r\nhttps://koffi.dev\r\nUsed in: the app\r\n${bar}\r\n\r\nMIT License\r\n\r\nPermission is granted.\r\n\r\n${bar}\r\nLeaflet\r\n${bar}\r\n\r\nBSD 2-Clause License\r\n`
  expect(thirdParties(text)).toEqual([
    { name: 'koffi', about: 'https://koffi.dev Used in: the app', licence: 'MIT License\n\nPermission is granted.' },
    { name: 'Leaflet', about: '', licence: 'BSD 2-Clause License' },
  ])
  expect(thirdParties('no entries here')).toEqual([])
})

test('the file the app ships names everything it is built with, each with its licence', () => {
  const entries = thirdParties(readFileSync(join(__dirname, '..', '..', '..', 'THIRD-PARTY-LICENSES'), 'utf8'))
  expect(entries.map((e) => e.name)).toEqual(['koffi', 'qrcode-generator', 'wow-ai', 'Leaflet', 'One for All', 'Shortest Path Forever', 'MapUtils', 'Forever Simple World Map', 'Marcellus', 'Barlow Semi Condensed'])
  for (const e of entries) expect(e.licence.length, e.name).toBeGreaterThan(100)
})
