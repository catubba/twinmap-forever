// The frame of the window (M20): the tabs at the top are workspaces, each a layout of panels (dockview-core), kept in
// settings.json with the one open. Each section of the app (the map, Now, Items, the Auction House) is made once by
// App.svelte and registered here by its id (the action `section`); opening a workspace moves each section's node into
// the panel that holds it there, so the map is never made again. A section in no panel of the open workspace waits in
// the stash, at the size it had: nothing in it is told of a resize, and the stash is inert (the map's keys are off).
// The layout is locked: the edges between panels move, nothing else.
import type { DockviewComponent as Dock, DockviewGroupPanel, IContentRenderer, SerializedDockview } from 'dockview-core'
// The build with its styles in: the package's own entry has none, and there is no CSS file beside it.
// @ts-expect-error no declaration for the UMD build
import * as built from 'dockview-core/dist/dockview-core.js'
import { t } from '../../shared/i18n'
import { PANELS, WORKSPACES_VERSION, type Workspaces } from '../../shared/workspaces'

const { DockviewComponent } = built as typeof import('dockview-core')

/** The panel of Now beside the map: as wide as it was dragged, never under 260 px nor over half the window. */
export const PANEL = { least: 260, start: 340 }

/** The workspaces, in the order of the tabs. */
export const SPACES = ['map', 'character', 'ah'] as const

/** The workspace open, by its place among the tabs. */
export const frame = $state({ open: 0 })

/** Where the map stands beside the panel of Now (the M key, Settings > Appearance, the button on the panel). */
export const layout = $state({ mapRight: false })

const TITLES: Record<string, () => string> = {
  map: () => t('app.top.map'),
  now: () => t('app.top.now'),
  items: () => t('app.top.character'),
  ah: () => t('app.top.auctionHouse'),
}

const sections = new Map<string, HTMLElement>()
const docks: Dock[] = []
const boxes: HTMLElement[] = []
// The element dockview gives each panel, by workspace and panel.
const hosts = new Map<string, HTMLElement>()
const at = (space: number, id: string): string => `${space}:${id}`
let stash: HTMLElement | undefined
// Now lies over the map instead of beside it: closed, or on a small screen.
let over = false
let saving = 0
// The width the player gave Now in each workspace: kept as the window changes size (dockview would share the change out
// among the panels), changed only by dragging the edge or by a double click on it.
const widths: (number | undefined)[] = []

/** Svelte action: this node is the section of that id. */
export function section(node: HTMLElement, id: string): { destroy(): void } {
  sections.set(id, node)
  if (docks.length) lay()
  return { destroy: () => sections.delete(id) }
}

// Into the stash, at the size it had: its ResizeObservers see no change.
function park(node: HTMLElement): void {
  if (!stash || node.parentElement === stash) return
  const r = node.getBoundingClientRect()
  if (r.width && r.height) {
    node.style.width = `${r.width}px`
    node.style.height = `${r.height}px`
  }
  stash.appendChild(node)
}

function place(node: HTMLElement, host: HTMLElement): void {
  if (node.parentElement === host) return
  node.style.width = node.style.height = ''
  host.appendChild(node)
}

const groupOf = (dock: Dock, id: string): DockviewGroupPanel | undefined => dock.panels.find((p) => p.id === id)?.group

/** Gives each section of the open workspace its panel; the others wait in the stash. */
function lay(): void {
  const i = frame.open, dock = docks[i]
  if (!dock) return
  const here = new Set(dock.panels.map((p) => p.id))
  for (const [id, node] of sections) if (!here.has(id)) park(node)
  const nowOver = over && here.has('map') && here.has('now')
  for (const id of here) {
    const node = sections.get(id), host = hosts.get(at(i, id === 'now' && nowOver ? 'map' : id))
    if (node && host) place(node, host)
  }
  const now = groupOf(dock, 'now')
  if (now && here.has('map') && dock.isVisible(now) === nowOver) {
    dock.setVisible(now, !nowOver)
    if (!nowOver) hold(i)
  }
}

// Now back to the width the player gave it, as far as the window lets it.
function hold(i: number): void {
  const dock = docks[i], now = dock && groupOf(dock, 'now'), width = widths[i]
  if (!now || !width || !dock.isVisible(now)) return
  const to = Math.min(Math.max(width, PANEL.least), Math.floor(innerWidth / 2))
  if (Math.round(now.api.width) !== to) now.api.setSize({ width: to })
}

// Locked: no tab is dragged nor dropped, and a group of one panel shows no tab at all, as the app was before. Only what
// differs is set: dockview answers a change with a layout of its own.
function dress(dock: Dock): void {
  for (const group of dock.groups) {
    if (group.model.locked !== 'no-drop-target') group.model.locked = 'no-drop-target'
    if (group.model.header.hidden !== (group.panels.length === 1)) group.model.header.hidden = group.panels.length === 1
  }
  const now = groupOf(dock, 'now'), most = Math.max(PANEL.least, Math.floor(innerWidth / 2))
  if (now && (now.minimumWidth !== PANEL.least || now.maximumWidth !== most)) now.api.setConstraints({ minimumWidth: PANEL.least, maximumWidth: most })
  for (const sash of dock.element.querySelectorAll<HTMLElement>('.dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash')) sash.title = t('app.panel.widthHint')
}

// Which side of Now the map is on, from the Map workspace while both show.
function side(): void {
  const dock = docks[SPACES.indexOf('map')]
  const map = dock && groupOf(dock, 'map'), now = dock && groupOf(dock, 'now')
  if (!map || !now || !dock.isVisible(now)) return
  const m = map.element.getBoundingClientRect(), n = now.element.getBoundingClientRect()
  if (m.width && n.width) layout.mapRight = n.left < m.left
}

// Kept half a second after the last change: a dragged edge is written once.
function save(): void {
  clearTimeout(saving)
  saving = window.setTimeout(write, 500)
}
function write(): void {
  saving = 0
  if (docks.length !== SPACES.length) return
  const kept: Workspaces = { version: WORKSPACES_VERSION, open: frame.open, spaces: SPACES.map((id, i) => ({ id, layout: docks[i]!.toJSON() })) }
  void window.twinmap.setWorkspaces(kept)
}
const fit = (): void => docks.forEach((dock, i) => (dress(dock), hold(i)))

// As the app was before the workspaces: the map with Now beside it, on the side and as wide as the 0.17.0 kept them.
// Gives the width of Now, where there is one.
function lay0(dock: Dock, id: string): number | undefined {
  if (id !== 'map') {
    const panel = id === 'character' ? 'items' : 'ah'
    dock.addPanel({ id: panel, component: panel, title: TITLES[panel]!() })
    return undefined
  }
  const right = localStorage.getItem('map-side') === 'right'
  const width = Math.round(Math.min(Math.max(Number(localStorage.getItem('panel-width')) || PANEL.start, PANEL.least), innerWidth / 2))
  dock.addPanel({ id: 'map', component: 'map', title: TITLES.map!() })
  dock.addPanel({ id: 'now', component: 'now', title: TITLES.now!(), position: { referencePanel: 'map', direction: right ? 'left' : 'right' }, initialWidth: width })
  return width
}

/** Builds the workspaces in root, from what was kept or as the app was before; the stash holds the sections not on show. */
export function mount(root: HTMLElement, stashed: HTMLElement, kept: Workspaces | undefined): void {
  stash = stashed
  frame.open = kept?.spaces[kept.open] && SPACES.includes(kept.spaces[kept.open]!.id as (typeof SPACES)[number]) ? SPACES.indexOf(kept.spaces[kept.open]!.id as (typeof SPACES)[number]) : 0
  SPACES.forEach((id, i) => {
    const box = document.createElement('div')
    box.className = 'space dockview-theme-twinmap'
    root.appendChild(box)
    boxes.push(box)
    const dock = new DockviewComponent(box, {
      theme: { name: 'twinmap', className: 'dockview-theme-twinmap', gap: 0 },
      disableDnd: true,
      createComponent: ({ id: panel }): IContentRenderer => {
        const element = document.createElement('div')
        element.className = 'dv-host'
        return {
          element,
          init: () => {
            hosts.set(at(i, panel), element)
            if (i === frame.open && docks.length === SPACES.length) lay()
          },
          dispose: () => {
            hosts.delete(at(i, panel))
            for (const node of element.children) if (node instanceof HTMLElement && [...sections.values()].includes(node)) park(node)
          },
        }
      },
    })
    docks.push(dock)
    dock.layout(root.clientWidth, root.clientHeight)
    const layoutOf = kept?.spaces.find((s) => s.id === id)?.layout
    try {
      if (!layoutOf) throw new Error('none kept')
      dock.fromJSON(layoutOf as SerializedDockview)
      // Now as wide as it was kept, read at the size the window had then.
      const { grid } = layoutOf as SerializedDockview
      dock.layout(grid.width, grid.height)
      const now = groupOf(dock, 'now')
      if (now) widths[i] = Math.round(now.api.width)
      dock.layout(root.clientWidth, root.clientHeight)
      // A panel this version has not: out. Titles in the language spoken now.
      for (const panel of [...dock.panels]) if (!(PANELS as readonly string[]).includes(panel.id)) dock.removePanel(panel)
      if (!dock.panels.length) throw new Error('empty')
      for (const panel of dock.panels) panel.api.setTitle(TITLES[panel.id]!())
    } catch {
      dock.clear()
      widths[i] = lay0(dock, id)
    }
    dress(dock)
    dock.onDidLayoutChange(() => {
      side()
      save()
    })
    new ResizeObserver(() => {
      dock.layout(box.clientWidth, box.clientHeight)
      hold(i)
    }).observe(box)
    hold(i)
  })
  side()
  show()
  lay()
  addEventListener('resize', fit)
  // The edge dragged: the width Now is left at is the player's. A double click puts it back to its first width.
  const taken = (): void => {
    const now = groupOf(docks[frame.open]!, 'now')
    if (now && docks[frame.open]!.isVisible(now)) widths[frame.open] = Math.round(now.api.width)
  }
  root.addEventListener('pointerdown', (e) => {
    if (!(e.target as Element).closest('.dv-sash')) return
    addEventListener('pointerup', () => requestAnimationFrame(taken), { once: true })
  })
  root.addEventListener('dblclick', (e) => {
    if (!(e.target as Element).closest('.dv-sash')) return
    widths[frame.open] = PANEL.start
    hold(frame.open)
  })
}

// Only the open workspace is seen and reached; the others keep their size, hidden.
function show(): void {
  boxes.forEach((box, i) => {
    box.classList.toggle('open', i === frame.open)
    box.inert = i !== frame.open
  })
}

/** Opens a workspace, by its place among the tabs. */
export function open(space: number): void {
  if (space === frame.open || !docks[space]) return
  frame.open = space
  show()
  lay()
  save()
}

/** Now over the map (closed, or a small screen) or beside it. */
export function nowOver(on: boolean): void {
  if (on === over) return
  if (on) side()
  over = on
  lay()
}

/** The map on the right of Now, or on its left: Now's group moved to the other side of the map's, as wide as it was. */
export function setMapRight(right: boolean): void {
  for (const dock of docks) {
    const map = groupOf(dock, 'map'), now = groupOf(dock, 'now')
    if (!map || !now) continue
    const hidden = !dock.isVisible(now)
    if (hidden) dock.setVisible(now, true)
    now.api.moveTo({ group: map, position: right ? 'left' : 'right' })
  }
  layout.mapRight = right
  docks.forEach(dress)
  lay()
  docks.forEach((_, i) => hold(i))
}

/** The frame taken down (the first run shown again): what was waiting to be kept is kept, and the next mount starts afresh. */
export function unmount(): void {
  if (saving) (clearTimeout(saving), write())
  removeEventListener('resize', fit)
  for (const dock of docks) dock.dispose()
  docks.length = boxes.length = widths.length = 0
  hosts.clear()
  stash = undefined
}
