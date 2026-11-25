// The item under the pointer, for its popup (ItemPopup.svelte, drawn once in App.svelte), and the
// game's tooltips the app keeps (M10-F15). A row or a slot that shows an item takes use:itemTip.
// Clicked, it is the item chosen (M20-F9): the auction shows its page in the Item panel, or in its search, when the open
// workspace has one of them; otherwise the click does nothing and the popup is all.
import type { Tips } from '../../shared/tips'
import { frame } from './frame.svelte'

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
/** The item last chosen, and how many times one was: the auction takes each new one once. */
export const chosen = $state<{ item: number; key?: string; n: number }>({ item: 0, n: 0 })
/** Whether a click on an item shows its page: the open workspace has the Item panel or the auction's search. */
export const choosable = (): boolean => !frame.missing.includes('item') || !frame.missing.includes('search')
window.twinmap.onTips((tips) => (kept.tips = tips))

export function itemTip(node: HTMLElement, given: Omit<Hovered, 'box'>): { update: (p: Omit<Hovered, 'box'>) => void; destroy: () => void } {
  let params = given
  // An item of number 0: nothing to show (a recipe that makes no item).
  const enter = (): void => {
    node.style.cursor = params.item > 0 && choosable() ? 'pointer' : ''
    if (params.item > 0) hover.now = { ...params, box: node.getBoundingClientRect() }
  }
  const leave = (): void => {
    if (hover.now?.item === params.item) hover.now = null
  }
  const click = (): void => {
    if (params.item > 0 && choosable()) Object.assign(chosen, { item: params.item, key: params.key, n: chosen.n + 1 })
  }
  node.addEventListener('pointerenter', enter)
  node.addEventListener('pointerleave', leave)
  node.addEventListener('click', click)
  return {
    update: (p) => void (params = p),
    destroy: () => {
      leave()
      node.removeEventListener('pointerenter', enter)
      node.removeEventListener('pointerleave', leave)
      node.removeEventListener('click', click)
    },
  }
}
