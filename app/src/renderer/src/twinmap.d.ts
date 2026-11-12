import type { LinkSnapshot } from '../../shared/link'
import type { QuestsStatus } from '../../shared/quests'
import type { RouteNews } from '../../shared/route'
import type { Found } from '../../shared/search'
import type { Pin } from '../../shared/send'
import type { SetupStatus } from '../../shared/setup'
import type { TilesStatus } from '../../shared/tiles-status'

// What the preload script puts on the window.
declare global {
  interface Window {
    twinmap: {
      onLink: (listener: (snapshot: LinkSnapshot) => void) => void
      onTiles: (listener: (status: TilesStatus) => void) => void
      onSetup: (listener: (status: SetupStatus) => void) => void
      onQuests: (listener: (status: QuestsStatus) => void) => void
      onKept: (listener: (kept: import('../../shared/kept').Kept) => void) => void
      keep: (key: import('../../shared/kept').KeptKey, value: unknown) => Promise<void>
      chooseGameFolder: () => Promise<string | null>
      openCurseForge: () => Promise<void>
      retryTiles: () => Promise<void>
      drawn: () => void
      setOnTop: (on: boolean) => Promise<void>
      setLan: (on: boolean) => Promise<void>
      search: (typed: string) => Promise<Found[]>
      walk: (ask: import('../../shared/walk').WalkAsk) => Promise<import('../../shared/walk').WalkPath>
      walkFar: (ask: import('../../shared/walk').FarAsk) => Promise<import('../../shared/walk').Far>
      sendPin: (pin: Pin) => Promise<{ seq: number } | { error: string }>
      sendMarks: (pins: Pin[], taken: string[]) => Promise<void>
      sendUnfollow: () => Promise<{ seq: number } | { error: string }>
      sendRoute: (route: RouteNews | false) => Promise<{ seq: number } | { error: string }>
      sendStep: (step: { t: number; at: number }) => Promise<{ seq: number } | { error: string }>
    }
  }
}
