import type { LinkSnapshot } from '../../shared/link'

// What the preload script puts on the window.
declare global {
  interface Window {
    twinmap: { onLink: (listener: (snapshot: LinkSnapshot) => void) => void }
  }
}
