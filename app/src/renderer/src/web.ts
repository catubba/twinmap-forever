// The same page in two places. In the app's own window the preload script has put window.twinmap
// there. In the browser of a phone on the home network nothing has: this file puts one there
// that hears the app on /events and asks it things on /call/<name> (main/lan.ts answers both).
import type { LinkSnapshot } from '../../shared/link'
import { CURSEFORGE } from '../../shared/setup'

/** The page runs in the app's own window, not in a browser on the home network. */
export const inApp = 'twinmap' in window

/** Where the map's files are asked for. */
export const TILES = inApp ? 'twinmap://tiles' : '/tiles'

if (!inApp) {
  const events = new EventSource('/events')
  const on =
    <T>(channel: string) =>
    (listener: (told: T) => void): void =>
      events.addEventListener(channel, (e) => listener(JSON.parse((e as MessageEvent<string>).data) as T))
  // An app that does not answer (closed, or the phone left the house) gives what an empty answer would.
  const call =
    <T>(name: string, none: T) =>
    async (...args: unknown[]): Promise<T> => {
      try {
        const answer = await fetch(`/call/${name}`, { method: 'POST', body: JSON.stringify(args) })
        return answer.ok ? ((await answer.json()) as T) : none
      } catch {
        return none
      }
    }
  const unsent = { error: 'Twinmap on the computer did not answer.' }
  // The times in what the game told are the computer's, and the page compares them with its own
  // clock (is the link lost, where is the arrow now): they are moved onto this browser's clock.
  // ponytail: how far ahead this clock is, by the news that took least to come; a clock set anew while the page is open is not followed
  let ahead = Infinity
  const onLink = (listener: (snapshot: LinkSnapshot) => void): void =>
    events.addEventListener('link', (e) => {
      const { data, lastEventId } = e as MessageEvent<string>, snapshot = JSON.parse(data) as LinkSnapshot
      ahead = Math.min(ahead, Date.now() - Number(lastEventId))
      const times = snapshot.state.updatedAt
      for (const section of Object.keys(times)) times[section]! += ahead
      listener(snapshot)
    })
  window.twinmap = {
    onLink,
    onTiles: on('tiles'),
    onSetup: on('setup'),
    onQuests: on('quests'),
    // What belongs to the computer stays on the computer.
    chooseGameFolder: () => Promise.resolve('Choose the game folder in Twinmap on the computer.'),
    openCurseForge: () => Promise.resolve(void window.open(CURSEFORGE, '_blank', 'noopener')),
    setOnTop: () => Promise.resolve(),
    setLan: () => Promise.resolve(),
    drawn: () => {},
    retryTiles: call('retry-tiles', undefined),
    search: call('search', []),
    walk: call('walk', null),
    walkFar: call('walk-far', []),
    sendPin: call('send-pin', unsent),
    // My pins are kept by each browser for now, and the game is to have the computer's: a phone
    // that told its own would take the computer's off the game's map.
    sendMarks: () => Promise.resolve(),
    sendUnfollow: call('send-unfollow', unsent),
    sendRoute: call('send-route', unsent),
    sendStep: call('send-step', unsent),
  }
}
