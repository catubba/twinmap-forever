// How far on foot from the character to places on its continent: asked of the main process, which
// finds the ways on a thread of its own (main/walk.ts), in one search for all of them. Until the
// answer comes, and for a place no way was found to, there is nothing here: the caller shows the
// yards as the crow flies.
import type { Point } from '../../shared/geo'
import { YARDS_PER_UNIT, type FarAsk } from '../../shared/walk'

const spot = (p: Point): string => `${p.x} ${p.y}`
const crow = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y) * YARDS_PER_UNIT

/**
 * wanted: from where to which places, or null when there is nothing to ask. step: the yards the
 * character moves before it is asked again; under a cell of the grid (about 8) the answer would
 * be the same. One asking at a time: the next waits for the answer.
 */
export function feet(wanted: () => FarAsk | null, step = 8): { yards: (to: Point) => number | undefined; readonly known: boolean; readonly took: number } {
  let answer = $state.raw<{ continent: number; from: Point; by: Map<string, number> } | null>(null)
  let took = $state(0) // ms from the asking to the answer, for the trials
  let turn = $state(0)
  let busy = false, asked = ''
  const want = $derived(wanted())
  $effect(() => {
    void turn
    const ask = want
    if (!ask?.to.length) return void ((answer = null), (asked = ''))
    const key = `${ask.continent} ${Math.round((ask.from.x * YARDS_PER_UNIT) / step)} ${Math.round((ask.from.y * YARDS_PER_UNIT) / step)} ${ask.reach} ${ask.to.map(spot).join(',')}`
    if (busy || key === asked) return
    busy = true
    asked = key
    const started = performance.now(), from = { ...ask.from }, to = ask.to.map((p) => ({ x: p.x, y: p.y }))
    void window.twinmap
      .walkFar({ continent: ask.continent, from, to, reach: ask.reach })
      .catch(() => [])
      .then((far) => {
        busy = false
        answer = { continent: ask.continent, from, by: new Map(to.flatMap((p, i) => (typeof far[i] === 'number' ? [[spot(p), far[i]] as [string, number]] : []))) }
        took = performance.now() - started
        turn++
      })
  })
  return {
    // The yards of the last answer, moved along with the character since: by as much as the place
    // has come nearer or gone further as the crow flies, and never fewer than the crow's.
    yards(to) {
      const now = want, then = answer?.by.get(spot(to))
      if (!now || !answer || answer.continent !== now.continent || then === undefined) return undefined
      const straight = crow(now.from, to)
      return Math.max(straight, then + straight - crow(answer.from, to))
    },
    get known() {
      return answer !== null
    },
    get took() {
      return took
    },
  }
}
