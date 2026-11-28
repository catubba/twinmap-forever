import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { servedFile } from './tiles'

test("a continent's zones are served from its folder, and nothing beside them", () => {
  const base = join(tmpdir(), 'build')
  expect(servedFile(base, '/azeroth/zones.bin')).toBe(join(base, 'azeroth', 'zones.bin'))
  for (const path of ['/../zones.bin', '/i33/zones.bin', '/azeroth/zones.json']) expect(servedFile(base, path), path).toBeNull()
})
