import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

test('the Linux AppImage uses the static runtime toolset', () => {
  const { build } = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
  expect(build.toolsets?.appimage).toBe('1.0.3')
})
