import type { LinkSnapshot } from '../../shared/link'
import type { QuestsStatus } from '../../shared/quests'
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
      chooseGameFolder: () => Promise<string | null>
      openCurseForge: () => Promise<void>
      retryTiles: () => Promise<void>
      drawn: () => void
      setOnTop: (on: boolean) => Promise<void>
      search: (typed: string) => Promise<Found[]>
      sendPin: (pin: Pin) => Promise<{ seq: number } | { error: string }>
    }
  }
}
