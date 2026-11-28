import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ check: vi.fn(), on: vi.fn(), packaged: { value: true } }))
vi.mock('electron', () => ({ app: { get isPackaged() { return mocks.packaged.value } }, BrowserWindow: vi.fn() }))
vi.mock('electron-updater', () => ({ autoUpdater: { checkForUpdates: mocks.check, on: mocks.on } }))
import { updateFirst } from './update'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  mocks.check.mockReset()
  mocks.on.mockReset()
  mocks.packaged.value = true
})

describe('updateFirst', () => {
  it('opens immediately when an AppImage cannot be replaced', () => {
    vi.stubGlobal('process', { ...process, platform: 'linux', env: { APPIMAGE: '/nonexistent-twinmap-parent/app.AppImage' } })
    const open = vi.fn()
    updateFirst(open, vi.fn())
    expect(open).toHaveBeenCalledOnce()
    expect(mocks.check).not.toHaveBeenCalled()
  })

  it('does not automatically update a writable Linux AppImage', () => {
    vi.stubGlobal('process', { ...process, platform: 'linux', env: { APPIMAGE: '/tmp/app.AppImage' }, argv: [] })
    const open = vi.fn()
    updateFirst(open, vi.fn())
    expect(open).toHaveBeenCalledOnce()
    expect(mocks.check).not.toHaveBeenCalled()
  })

  it('opens after a Windows update check fails', async () => {
    vi.stubGlobal('process', { ...process, platform: 'win32', env: {}, argv: [] })
    mocks.check.mockRejectedValue(new Error('offline'))
    const open = vi.fn()
    updateFirst(open, vi.fn())
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce())
  })
})
