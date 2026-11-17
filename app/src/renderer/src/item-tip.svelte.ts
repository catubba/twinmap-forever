// The item under the pointer, for its popup (ItemPopup.svelte, drawn once in App.svelte), and the
// game's tooltips the app keeps (M10-F15). A row or a slot that shows an item takes use:itemTip.
import type { Tips } from '../../shared/tips'

export interface Hovered {
  item: number
  /** The key the sheet carries for an item with a suffix or an enchant. */
  key?: string
  /** Durability now, for what is worn. */
  wear?: { now?: number; most?: number }
  /** How many in the stack: the sell price is of all of them. */
  n?: number
  box: DOMRect
}

export const hover = $state<{ now: Hovered | null }>({ now: null })
export const kept = $state<{ tips: Tips }>({ tips: {} })
window.twinmap.onTips((tips) => (kept.tips = tips))

export function itemTip(node: HTMLElement, given: Omit<Hovered, 'box'>): { update: (p: Omit<Hovered, 'box'>) => void; destroy: () => void } {
  let params = given
  // An item of number 0: nothing to show (a recipe that makes no item).
  const enter = (): void => void (params.item > 0 && (hover.now = { ...params, box: node.getBoundingClientRect() }))
  const leave = (): void => {
    if (hover.now?.item === params.item) hover.now = null
  }
  node.addEventListener('pointerenter', enter)
  node.addEventListener('pointerleave', leave)
  return {
    update: (p) => void (params = p),
    destroy: () => {
      leave()
      node.removeEventListener('pointerenter', enter)
      node.removeEventListener('pointerleave', leave)
    },
  }
}
