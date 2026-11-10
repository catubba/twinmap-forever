// What the main process tells the window about the first run.
import type { LinkStatus } from './link'

export interface SetupStatus {
  /** The folder of World of Warcraft: Forever, or null while none is found. */
  gameFolder: string | null
  /** The version of the Twinmap Forever addon found in it, or null. */
  addon: string | null
  questie: boolean
  /** The three steps were all done once, in this run or an earlier one. */
  done: boolean
}

/** Where the addon is published. The app never installs it itself: every install is one CurseForge counts. */
export const CURSEFORGE = 'https://www.curseforge.com/wow/addons/twinmap-forever'

export type StepState = 'done' | 'todo' | 'waiting' | 'problem'
export interface Step {
  title: string
  state: StepState
  /** What is true now, and what to do when something is to be done. */
  lines: string[]
  action?: 'choose-folder' | 'curseforge'
}

/** The four steps of the first run, each with what the player reads under it. */
export function setupSteps(setup: SetupStatus, link: LinkStatus | null): Step[] {
  const game: Step = setup.gameFolder
    ? { title: 'Find the game', state: 'done', lines: [setup.gameFolder], action: 'choose-folder' }
    : { title: 'Find the game', state: 'todo', lines: ['World of Warcraft: Forever was not found on this PC. Choose the folder it is installed in.'], action: 'choose-folder' }

  const addon: Step = setup.addon
    ? { title: 'Get the addon', state: 'done', lines: [`Twinmap Forever ${setup.addon} is in the game's AddOns folder.`] }
    : {
        title: 'Get the addon',
        state: setup.gameFolder ? 'todo' : 'waiting',
        lines: [
          'The Twinmap Forever addon tells this app where your character is. Install it with the CurseForge app.',
          'Without the CurseForge app: download the file from the same page and unpack it into _forever_\\Interface\\AddOns.',
          'This step ticks itself when the addon is there.',
        ],
        action: 'curseforge',
      }

  const live = link?.kind === 'connected' || link?.kind === 'combat'
  const play: Step = live
    ? { title: 'Start the game and log in', state: 'done', lines: ['Connected: your position is coming through.'] }
    : link?.kind === 'update-app' || link?.kind === 'update-addon'
      ? { title: 'Start the game and log in', state: 'problem', lines: [link.line ?? link.word] }
      : {
          title: 'Start the game and log in',
          state: setup.addon ? 'todo' : 'waiting',
          lines: [
            !setup.addon
              ? 'Then start World of Warcraft: Forever and log in with a character.'
              : link?.kind === 'lost' || link?.kind === 'waiting'
              ? 'The game is open but nothing comes from the addon yet. Log in with a character.'
              : link?.kind === 'minimized'
                ? 'The game is minimized. Bring its window back on screen.'
                : 'Start World of Warcraft: Forever and log in with a character.',
            'At the character list, open AddOns and make sure Twinmap Forever is ticked.',
            'Photosensitivity warning: the addon sends data by changing the colors of a one pixel line at the edge of the game window, many times per second. Its settings in the game can slow it down or pause it.',
          ],
        }

  const questie: Step = {
    title: 'Questie',
    state: setup.questie ? 'done' : setup.gameFolder ? 'todo' : 'waiting',
    lines: [setup.questie ? 'Questie is installed: the map will show the quests it shows.' : 'Optional. With the Questie addon installed, the map shows the quests it shows. Without it the map works all the same.'],
  }
  return [game, addon, play, questie]
}

/** Game found, addon found, position coming: nothing is left to do. */
export const setupComplete = (steps: Step[]): boolean => steps.slice(0, 3).every((s) => s.state === 'done')
