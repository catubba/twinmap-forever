import type { LinkSnapshot } from '../../shared/link'
import type { SetupStatus } from '../../shared/setup'
import type { TilesStatus } from '../../shared/tiles-status'

// What the preload script puts on the window.
declare global {
  interface Window {
    twinmap: {
      onLink: (listener: (snapshot: LinkSnapshot) => void) => void
      onTiles: (listener: (status: TilesStatus) => void) => void
      onSetup: (listener: (status: SetupStatus) => void) => void
      chooseGameFolder: () => Promise<string | null>
      openCurseForge: () => Promise<void>
    }
  }
}
