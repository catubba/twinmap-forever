// One of the things the app keeps for every screen (shared/kept.ts), as this screen sees it: read
// like any state, and a change made here is told to the app, which tells the other screens.
import { onDestroy } from 'svelte'
import type { Kept, KeptKey } from '../../shared/kept'
import { inApp } from './web'

// The app says what it keeps when the page has loaded and at every change. A part of the page that
// comes later (the map, once its pictures are ready) is given the latest at once.
let latest: Kept | null = null
const hearers = new Set<(all: Kept) => void>()
window.twinmap.onKept((all) => {
  latest = all
  for (const hear of hearers) hear(all)
})

/** from: reads the value from its text, checked; with null, the empty one. Called while a component is being made. */
export function kept<K extends KeptKey>(key: K, from: (text: string | null) => NonNullable<Kept[K]>): { value: NonNullable<Kept[K]>; readonly heard: boolean } {
  let value = $state.raw(from(null))
  // What the app is known to keep, as text; null until it has said. Before that nothing is told to
  // it: this screen does not know yet what it would be writing over.
  let last: string | null = null
  let heard = $state(false)
  const hear = (all: Kept): void => {
    const told = all[key]
    if (told === null) {
      // Never kept. The app's own window kept this by itself before it was shared: it hands it over, once.
      if (!inApp || last !== null) return
      value = from(localStorage.getItem(key))
      last = JSON.stringify(value)
      heard = true
      void window.twinmap.keep(key, value)
      return
    }
    const text = JSON.stringify(told)
    heard = true
    if (text === last) return
    last = text
    value = from(text)
  }
  hearers.add(hear)
  onDestroy(() => hearers.delete(hear))
  if (latest) hear(latest)
  return {
    get value() {
      return value
    },
    set value(to) {
      value = to
      const text = JSON.stringify(to)
      if (last === null || text === last) return
      last = text
      void window.twinmap.keep(key, to)
    },
    get heard() {
      return heard
    },
  }
}
