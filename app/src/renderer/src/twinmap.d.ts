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
      onSheets: (listener: (sheets: import('../../shared/sheet').Sheets) => void) => void
      forgetSheet: (key: string) => Promise<void>
      onPortraits: (listener: (told: import('../../shared/portrait').PortraitsTold) => void) => void
      retakePortrait: (key: string | null) => Promise<void>
      savePortrait: (key: string) => Promise<void>
      onTips: (listener: (tips: import('../../shared/tips').Tips) => void) => void
      itemSources: (item: number) => Promise<import('../../shared/tips').ItemSources>
      onUpdate: (listener: (updating: import('../../main/update').Updating) => void) => void
      chooseGameFolder: () => Promise<string | null>
      openCurseForge: (addon?: import('../../shared/setup').Optional) => Promise<void>
      openFeedback: (way: import('../../shared/feedback').FeedbackWay, details: string) => Promise<void>
      sendFeedback: (sent: import('../../shared/feedback').FeedbackSent) => Promise<string | null>
      readLog: () => Promise<string>
      retryTiles: () => Promise<void>
      drawn: () => void
      setOnTop: (on: boolean) => Promise<void>
      setLan: (on: boolean) => Promise<void>
      setParticipate: (on: boolean) => Promise<void>
      setPause: (on: boolean) => Promise<void>
      search: (typed: string) => Promise<Found[]>
      walk: (ask: import('../../shared/walk').WalkAsk) => Promise<import('../../shared/walk').WalkPath>
      walkFar: (ask: import('../../shared/walk').FarAsk) => Promise<import('../../shared/walk').Far>
      walkTrack: (ask: import('../../shared/walk').TrackAsk) => Promise<import('../../shared/walk').Floors>
      sendPin: (pin: Pin) => Promise<{ seq: number } | { error: string }>
      sendMarks: (pins: Pin[], taken: string[]) => Promise<void>
      sendUnfollow: () => Promise<{ seq: number } | { error: string }>
      sendRoute: (route: RouteNews | false) => Promise<{ seq: number } | { error: string }>
      sendStep: (step: { t: number; at: number }) => Promise<{ seq: number } | { error: string }>
    }
  }
}
