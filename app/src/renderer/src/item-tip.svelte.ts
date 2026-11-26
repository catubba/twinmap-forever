// The item under the pointer, for its popup (ItemPopup.svelte, drawn once in App.svelte), and the
// game's tooltips the app keeps (M10-F15). A row or a slot that shows an item takes use:itemTip.
// Clicked, it is the item chosen (M20-F9): the auction shows its page in the Item panel, or in its search, when the open
// workspace has one of them; otherwise the click does nothing and the popup is all.
import type { TipLine, Tips } from '../../shared/tips'
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
  // A button inside the row (a + of the shopping list, of a trainer's recipe) does its own thing, not this.
  const click = (e: MouseEvent): void => {
    const control = (e.target as Element | null)?.closest?.('button, a, input, select')
    if (control && control !== node && node.contains(control)) return
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

/**
 * The spell or talent under the pointer or reached with the keyboard (M20-F16): what makes the lines of its popup
 * (SpellPopup.svelte), read there as it changes: a tooltip that comes, a rank taken, while the popup is open.
 */
export const spellHover = $state<{ now: { lines: () => TipLine[]; box: DOMRect; node: HTMLElement } | null }>({ now: null })

/** A spell or a talent: its popup, with the lines its panel makes, opens under the pointer and on focus, and goes with them. */
export function spellTip(node: HTMLElement, given: () => TipLine[]): { update: (p: () => TipLine[]) => void; destroy: () => void } {
  let lines = given
  const enter = (): void => void (spellHover.now = { lines, box: node.getBoundingClientRect(), node })
  const leave = (): void => {
    if (spellHover.now?.node === node) spellHover.now = null
  }
  const on: [string, () => void][] = [['pointerenter', enter], ['focus', enter], ['pointerleave', leave], ['blur', leave]]
  for (const [event, f] of on) node.addEventListener(event, f)
  return {
    update: (p) => void (lines = p),
    destroy: () => {
      leave()
      for (const [event, f] of on) node.removeEventListener(event, f)
    },
  }
}
