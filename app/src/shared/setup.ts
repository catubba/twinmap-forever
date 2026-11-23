// The first run: its pages, one thing each, and what each says.
import type { LinkStatus } from './link'
import { tilesHelp, type TilesStatus } from './tiles-status'
import { num, t } from './i18n'

/** What the main process tells the window about the game folder and the addons in it. */
export interface SetupStatus {
  /** The desktop app is on macOS. */
  mac?: true
  /** Present only on macOS while Screen Recording permission is missing. */
  screenRecording?: false
  /** The folder of World of Warcraft: Forever, or null while none is found. */
  gameFolder: string | null
  /** The version of the Twinmap Forever addon found in it, or null. */
  addon: string | null
  /** QuestieDB is among the addons: the data the app reads, with or without Questie itself. */
  questie: boolean
  /** Shortest Path Forever is among the addons. */
  shortestPath: boolean
  /** The first run was gone through once, in this run or an earlier one. */
  done: boolean
  /** The version of this app. */
  version: string
  /** The player asked for the window to stay over the others. */
  onTop: boolean
  /** The player's answer to Help improve Twinmap (the participation programme): null while never asked. */
  participate: boolean | null
  /** The size of the whole app window the player picked, 1 being as made. A phone's browser has its own. */
  zoom?: number
  /** Hardware acceleration: as the player chose it, and as this run of the app has it (the choice counts from the next start). */
  gpu?: { chosen: boolean; running: boolean }
  /** The map on the home network: the address a phone opens, or why it cannot be had. Absent or null while it is off. */
  lan?: { url: string } | { error: string } | null
  /** The language the app speaks (shared/i18n): a page that speaks another loads again in this one. */
  lang?: string
  /** Every language planned, in its own words, and whether it can be had yet (shared/i18n, planned). */
  langs?: { code: string; name: string; soon: string; ready: boolean }[]
  /** The language the game is in (textLocale), or null when it is not known. */
  gameLang?: string | null
  /** The window that asks for the language once after the update is due (askLangOf, main/setup.ts). */
  askLang?: boolean
}

/** Where the addon is published. The app never installs it itself: every install is one CurseForge counts. */
export const CURSEFORGE = 'https://www.curseforge.com/wow/addons/twinmap-forever'

/** The optional addons the app points to, each with its name and its page on CurseForge. */
export const OPTIONAL = {
  questie: { name: 'QuestieDB', page: 'https://www.curseforge.com/wow/addons/questiedb' },
  shortestPath: { name: 'Shortest Path', page: 'https://www.curseforge.com/wow/addons/shortest-path-forever' },
} as const
export type Optional = keyof typeof OPTIONAL

/** The page on CurseForge the window may open: the one of an optional addon it names, else the one of Twinmap Forever. */
export const pageOf = (asked: unknown): string => (typeof asked === 'string' && Object.hasOwn(OPTIONAL, asked) ? OPTIONAL[asked as Optional].page : CURSEFORGE)

export type PageState = 'done' | 'todo' | 'working' | 'problem'
export interface Page {
  id: 'language' | 'game' | 'map' | 'addon' | 'extras' | 'play'
  /** Its name in the row of steps, and its title unless it has a heading. */
  title: string
  heading?: string
  /** Why this page is there, in a sentence or two. */
  intro: string
  state: PageState
  /** What is true now, and what to do when something is to be done. The first line is the one that matters. */
  lines: string[]
  /** Percent done, while the app is working on it. */
  progress?: number
  action?: 'choose-folder' | 'curseforge' | 'retry' | 'language'
  /** The optional addons that are not installed: each gets a button to its page on CurseForge. */
  get?: Optional[]
  /** Said on the page whatever its state: it must be read before the thing it warns of is on. */
  warning?: string
}

/** The five pages of the first run, in order. The addon's strip flickers: its warning is said where the addon is taken and where the game is started. */
export function setupPages(setup: SetupStatus, tiles: TilesStatus | null, link: LinkStatus | null): Page[] {
  const game: Page = {
    id: 'game',
    title: t('app.firstRun.game.title'),
    intro: t('app.firstRun.game.intro'),
    action: 'choose-folder',
    ...(setup.gameFolder
      ? { state: 'done', lines: [t('app.firstRun.game.found'), setup.gameFolder] }
      : { state: 'todo', lines: [t('app.firstRun.game.notFound'), t('app.firstRun.game.choose')] }),
  }

  const map: Page = {
    id: 'map',
    title: t('app.firstRun.map.title'),
    intro: t('app.firstRun.map.intro'),
    ...(!setup.gameFolder || !tiles || tiles.state === 'no-game'
      ? { state: 'todo', lines: [t('app.firstRun.map.waiting')] }
      : tiles.state === 'looking'
        ? { state: 'working', lines: [t('app.firstRun.map.opening')], progress: 0 }
        : tiles.state === 'converting'
          ? { state: 'working', lines: [t('app.firstRun.map.reading'), t('app.tiles.builtOnce')], progress: tiles.percent }
          : tiles.state === 'failed'
            ? { state: 'problem', lines: [t('app.firstRun.map.failed'), tiles.message, tilesHelp(tiles)!], action: 'retry' }
            : { state: 'done', lines: [t('app.firstRun.map.ready'), t('app.firstRun.map.tiles', { count: num(tiles.tiles), version: tiles.version })] }),
  }

  const addon: Page = {
    id: 'addon',
    title: t('app.firstRun.addon.title'),
    intro: t('app.firstRun.addon.intro'),
    warning: t('app.firstRun.photosensitivity'),
    ...(setup.addon
      ? { state: 'done', lines: [t('app.firstRun.addon.installed'), t('app.firstRun.addon.inFolder', { version: setup.addon })] }
      : {
          state: 'todo',
          lines: [t('app.firstRun.addon.notYet'), t(setup.mac ? 'app.firstRun.addon.howToMac' : 'app.firstRun.addon.howTo'), t('app.firstRun.addon.notices')],
          action: 'curseforge',
        }),
  }

  const extras: Page = {
    id: 'extras',
    title: t('app.firstRun.extras.title'),
    intro: t('app.firstRun.extras.intro'),
    state: 'done',
    lines: [
      setup.questie ? t('app.firstRun.extras.questie') : t('app.firstRun.extras.noQuestie'),
      setup.shortestPath ? t('app.firstRun.extras.shortestPath') : t('app.firstRun.extras.noShortestPath'),
    ],
    get: (['questie', 'shortestPath'] as const).filter((addon) => !setup[addon]),
  }

  const live = link?.kind === 'connected' || link?.kind === 'combat'
  const play: Page = {
    id: 'play',
    title: t('app.firstRun.play.title'),
    intro: t('app.firstRun.play.intro'),
    warning: t('app.firstRun.photosensitivity'),
    ...(live
      ? { state: 'done', lines: [t('app.firstRun.play.connected')] }
      : setup.screenRecording === false
        ? { state: 'problem', lines: [t('app.link.screenRecording'), t('app.firstRun.play.tick')] }
        : link?.kind === 'update-app' || link?.kind === 'update-addon'
          ? { state: 'problem', lines: [link.line ?? link.word] }
          : {
              state: 'todo',
              lines: [
                link?.kind === 'lost' || link?.kind === 'waiting'
                  ? t('app.firstRun.play.silent')
                  : link?.kind === 'minimized'
                    ? t('app.firstRun.play.minimized')
                    : t('app.firstRun.play.waiting'),
                t('app.firstRun.play.tick'),
              ],
            }),
  }
  return [game, map, addon, extras, play]
}

/** The first page of the first run, before the five: the language, already on the game's when the app speaks it. */
export const languagePage = (): Page => ({ id: 'language', title: t('language.step'), heading: t('language.title'), intro: t('language.intro'), state: 'done', lines: [], action: 'language' })

/** Game found, map built, addon installed, position coming: nothing is left to do. */
export const setupComplete = (pages: Page[]): boolean => pages.every((p) => p.state === 'done')

/**
 * How long the map still takes, in words, from when the work was first seen and how far it was
 * then. Nothing in the first seconds, or while nothing has moved: a guess from too little jumps about.
 */
export function timeLeft(startedAt: number, startedPercent: number, now: number, percent: number): string {
  const elapsed = (now - startedAt) / 1000, gained = percent - startedPercent
  if (elapsed < 3 || gained <= 0 || percent >= 100) return ''
  const seconds = Math.max(1, Math.round(((100 - percent) / gained) * elapsed))
  return seconds < 60 ? t('app.firstRun.secondsLeft', { count: Math.ceil(seconds / 5) * 5 }) : t('app.firstRun.minutesLeft', { count: Math.round(seconds / 60) })
}
