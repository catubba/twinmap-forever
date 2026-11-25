// The frame of the window (M20): the tabs at the top are workspaces, each a layout of panels (dockview-core), kept in
// settings.json with the one open. Each section of the app (the map, Now, Items, the Auction House) is made once by
// App.svelte and registered here by its id (the action `section`); opening a workspace moves each section's node into
// the panel that holds it there, so the map is never made again. A section in no panel of the open workspace waits in
// the stash, at the size it had: nothing in it is told of a resize, and the stash is inert (the map's keys are off).
// Locked, the edges between panels move and nothing else; Edit layout unlocks the open workspace: its tabs are dragged
// beside or into each other, a panel is closed or added, and a workspace or all of them go back to their defaults.
// There too the workspaces themselves are made, renamed, moved and deleted, up to six (MOST).
// The blocks of Now (PARTS) are sections too, whose home is their place in the column: a block a panel of the open
// workspace holds is drawn there and not in the column; its panel closed, or another workspace opened, it goes back.
import type { DockviewComponent as Dock, DockviewGroupPanel, IContentRenderer, SerializedDockview } from 'dockview-core'
// The build with its styles in: the package's own entry has none, and there is no CSS file beside it.
// @ts-expect-error no declaration for the UMD build
import * as built from 'dockview-core/dist/dockview-core.js'
import { t } from '../../shared/i18n'
import { CHARACTER, MOST, NAME_MOST, PANELS, WORKSPACES_VERSION, type Workspaces } from '../../shared/workspaces'

const { DockviewComponent, positionToDirection } = built as typeof import('dockview-core')

/** The panel of Now beside the map: as wide as it was dragged, never under 260 px nor over half the window. */
export const PANEL = { least: 260, start: 340 }

/** The workspaces there are at first, in the order of the tabs. */
export const DEFAULTS = ['map', 'character', 'ah'] as const

/** A workspace by its id, with the name the player gave it, if any. */
export type Space = { id: string; name?: string }

/** The workspaces in the order of the tabs; the one open, by its place among them; Edit layout on; the panels the open
 * workspace has not (Add panel); whether it lays the map and Now side by side and nothing else, the shape the map's side
 * and Now over the map need. */
export const frame = $state({ spaces: [] as Space[], open: 0, editing: false, missing: [] as string[], paired: true })

/** Where the map stands beside the panel of Now (the M key, Settings > Appearance, the button on the panel), and whether
 * a workspace has them side by side as at first, where that choice holds. */
export const layout = $state({ mapRight: false, sided: true })

const TITLES: Record<string, () => string> = {
  map: () => t('app.top.map'),
  now: () => t('app.top.now'),
  character: () => t('app.top.character'),
  bags: () => t('items.places.bags'),
  bank: () => t('items.places.bank'),
  inventory: () => t('app.top.inventory'),
  professions: () => t('app.top.professions'),
  ah: () => t('app.top.auctionHouse'),
  next: () => t('map.nextStop.title'),
  attention: () => t('app.now.attention'),
  pins: () => t('app.now.pins'),
  quests: () => t('app.now.quests'),
  nearby: () => t('app.now.nearby'),
  experience: () => t('app.panel.experience'),
}
/** The name of a panel, in the language spoken now (Add panel, its tab). */
export const titleOf = (id: string): string => TITLES[id]?.() ?? id

/** The blocks of Now, each a panel of its own once taken out of the column. */
export const PARTS = ['next', 'attention', 'pins', 'quests', 'nearby', 'experience'] as const
/** What a block of Now carries while its handle is dragged: its id. */
export const PART_DRAG = 'application/x-twinmap-part'
const NAMES: Record<string, () => string> = { map: TITLES.map!, character: TITLES.character!, ah: TITLES.ah! }

/** The name a workspace has without one of the player's: the default ones' in the language spoken now. */
export const nameFirst = (id: string): string => NAMES[id]?.() ?? t('app.layout.unnamed')
/** The name of a workspace: the player's as written, or its default one. */
export const nameOf = (space: Space): string => space.name ?? nameFirst(space.id)

// Each workspace made: its dockview, the element it is in, what follows that element's size, and the width the player
// gave Now there, kept as the window changes size (dockview would share the change out among the panels), changed only by
// dragging the edge or by a double click on it. In the order of frame.spaces.
type Made = { dock: Dock; box: HTMLElement; seen: ResizeObserver; width?: number }
const made: Made[] = []
const sections = new Map<string, HTMLElement>()
// Where a block of Now goes back to when no panel holds it: its place in the column.
const homes = new Map<string, HTMLElement>()
// The element dockview gives each panel, by workspace and panel.
const hosts = new Map<string, HTMLElement>()
const at = (space: string, id: string): string => `${space}:${id}`
let root: HTMLElement | undefined
let stash: HTMLElement | undefined
// Now lies over the map instead of beside it: closed, or on a small screen.
let over = false
let saving = 0

/** Svelte action: this node is the section of that id. */
export function section(node: HTMLElement, id: string): { destroy(): void } {
  sections.set(id, node)
  node.dataset.section = id
  if ((PARTS as readonly string[]).includes(id) && node.parentElement) homes.set(id, node.parentElement)
  if (made.length) lay()
  return { destroy: () => sections.delete(id) }
}

// Into the stash, at the size it had: its ResizeObservers see no change. A block of Now back into the column.
function park(node: HTMLElement): void {
  const home = homes.get(node.dataset.section ?? '')
  if (home) return place(node, home)
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
const has = (dock: Dock, id: string): boolean => dock.panels.some((p) => p.id === id)

// The map and Now side by side, each alone in its group, and nothing else: the shape of the app before the workspaces.
// Only there Now lies over the map when closed, keeps its width in px, and the map changes side.
function paired(dock: Dock): boolean {
  const map = groupOf(dock, 'map'), now = groupOf(dock, 'now')
  return !!map && !!now && map !== now && dock.groups.length === 2 && map.panels.length === 1 && now.panels.length === 1 && dock.orientation === 'HORIZONTAL'
}

// What the open workspace has and has not, for the top row and Now.
function tell(): void {
  const dock = made[frame.open]?.dock
  if (!dock) return
  const here = new Set(dock.panels.map((p) => p.id))
  frame.missing = PANELS.filter((id) => !here.has(id))
  frame.paired = paired(dock)
  layout.sided = made.some((m) => paired(m.dock))
  // The last panel of a workspace is not closed: a workspace is never empty. A class, no change to the layout.
  dock.element.classList.toggle('last', dock.panels.length === 1)
}

/** Gives each section of the open workspace its panel; the others wait in the stash. */
function lay(): void {
  const i = frame.open, dock = made[i]?.dock, space = frame.spaces[i]
  if (!dock || !space) return
  const here = new Set(dock.panels.map((p) => p.id))
  for (const [id, node] of sections) if (!here.has(id)) park(node)
  const nowOver = over && !frame.editing && paired(dock)
  for (const id of here) {
    const node = sections.get(id), host = hosts.get(at(space.id, id === 'now' && nowOver ? 'map' : id))
    if (node && host) place(node, host)
  }
  const now = groupOf(dock, 'now')
  if (now && dock.isVisible(now) === nowOver) {
    dock.setVisible(now, !nowOver)
    if (!nowOver) hold(i)
  }
}

// Now back to the width the player gave it, as far as the window lets it.
function hold(i: number): void {
  const dock = made[i]?.dock, now = dock && groupOf(dock, 'now'), width = made[i]?.width
  if (!dock || !now || !width || !dock.isVisible(now) || !paired(dock)) return
  const to = Math.min(Math.max(width, PANEL.least), Math.floor(innerWidth / 2))
  if (Math.round(now.api.width) !== to) now.api.setSize({ width: to })
}

// Locked: no tab is dragged nor dropped, and a group of one panel shows no tab at all, as the app was before. Unlocked:
// every tab shows, to be dragged or closed. Only what differs is set: dockview answers a change with a layout of its own.
function dress(dock: Dock): void {
  const lock = frame.editing ? false : 'no-drop-target'
  if (dock.options.disableDnd !== !frame.editing) dock.updateOptions({ disableDnd: !frame.editing })
  for (const group of dock.groups) {
    if (group.model.locked !== lock) group.model.locked = lock
    const hide = !frame.editing && group.panels.length === 1
    if (group.model.header.hidden !== hide) group.model.header.hidden = hide
  }
  const now = groupOf(dock, 'now'), most = paired(dock) ? Math.max(PANEL.least, Math.floor(innerWidth / 2)) : Number.MAX_SAFE_INTEGER
  if (now && (now.minimumWidth !== PANEL.least || now.maximumWidth !== most)) now.api.setConstraints({ minimumWidth: PANEL.least, maximumWidth: most })
  for (const sash of dock.element.querySelectorAll<HTMLElement>('.dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash')) sash.title = t('app.panel.widthHint')
}

// Which side of Now the map is on, from the open workspace or else the first, while both show side by side.
function side(): void {
  const dock = [made[frame.open], ...made].find((m) => m && paired(m.dock) && m.dock.isVisible(groupOf(m.dock, 'now')!))?.dock
  const map = dock && groupOf(dock, 'map'), now = dock && groupOf(dock, 'now')
  if (!map || !now) return
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
  if (!made.length || made.length !== frame.spaces.length) return
  const spaces = frame.spaces.map(({ id, name }, i) => ({ id, ...(name ? { name } : {}), layout: made[i]!.dock.toJSON() }))
  const kept: Workspaces = { version: WORKSPACES_VERSION, open: frame.open, spaces }
  void window.twinmap.setWorkspaces(kept)
}
const fit = (): void => made.forEach((m, i) => (dress(m.dock), hold(i)))

// The Character workspace as it is at first (chosen on the preview of M20-F8): the Character panel on the left, Bags and
// Bank side by side on its right, Inventory under them, and Professions a tab behind Inventory (M20-F10, the same for
// Spellbook and Talents). Laid out in the place of a panel of an older layout (`at`, the
// Items panel of before), and as tabs of one group where that place is narrower than CHARACTER_WIDE.
const CHARACTER_WIDE = 1000
const BEHIND_INVENTORY = ['professions']
function characters(dock: Dock, at?: string): void {
  const put = (id: string, position?: Parameters<Dock['addPanel']>[0]['position']): void => void dock.addPanel({ id, component: id, title: TITLES[id]!(), ...(position && { position }) })
  put('character', at ? { referencePanel: at, direction: 'within' } : undefined)
  const old = at && dock.getGroupPanel(at)
  if (old) dock.removePanel(old)
  const group = groupOf(dock, 'character')!
  if (group.api.width < CHARACTER_WIDE) {
    for (const id of [...CHARACTER.slice(1), ...BEHIND_INVENTORY]) put(id, { referencePanel: 'character', direction: 'within' })
    dock.getGroupPanel('character')!.api.setActive()
    return
  }
  put('bags', { referencePanel: 'character', direction: 'right' })
  put('inventory', { referencePanel: 'bags', direction: 'below' })
  put('bank', { referencePanel: 'bags', direction: 'right' })
  for (const id of BEHIND_INVENTORY) put(id, { referencePanel: 'inventory', direction: 'within' })
  dock.getGroupPanel('inventory')!.api.setActive()
  group.api.setSize({ width: 500 })
}

// As the app was before the workspaces: the map with Now beside it, on the side and as wide as the 0.17.0 kept them;
// the Character panels; the Auction House alone; a workspace the player made, the map alone. Gives the width of Now,
// where there is one.
function lay0(dock: Dock, id: string, right = localStorage.getItem('map-side') === 'right', wide = Number(localStorage.getItem('panel-width'))): number | undefined {
  if (id === 'character') return void characters(dock)
  if (id === 'ah') {
    dock.addPanel({ id: 'ah', component: 'ah', title: TITLES.ah!() })
    return undefined
  }
  dock.addPanel({ id: 'map', component: 'map', title: TITLES.map!() })
  if (id !== 'map') return undefined
  const width = Math.round(Math.min(Math.max(wide || PANEL.start, PANEL.least), innerWidth / 2))
  dock.addPanel({ id: 'now', component: 'now', title: TITLES.now!(), position: { referencePanel: 'map', direction: right ? 'left' : 'right' }, initialWidth: width })
  return width
}

// A workspace made at the end of the list (frame.spaces has it already): from the layout kept, or as it is by default.
function make(space: Space, kept?: unknown, right?: boolean, wide?: number): void {
  if (!root) return
  const box = document.createElement('div')
  box.className = 'space dockview-theme-twinmap'
  root.appendChild(box)
  const dock = new DockviewComponent(box, {
    theme: { name: 'twinmap', className: 'dockview-theme-twinmap', gap: 0 },
    disableDnd: true,
    disableFloatingGroups: true,
    createComponent: ({ id: panel }): IContentRenderer => {
      const element = document.createElement('div')
      element.className = 'dv-host'
      return {
        element,
        init: () => {
          hosts.set(at(space.id, panel), element)
          if (frame.spaces[frame.open]?.id === space.id && made.length === frame.spaces.length) lay()
        },
        dispose: () => {
          if (hosts.get(at(space.id, panel)) === element) hosts.delete(at(space.id, panel))
          for (const node of element.children) if (node instanceof HTMLElement && [...sections.values()].includes(node)) park(node)
        },
      }
    },
  })
  const me: Made = { dock, box, seen: new ResizeObserver(() => (dock.layout(box.clientWidth, box.clientHeight), hold(made.indexOf(me)))) }
  made.push(me)
  dock.layout(root.clientWidth, root.clientHeight)
  try {
    if (!kept) throw new Error('none kept')
    dock.fromJSON(kept as SerializedDockview)
    // Now as wide as it was kept, read at the size the window had then.
    const { grid } = kept as SerializedDockview
    dock.layout(grid.width, grid.height)
    const now = groupOf(dock, 'now')
    if (now) me.width = Math.round(now.api.width)
    dock.layout(root.clientWidth, root.clientHeight)
    // Items, as it was before M20-F8: the Character panels in its place.
    if (has(dock, 'items')) characters(dock, 'items')
    // A panel this version has not: out. Titles in the language spoken now.
    for (const panel of [...dock.panels]) if (!(PANELS as readonly string[]).includes(panel.id)) dock.removePanel(panel)
    if (!dock.panels.length) throw new Error('empty')
    for (const panel of dock.panels) panel.api.setTitle(TITLES[panel.id]!())
  } catch {
    dock.clear()
    me.width = lay0(dock, space.id, right, wide)
  }
  dress(dock)
  // A block of Now dragged by its handle out of the column lands where it is dropped.
  dock.onUnhandledDragOver((e) => {
    if (frame.editing && (e.nativeEvent as DragEvent).dataTransfer?.types.includes(PART_DRAG)) e.accept()
  })
  dock.onDidDrop((e) => {
    const id = (e.nativeEvent as DragEvent).dataTransfer?.getData(PART_DRAG)
    if (!id || !TITLES[id] || has(dock, id)) return
    const direction = positionToDirection(e.position)
    dock.addPanel({ id, component: id, title: TITLES[id]!(), position: e.group ? { referenceGroup: e.group, direction } : { direction } })
    dress(dock)
    lay()
    tell()
  })
  dock.onDidLayoutChange(() => {
    side()
    if (made[frame.open] === me) tell()
    save()
  })
  me.seen.observe(box)
  hold(made.length - 1)
}

// A workspace taken down: what it showed back to the stash first.
function unmake(i: number): void {
  const m = made[i]
  if (!m) return
  for (const node of sections.values()) if (m.box.contains(node)) park(node)
  m.seen.disconnect()
  m.dock.dispose()
  m.box.remove()
  made.splice(i, 1)
}

/** Builds the workspaces in root, from what was kept or as the app was before; the stash holds the sections not on show. */
export function mount(box: HTMLElement, stashed: HTMLElement, kept: Workspaces | undefined): void {
  root = box
  stash = stashed
  frame.spaces = kept ? kept.spaces.map(({ id, name }) => (name ? { id, name } : { id })) : DEFAULTS.map((id) => ({ id }))
  frame.open = kept?.open ?? 0
  frame.spaces.forEach((space, i) => make(space, kept?.spaces[i]?.layout))
  side()
  show()
  lay()
  tell()
  addEventListener('resize', fit)
  // The edge dragged: the width Now is left at is the player's. A double click puts it back to its first width.
  const taken = (): void => {
    const m = made[frame.open], now = m && groupOf(m.dock, 'now')
    if (m && now && m.dock.isVisible(now)) m.width = Math.round(now.api.width)
  }
  root.addEventListener('pointerdown', (e) => {
    if (!(e.target as Element).closest('.dv-sash')) return
    addEventListener('pointerup', () => requestAnimationFrame(taken), { once: true })
  })
  root.addEventListener('dblclick', (e) => {
    if (!(e.target as Element).closest('.dv-sash') || !made[frame.open]) return
    made[frame.open]!.width = PANEL.start
    hold(frame.open)
  })
}

// Only the open workspace is seen and reached; the others keep their size, hidden.
function show(): void {
  made.forEach((m, i) => {
    m.box.classList.toggle('open', i === frame.open)
    m.box.inert = i !== frame.open
  })
}

/** Opens a workspace, by its place among the tabs. */
export function open(space: number): void {
  if (space === frame.open || !made[space]) return
  frame.open = space
  show()
  lay()
  tell()
  save()
}

/** Opens a workspace that has this panel: the open one if it has it, else the first that does. */
export function reach(panel: string): void {
  if (made[frame.open] && has(made[frame.open]!.dock, panel)) return
  const i = made.findIndex((m) => has(m.dock, panel))
  if (i >= 0) open(i)
}

/** Edit layout on or off: the open workspace unlocked (all of them, as they are opened), or locked again. */
export function edit(on: boolean): void {
  if (on === frame.editing || !made.length) return
  frame.editing = on
  made.forEach((m) => dress(m.dock))
  lay()
  made.forEach((_, i) => hold(i))
  tell()
}

/** A panel the open workspace has not, on the right of it all, a third as wide; a block of Now under the column. */
export function add(id: string): void {
  const dock = made[frame.open]?.dock
  if (!dock || !TITLES[id] || has(dock, id)) return
  if ((PARTS as readonly string[]).includes(id) && has(dock, 'now')) dock.addPanel({ id, component: id, title: TITLES[id]!(), position: { referencePanel: 'now', direction: 'below' } })
  else dock.addPanel({ id, component: id, title: TITLES[id]!(), position: { direction: 'right' }, initialWidth: Math.round(dock.width / 3) })
  dress(dock)
  lay()
  tell()
}

// A workspace laid out again as it is by default, the map on the side chosen and Now as wide as it starts.
function again(i: number): void {
  const m = made[i]!
  m.dock.clear()
  m.width = lay0(m.dock, frame.spaces[i]!.id, layout.mapRight, PANEL.start)
  dress(m.dock)
}

/** The open workspace as it is by default. */
export function reset(): void {
  if (!made[frame.open]) return
  again(frame.open)
  lay()
  hold(frame.open)
  tell()
}

/** The workspaces there are at first, each as it is by default, without the player's names; the Map one open. */
export function restore(): void {
  if (!made.length) return
  while (made.length) unmake(made.length - 1)
  frame.spaces = DEFAULTS.map((id) => ({ id }))
  frame.open = 0
  for (const space of frame.spaces) make(space, undefined, layout.mapRight, PANEL.start)
  show()
  lay()
  made.forEach((_, i) => hold(i))
  tell()
  save()
}

/** A new workspace at the end, the map alone in it, opened; gives its id. None past MOST. */
export function create(): string | undefined {
  if (!made.length || made.length >= MOST) return undefined
  let id: string
  do id = `s${Math.random().toString(36).slice(2, 8)}`
  while (frame.spaces.some((s) => s.id === id))
  frame.spaces.push({ id })
  make(frame.spaces.at(-1)!)
  frame.open = made.length - 1
  show()
  lay()
  tell()
  save()
  return id
}

/** The player's name for a workspace; none, or its default name, gives it back its default name, translated. */
export function rename(i: number, name: string): void {
  const space = frame.spaces[i]
  if (!space) return
  const written = name.trim().slice(0, NAME_MOST)
  if (!written || written === nameFirst(space.id)) delete space.name
  else space.name = written
  save()
}

/** A workspace moved to another place among the tabs; the one open stays open. */
export function move(from: number, to: number): void {
  if (from === to || !made[from] || to < 0 || to >= made.length) return
  const open = frame.spaces[frame.open]!.id
  made.splice(to, 0, made.splice(from, 1)[0]!)
  frame.spaces.splice(to, 0, frame.spaces.splice(from, 1)[0]!)
  frame.open = frame.spaces.findIndex((s) => s.id === open)
  show()
  save()
}

/** A workspace deleted, never the last one: its panels stay in the others. Deleting the open one opens the one on its
 * left, or the next one if it was the first. */
export function remove(i: number): void {
  if (made.length < 2 || !made[i]) return
  unmake(i)
  frame.spaces.splice(i, 1)
  if (i < frame.open || (i === frame.open && i > 0)) frame.open--
  show()
  lay()
  tell()
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
  for (const { dock } of made) {
    const map = groupOf(dock, 'map'), now = groupOf(dock, 'now')
    if (!map || !now || !paired(dock)) continue
    const hidden = !dock.isVisible(now)
    if (hidden) dock.setVisible(now, true)
    now.api.moveTo({ group: map, position: right ? 'left' : 'right' })
  }
  layout.mapRight = right
  made.forEach((m) => dress(m.dock))
  lay()
  made.forEach((_, i) => hold(i))
}

/** The frame taken down (the first run shown again): what was waiting to be kept is kept, and the next mount starts afresh. */
export function unmount(): void {
  if (saving) (clearTimeout(saving), write())
  removeEventListener('resize', fit)
  for (const m of made) (m.seen.disconnect(), m.dock.dispose())
  made.length = 0
  hosts.clear()
  frame.editing = false
  stash = root = undefined
}
