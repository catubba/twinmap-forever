import { execFileSync } from 'node:child_process'
import { expect, test } from 'vitest'

test.skipIf(process.platform !== 'linux')('the pixel conversion of the helper passes its test', () => {
  expect(execFileSync('node', ['scripts/linux-build.cjs', 'test'], { encoding: 'utf8' })).toContain('ok')
})
