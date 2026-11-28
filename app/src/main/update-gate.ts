import { accessSync, constants } from 'node:fs'
import { dirname } from 'node:path'

export function selfUpdates(platform: NodeJS.Platform, _env: Record<string, string | undefined>): boolean {
  return platform === 'win32'
}

export function justUpdated(argv: string[], env: Record<string, string | undefined>): boolean {
  return argv.includes('--updated') || env.APPIMAGE_SILENT_INSTALL === 'true'
}

export function canReplace(env: Record<string, string | undefined>): boolean {
  if (!env.APPIMAGE) return true
  try {
    accessSync(dirname(env.APPIMAGE), constants.W_OK)
    return true
  } catch {
    return false
  }
}
