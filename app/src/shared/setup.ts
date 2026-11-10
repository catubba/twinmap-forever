// The first run: its pages, one thing each, and what each says.
import type { LinkStatus } from './link'
import type { TilesStatus } from './tiles-status'

/** What the main process tells the window about the game folder and the addons in it. */
export interface SetupStatus {
  /** The folder of World of Warcraft: Forever, or null while none is found. */
  gameFolder: string | null
  /** The version of the Twinmap Forever addon found in it, or null. */
  addon: string | null
  questie: boolean
  /** The first run was gone through once, in this run or an earlier one. */
  done: boolean
  /** The version of this app. */
  version: string
  /** The player asked for the window to stay over the others. */
  onTop: boolean
}

/** Where the addon is published. The app never installs it itself: every install is one CurseForge counts. */
export const CURSEFORGE = 'https://www.curseforge.com/wow/addons/twinmap-forever'

export type PageState = 'done' | 'todo' | 'working' | 'problem'
export interface Page {
  id: 'game' | 'map' | 'addon' | 'extras' | 'play'
  title: string
  /** Why this page is there, in a sentence or two. */
  intro: string
  state: PageState
  /** What is true now, and what to do when something is to be done. The first line is the one that matters. */
  lines: string[]
  /** Percent done, while the app is working on it. */
  progress?: number
  action?: 'choose-folder' | 'curseforge'
  /** Said on the page whatever its state: it must be read before the thing it warns of is on. */
  warning?: string
}

/** The addon's strip flickers. Said where the addon is taken and where the game is started. */
export const PHOTOSENSITIVITY =
  'Photosensitivity warning: the addon sends data by changing the colors of a one pixel line at the edge of the game window, many times per second. Its settings in the game can slow it down or pause it.'

const count = (n: number): string => n.toLocaleString('en-US')

/** The five pages of the first run, in order. */
export function setupPages(setup: SetupStatus, tiles: TilesStatus | null, link: LinkStatus | null): Page[] {
  const game: Page = {
    id: 'game',
    title: 'Find the game',
    intro: 'Twinmap needs to know where World of Warcraft: Forever is installed. It only reads from that folder; it never changes anything in it.',
    action: 'choose-folder',
    ...(setup.gameFolder
      ? { state: 'done', lines: ['Found.', setup.gameFolder] }
      : { state: 'todo', lines: ['The game was not found on this PC.', 'Choose the folder it is installed in: the one that holds _forever_.'] }),
  }

  const map: Page = {
    id: 'map',
    title: 'Build the map',
    intro: "Twinmap draws its map from your own game's files, so it always matches your version of the game. This is done once, and again only after the game updates. Nothing is downloaded.",
    ...(!setup.gameFolder || !tiles || tiles.state === 'no-game'
      ? { state: 'todo', lines: ['Waiting for the game folder.'] }
      : tiles.state === 'looking'
        ? { state: 'working', lines: ["Opening the game's files."], progress: 0 }
        : tiles.state === 'converting'
          ? { state: 'working', lines: ["Reading the game's own pictures of the world."], progress: tiles.percent }
          : tiles.state === 'failed'
            ? { state: 'problem', lines: ['The map could not be built.', tiles.message] }
            : { state: 'done', lines: ['The map is ready.', `${count(tiles.tiles)} tiles from game version ${tiles.version}.`] }),
  }

  const addon: Page = {
    id: 'addon',
    title: 'Get the addon',
    intro: 'The Twinmap Forever addon tells this app where your character is. It installs like any other addon, from CurseForge.',
    warning: PHOTOSENSITIVITY,
    ...(setup.addon
      ? { state: 'done', lines: ['Installed.', `Twinmap Forever ${setup.addon} is in the game's AddOns folder.`] }
      : {
          state: 'todo',
          lines: [
            'Not installed yet.',
            'Install it with the CurseForge app. Without that app, download the file from the same page and unpack it into _forever_\\Interface\\AddOns.',
            'This page notices by itself when the addon is there.',
          ],
          action: 'curseforge',
        }),
  }

  const extras: Page = {
    id: 'extras',
    title: 'Optional addons',
    intro: 'None of these is needed. When one is installed, Twinmap shows more.',
    state: 'done',
    lines: [setup.questie ? 'Questie: installed. The map will show the quests it shows.' : 'Questie: not installed. With it, the map shows the same quests Questie shows in the game.'],
  }

  const live = link?.kind === 'connected' || link?.kind === 'combat'
  const play: Page = {
    id: 'play',
    title: 'Start the game',
    intro: 'Start World of Warcraft: Forever and log in with a character. Your position appears here on its own.',
    warning: PHOTOSENSITIVITY,
    ...(live
      ? { state: 'done', lines: ['Connected. Your position is coming through.'] }
      : link?.kind === 'update-app' || link?.kind === 'update-addon'
        ? { state: 'problem', lines: [link.line ?? link.word] }
        : {
            state: 'todo',
            lines: [
              link?.kind === 'lost' || link?.kind === 'waiting'
                ? 'The game is open, but nothing comes from the addon yet.'
                : link?.kind === 'minimized'
                  ? 'The game is minimized. Bring its window back on screen.'
                  : 'Waiting for the game.',
              'At the character list, open AddOns and make sure Twinmap Forever is ticked.',
            ],
          }),
  }
  return [game, map, addon, extras, play]
}

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
  return seconds < 60 ? `about ${Math.ceil(seconds / 5) * 5} seconds left` : `about ${Math.round(seconds / 60)} min left`
}
