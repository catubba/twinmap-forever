// What the first run needs to know: where the game is, whether the addon is in it, whether Questie
// is. The app only looks: the addon comes from CurseForge, and nothing here writes into the game's folder.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SetupStatus } from '../shared/setup'

const ADDONS = ['_forever_', 'Interface', 'AddOns']

/** The player's choices the app keeps between runs. */
export interface Settings {
  /** The game folder the player picked by hand, when the app did not find it alone. */
  gameFolder?: string
  /** The first run was gone through once: the app opens on the map. */
  setupDone?: boolean
}

/** The settings as they were saved; nothing where the file is missing or is not ours. */
export function readSettings(file: string): Settings {
  try {
    const read: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof read !== 'object' || !read) return {}
    const { gameFolder, setupDone } = read as Record<string, unknown>
    return { ...(typeof gameFolder === 'string' ? { gameFolder } : {}), ...(setupDone === true ? { setupDone } : {}) }
  } catch {
    return {}
  }
}

export function writeSettings(file: string, settings: Settings): void {
  try {
    writeFileSync(file, JSON.stringify(settings, null, 1))
  } catch {
    // the choice lasts this run only
  }
}

/** The version of the Twinmap Forever addon in a game folder, as its .toc says; null when it is not there. */
export function addonVersion(gameFolder: string): string | null {
  try {
    const toc = readFileSync(join(gameFolder, ...ADDONS, 'TwinmapForever', 'TwinmapForever.toc'), 'utf8')
    return /^##\s*Version:\s*(.+)$/m.exec(toc)?.[1]?.trim() ?? 'unknown'
  } catch {
    return null
  }
}

export function setupStatus(gameFolder: string | null, done: boolean): SetupStatus {
  return {
    gameFolder,
    addon: gameFolder ? addonVersion(gameFolder) : null,
    questie: gameFolder ? existsSync(join(gameFolder, ...ADDONS, 'Questie')) : false,
    done,
  }
}
