// Columns widened and narrowed with the mouse, from the line at the edge of their heading (the
// Auction House section, design/ui.md section 5). The widths are kept, one list for each table by
// its name, so the table opens as it was left.

import { t } from '../../shared/i18n'

const LEAST = 44 // px: a column is never narrower

export function columns(table: HTMLTableElement, name: string): { destroy: () => void } {
  const heads = (): HTMLElement[] => [...(table.tHead?.rows[0]?.cells ?? [])]
  let widths: number[] | null = null
  try {
    const kept = JSON.parse(localStorage.getItem(`columns:${name}`) ?? 'null') as unknown
    if (Array.isArray(kept) && kept.length === heads().length && kept.every((w) => typeof w === 'number')) widths = kept
  } catch {
    // none kept
  }
  const fix = (): void => {
    if (!widths) return
    table.style.tableLayout = 'fixed'
    table.style.width = `${widths.reduce((a, b) => a + b, 0)}px`
    heads().forEach((h, i) => (h.style.width = `${widths![i]}px`))
  }
  fix()
  const grips = heads().map((th, i) => {
    const grip = document.createElement('span')
    grip.className = 'grip'
    grip.title = t('items.resize')
    th.appendChild(grip)
    grip.onpointerdown = (e) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      widths ??= heads().map((h) => h.offsetWidth)
      const x0 = e.clientX, w0 = widths[i]!
      grip.setPointerCapture(e.pointerId)
      grip.onpointermove = (m) => {
        widths![i] = Math.max(LEAST, w0 + m.clientX - x0)
        fix()
      }
      grip.onpointerup = grip.onpointercancel = () => {
        grip.onpointermove = grip.onpointerup = grip.onpointercancel = null
        localStorage.setItem(`columns:${name}`, JSON.stringify(widths))
      }
    }
    // A double click puts the column back as the table lays it.
    grip.ondblclick = () => {
      localStorage.removeItem(`columns:${name}`)
      widths = null
      table.style.tableLayout = table.style.width = ''
      heads().forEach((h) => (h.style.width = ''))
    }
    return grip
  })
  return { destroy: () => grips.forEach((g) => g.remove()) }
}
