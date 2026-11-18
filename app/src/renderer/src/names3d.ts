// The names of the places on the 3D view (M16-F7): written over it as on the 2D map, upright and
// read from any side, each held to its point of the ground. Smaller and fainter the farther it is,
// faint behind a hill, gone in the fog, and lifted off its point so the name of a town does not
// end up in the mountain behind it. Which kinds show goes by how far they are from the camera, not
// by a zoom: a tilted view holds near things and far ones at once. Every number here was chosen by
// the user on the prototype design/terrain3d/names.html and is written in design/ui.md, section 4.
import { fitNames, tierRank, type Avoid, type NameBox, type NameTier } from '../../shared/places'
import type { Terrain } from './terrain3d'

/** Yards a name is lifted off its point. */
const LIFT: Record<NameTier, number> = { region: 400, town: 120, poi: 60, area: 60 }
/** Yards from the camera: the regions are written from this far on, the others up to theirs. */
const REGIONS_FROM = 2000
const WITHIN: Record<Exclude<NameTier, 'region'>, number> = { town: 7400, poi: 3700, area: 2600 }
const SHRINK = 0.5 // a name twice as far as the point looked at is this power of half as large
const LEAST = 0.65 // and never under this
const DIM = 0.5 // how much fainter the farthest are
const DIM_OVER = 1.5 // times the distance of the point looked at, past it, over which they fade so
const GAP = 6 // px between two names
const EDGE = 14 // px a name keeps from the edge of the view, as on the 2D map

export interface Name3d {
  tier: NameTier
  text: string
  /** In yards, as the view counts them. */
  x: number
  z: number
}

export class Names3d {
  private names: (Name3d & { el: HTMLElement; width: number; height: number; put: string; faded: string })[] = []

  constructor(
    private terrain: Terrain,
    private host: HTMLElement,
  ) {}

  /** The names of the continent on show. */
  set(list: Name3d[]): void {
    for (const n of this.names) n.el.remove()
    // The most important first: where two would touch, the first written stays.
    this.names = [...list]
      .sort((a, b) => tierRank(a.tier) - tierRank(b.tier))
      .map((n) => {
        // The same element the 2D map makes, so its styles are these names' too.
        const el = Object.assign(document.createElement('div'), { className: `place ${n.tier}` })
        el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:100000'
        el.append(Object.assign(document.createElement('span'), { textContent: n.text }))
        this.host.append(el)
        return { ...n, el, width: 0, height: 0, put: '', faded: '' }
      })
  }

  /** At every frame. avoid: what a name keeps clear of (the arrow, the buttons); null: no names, their layer is off. */
  draw(avoid: Avoid[] | null): void {
    if (!avoid) return this.clear()
    const { width: w, height: h } = this.terrain.size,
      looked = this.terrain.looked,
      boxes: NameBox[] = []
    const as = new Map<number, { put: string; faded: string }>()
    this.names.forEach((n, id) => {
      const s = this.terrain.spot(n.x, n.z, LIFT[n.tier], true),
        far = s.away * looked
      if (!s.shows || (n.tier === 'region' ? far < REGIONS_FROM : far > WITHIN[n.tier])) return
      // Measured once, the first time it could show: not drawn yet, the next time.
      if (!n.width) {
        const span = n.el.firstElementChild as HTMLElement
        n.width = span.offsetWidth
        n.height = span.offsetHeight
        if (!n.width) return
      }
      const past = Math.max(1, s.away),
        scale = Math.max(LEAST, past ** -SHRINK),
        width = n.width * scale,
        height = n.height * scale
      // Whole inside the view, or not at all.
      if (s.x - width / 2 < EDGE || s.x + width / 2 > w - EDGE || s.y - height / 2 < EDGE || s.y + height / 2 > h - EDGE) return
      boxes.push({ id, x: s.x, y: s.y, width, height })
      as.set(id, {
        put: `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0) scale(${scale.toFixed(3)})`,
        faded: (s.shows * (1 - DIM * Math.min(1, (past - 1) / DIM_OVER))).toFixed(2),
      })
    })
    const shown = fitNames(boxes, avoid, GAP)
    this.names.forEach((n, id) => {
      const on = shown.has(id),
        to = as.get(id)
      n.el.classList.toggle('on', on)
      // One that goes off fades where it was. The page is written to only when something changed.
      if (!on || !to) return
      if (to.put !== n.put) n.el.style.transform = n.put = to.put
      if (to.faded !== n.faded) n.el.style.opacity = n.faded = to.faded
    })
  }

  /** No name on the view. */
  clear(): void {
    for (const n of this.names) n.el.classList.remove('on')
  }
}
