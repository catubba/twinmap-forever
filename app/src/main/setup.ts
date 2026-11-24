// What the first run needs to know: where the game is, whether the addon is in it, whether Questie
// is. Here the app only looks: the addon comes from CurseForge. What it writes next to the addon is in signal.ts.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, type SetupStatus } from '../shared/setup'
import { ZOOMS } from '../shared/window'
import { questieFile } from './questie'
import { shortestPathFolder } from './walk'

const ADDONS = ['_forever_', 'Interface', 'AddOns']

/** The folder of a game where addons live. */
export const addonsFolder = (gameFolder: string): string => join(gameFolder, ...ADDONS)

/** The player's choices the app keeps between runs. */
export interface Settings {
  /** The game folder the player picked by hand, when the app did not find it alone. */
  gameFolder?: string
  /** The first run was gone through once: the app opens on the map. */
  setupDone?: boolean
  /** The window stays over the others. */
  onTop?: boolean
  /** The map is shown to the other devices of the home network. */
  lan?: boolean
  /** The code those devices must hold. Made once, so an address saved on a phone keeps working. */
  lanCode?: string
  /** The participation programme (Help improve Twinmap): its data is sent only when true. Missing until the player answers, then kept as said. */
  participate?: boolean
  /** The size of the whole window, one of ZOOMS; missing is 1. */
  zoom?: number
  /** Hardware acceleration turned off. Read as the app starts: a change counts from the next run. */
  noGpu?: boolean
  /** The language the player chose, by the game's code for it (shared/i18n); missing is the game's own. */
  lang?: string
  /** The language was chosen or asked for once (first run, the window after the update, Settings): never asked again. */
  langAsked?: boolean
  /** The version of the app whose news the player last saw (WhatsNew.svelte); missing for one who had Twinmap before that window. */
  seenVersion?: string
}

/** The settings as they were saved; nothing where the file is missing or is not ours. */
export function readSettings(file: string): Settings {
  try {
    const read: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof read !== 'object' || !read) return {}
    const { gameFolder, setupDone, onTop, lan, lanCode, participate, zoom, noGpu, lang, langAsked, seenVersion } = read as Record<string, unknown>
    return {
      ...(typeof gameFolder === 'string' ? { gameFolder } : {}),
      ...(setupDone === true ? { setupDone } : {}),
      ...(onTop === true ? { onTop } : {}),
      ...(lan === true ? { lan } : {}),
      ...(noGpu === true ? { noGpu } : {}),
      ...(langAsked === true ? { langAsked } : {}),
      ...(typeof participate === 'boolean' ? { participate } : {}),
      ...(ZOOMS.some((z) => z === zoom) ? { zoom: zoom as number } : {}),
      ...(typeof lanCode === 'string' && /^[\w-]{8,64}$/.test(lanCode) ? { lanCode } : {}),
      ...(typeof lang === 'string' && /^([a-z]{2}[A-Z]{2}|pseudo(-[a-z]{2})?)$/.test(lang) ? { lang } : {}),
      ...(typeof seenVersion === 'string' && /^\d+\.\d+\.\d+$/.test(seenVersion) ? { seenVersion } : {}),
    }
  } catch {
    return {}
  }
}

/**
 * Whether to ask once for the language, as the app starts: only for a player who had Twinmap before it spoke other
 * languages (the first run went through, no language chosen, never asked), and whose game is in one it speaks now,
 * other than English. A new player chooses it in the first run.
 */
export const askLangOf = (settings: Settings, gameLang: string | null, offered: (code: string) => boolean): boolean =>
  settings.setupDone === true && !settings.langAsked && settings.lang === undefined && !!gameLang && gameLang !== 'enUS' && gameLang !== 'enGB' && offered(gameLang)

/**
 * What's new, as the app starts (WhatsNew.svelte): the version the player last saw its news at, when this one is newer; '' for a
 * player who had Twinmap before that window (only this version's news, then); null when there is nothing to show, as after a first
 * run, which marks its version seen.
 */
export const newsSinceOf = (settings: Settings, version: string): string | null => {
  if (settings.setupDone !== true) return null
  if (settings.seenVersion === undefined) return ''
  return after(version, settings.seenVersion) ? settings.seenVersion : null
}

export function writeSettings(file: string, settings: Settings): void {
  try {
    writeFileSync(file, JSON.stringify(settings, null, 1))
  } catch {
    // the choice lasts this run only
  }
}

/** Whether the addon in a game folder takes its news from the fonts alone ("X-Channel: 2" in its .toc); one from before it wants the slots too. */
export function addonHearsFonts(gameFolder: string): boolean {
  try {
    return /^##\s*X-Channel:\s*2\s*$/m.test(readFileSync(join(gameFolder, ...ADDONS, 'TwinmapForever', 'TwinmapForever.toc'), 'utf8'))
  } catch {
    return false
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

export function setupStatus(gameFolder: string | null, settings: Settings, version: string): SetupStatus {
  return {
    gameFolder,
    addon: gameFolder ? addonVersion(gameFolder) : null,
    questie: gameFolder ? existsSync(questieFile(gameFolder)) : false, // its data, which is what the app reads
    shortestPath: gameFolder ? existsSync(shortestPathFolder(gameFolder)) : false,
    done: settings.setupDone === true,
    version,
    onTop: settings.onTop === true,
    participate: settings.participate ?? null,
  }
}
