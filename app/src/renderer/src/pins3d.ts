// What the 2D map lays on the ground, on the 3D view too (M16-F7). The 2D map stays under the view
// with all of it, and this follows it at every frame: the pins drawn as elements are copied as
// they are, and a click on a copy is a click on the pin; the character's arrow is a body in the
// scene (arrow3d.ts), told here where it is; the pins painted on the map's
// canvas, its lines and its rings are painted again on a canvas over the view. Each point is put on
// the ground under it. Past the fog nothing shows; behind a hill, a little.
import L from 'leaflet'
import { YARDS_PER_UNIT } from '../../shared/inside'
import type { Arrow3d } from './arrow3d'
import type { Terrain } from './terrain3d'

type Spot = { x: number; y: number; shows: number; away: number }
type Painted = L.CircleMarkerOptions & { lozenge?: boolean; picture?: HTMLImageElement }

// A picture made smaller once, to the pixels it is drawn at: a thousand of them made smaller at
// every frame, as the 3D view draws, took most of its time.
const smaller = new WeakMap<HTMLImageElement, Map<number, HTMLCanvasElement>>()
function atSize(picture: HTMLImageElement, pixels: number): HTMLCanvasElement {
  let sizes = smaller.get(picture)
  if (!sizes) smaller.set(picture, (sizes = new Map()))
  let made = sizes.get(pixels)
  if (!made) {
    made = Object.assign(document.createElement('canvas'), { width: pixels, height: pixels })
    const g = made.getContext('2d')!
    g.imageSmoothingQuality = 'high'
    g.drawImage(picture, 0, 0, pixels, pixels)
    sizes.set(pixels, made)
  }
  return made
}

/** A pin of a service, of ore or of herbs: the game's own picture, or our shape where the game gave none (marks.ts). For the 2D map and the 3D view alike. */
export function paintFixed(ctx: CanvasRenderingContext2D, x: number, y: number, o: { lozenge: boolean; fillColor?: string; picture: HTMLImageElement }, scale = ctx.getTransform().a): void {
  if (o.picture.naturalWidth) {
    const size = o.lozenge ? 20 : 24
    return void ctx.drawImage(atSize(o.picture, Math.round(size * scale)), x - size / 2, y - size / 2, size, size)
  }
  ctx.beginPath()
  if (o.lozenge) {
    ctx.moveTo(x, y - 5.1)
    ctx.lineTo(x + 5.1, y)
    ctx.lineTo(x, y + 5.1)
    ctx.lineTo(x - 5.1, y)
    ctx.closePath()
  } else ctx.rect(x - 6.25, y - 6.25, 12.5, 12.5)
  ctx.fillStyle = o.fillColor ?? '#fff'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#000'
  ctx.stroke()
}

/** Points of a line on the ground a screen apart, at most: it rises and falls with the land between its corners. */
const POINTS_A_VIEW = 300
/** Away from the camera, yards between two points of a line: its distance over this. */
const FARTHER = 100
/**
 * The pins of a place fade out from this many times as far from the camera as the point looked at,
 * and are gone at twice that: from far away the 2D map does not show them either. Not the arrow,
 * the route, rings and lines.
 */
const CROWD = 1.5
const thinned = (s: Spot): number => s.shows * Math.max(0, Math.min(1, 2 - s.away / CROWD))

export class Pins3d {
  private canvas = document.createElement('canvas')
  private copies = new Map<L.Marker, { from: HTMLElement; copy: HTMLElement }>()
  private painted: { layer: L.CircleMarker; x: number; y: number; r: number }[] = []
  private lines = new Map<string, Spot[]>() // the points of the lines of this frame
  private down: { x: number; y: number } | null = null

  /** host: the layer over the view the copies go in; events: what the clicks on the view reach. heading: where the arrow points, in degrees clockwise from north. floor: the height the character stands at, where the walking grid tells it. */
  constructor(
    private map: L.Map,
    private terrain: Terrain,
    private host: HTMLElement,
    events: HTMLElement,
    private arrow: L.Marker,
    private heading: () => number,
    private body: Arrow3d,
    private floor: () => number | null,
  ) {
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    host.append(this.canvas)
    // A click, not the end of a drag, on a painted pin is a click on it; on the bare ground, a click
    // on the 2D map at that point, which puts the label there.
    events.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY }))
    events.addEventListener('click', (e) => {
      if (!this.down || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 4) return
      const box = host.getBoundingClientRect(),
        x = e.clientX - box.left,
        y = e.clientY - box.top,
        pin = this.hit(x, y)
      if (pin) return void pin.fire('click')
      const at = this.terrain.pick(x, y)
      if (at) this.map.fire('click', { latlng: L.latLng(-at.z / YARDS_PER_UNIT, at.x / YARDS_PER_UNIT), containerPoint: L.point(x, y) })
    })
  }

  /** Where a point of the map is on the view. */
  spot(p: L.LatLng): L.Point {
    const s = this.onGround(p)
    return L.point(s.x, s.y)
  }

  /** The painted pin under a point of the view, the one on top; null where there is none. */
  hit(x: number, y: number): L.CircleMarker | null {
    for (let i = this.painted.length - 1; i >= 0; i--) {
      const p = this.painted[i]!
      if (Math.hypot(p.x - x, p.y - y) <= p.r) return p.layer
    }
    return null
  }

  draw(): void {
    const { width: w, height: h } = this.terrain.size,
      ratio = devicePixelRatio
    if (this.canvas.width !== Math.round(w * ratio) || this.canvas.height !== Math.round(h * ratio)) {
      this.canvas.width = Math.round(w * ratio)
      this.canvas.height = Math.round(h * ratio)
    }
    const ctx = this.canvas.getContext('2d')!
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, w, h)
    this.painted = []
    const lines: L.Polyline[] = [],
      marks: L.CircleMarker[] = [],
      seen = new Set<L.Marker>()
    let me = false
    this.map.eachLayer((layer) => {
      if (layer === this.arrow) {
        // The arrow: not a copy, the body in the scene.
        const ll = this.arrow.getLatLng()
        this.body.set(ll.lng * YARDS_PER_UNIT, -ll.lat * YARDS_PER_UNIT, this.heading(), this.arrow.options.opacity ?? 1, this.floor())
        me = true
      } else if (layer instanceof L.Marker) this.copy(layer, seen)
      else if (layer instanceof L.CircleMarker) marks.push(layer)
      else if (layer instanceof L.Polyline) lines.push(layer)
    })
    if (!me) this.body.hide()
    const step = this.terrain.looking().seen / POINTS_A_VIEW
    this.lines.clear()
    for (const line of lines) this.paintLine(ctx, line, step)
    for (const mark of marks) this.paintMark(ctx, mark, w, h, ratio)
    ctx.globalAlpha = 1
    for (const [marker, c] of this.copies) {
      if (seen.has(marker)) continue
      c.copy.remove()
      this.copies.delete(marker)
    }
  }

  /** Nothing over the view: it is off. */
  clear(): void {
    for (const c of this.copies.values()) c.copy.remove()
    this.copies.clear()
    this.body.hide()
    this.painted = []
    this.canvas.getContext('2d')!.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  // A pin drawn as an element: a copy of it, on the ground under it. The names of places are not pins.
  private copy(marker: L.Marker, seen: Set<L.Marker>): void {
    const from = marker.getElement()
    if (!from || from.classList.contains('place')) return
    let c = this.copies.get(marker)
    if (c?.from !== from) {
      c?.copy.remove()
      const copy = from.cloneNode(true) as HTMLElement
      copy.addEventListener('click', (e) => {
        e.stopPropagation()
        marker.fire('click')
      })
      this.host.append(copy)
      this.copies.set(marker, (c = { from, copy }))
    }
    seen.add(marker)
    const ll = marker.getLatLng(),
      x = ll.lng * YARDS_PER_UNIT,
      z = -ll.lat * YARDS_PER_UNIT,
      s = this.terrain.spot(x, z),
      shows = from.classList.contains('door') ? thinned(s) : s.shows,
      style = c.copy.style
    style.visibility = shows > 0 ? '' : 'hidden'
    if (!shows) return
    style.transform = `translate3d(${s.x}px,${s.y}px,0)`
    style.zIndex = String(Math.round(s.y) + (marker.options.zIndexOffset ?? 0))
    style.opacity = String(Number(from.style.opacity || 1) * shows)
  }

  // A line on the ground, as the map draws it: a point every step yards, faded where it is.
  private paintLine(ctx: CanvasRenderingContext2D, line: L.Polyline, step: number): void {
    const o = line.options,
      all = line.getLatLngs() as L.LatLng[] | L.LatLng[][]
    ctx.lineWidth = o.weight ?? 3
    ctx.strokeStyle = o.color ?? '#3388ff'
    ctx.lineCap = (o.lineCap ?? 'round') as CanvasLineCap
    ctx.lineJoin = (o.lineJoin ?? 'round') as CanvasLineJoin
    ctx.setLineDash(typeof o.dashArray === 'string' ? o.dashArray.split(/[ ,]+/).map(Number) : (o.dashArray ?? []))
    for (const run of (L.LineUtil.isFlat(all as L.LatLng[]) ? [all] : all) as L.LatLng[][]) {
      if (run.length < 2) continue
      // A line is drawn twice, a black edge under its colour: its points are found once.
      const key = `${run.length} ${run[0]!.lat} ${run[0]!.lng} ${run.at(-1)!.lat} ${run.at(-1)!.lng}`,
        points = this.lines.get(key) ?? this.along(run, step)
      this.lines.set(key, points)
      // Stretches as faded as each other in one stroke, the dashes going on from one to the next.
      const faded = (i: number): number => Math.round(Math.min(points[i - 1]!.shows, points[i]!.shows) * 20) / 20 || 0
      let along = 0
      for (let i = 1; i < points.length; ) {
        const shows = faded(i)
        ctx.beginPath()
        ctx.moveTo(points[i - 1]!.x, points[i - 1]!.y)
        ctx.lineDashOffset = -along
        for (; i < points.length && faded(i) === shows; i++) {
          ctx.lineTo(points[i]!.x, points[i]!.y)
          along += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
        }
        if (!shows) continue
        ctx.globalAlpha = (o.opacity ?? 1) * shows
        ctx.stroke()
      }
    }
  }

  // The points of a line on the ground: step yards apart near the camera, farther apart away from
  // it (about as far apart on screen), and as few as can be past the fog.
  private along(run: L.LatLng[], step: number): Spot[] {
    const c = this.terrain.camera.position,
      reach = this.terrain.reach,
      points = [this.onGround(run[0]!)]
    for (let i = 1; i < run.length; i++) {
      const ax = run[i - 1]!.lng * YARDS_PER_UNIT,
        az = -run[i - 1]!.lat * YARDS_PER_UNIT,
        dx = run[i]!.lng * YARDS_PER_UNIT - ax,
        dz = -run[i]!.lat * YARDS_PER_UNIT - az,
        length = Math.hypot(dx, dz)
      for (let d = 0; ; ) {
        const far = Math.hypot(ax + (dx * d) / length - c.x, az + (dz * d) / length - c.z)
        d += Math.max(step, far / FARTHER, far - reach)
        if (!(d < length)) break // a number gone wrong too: never a loop without end
        points.push(this.terrain.spot(ax + (dx * d) / length, az + (dz * d) / length))
      }
      points.push(this.onGround(run[i]!))
    }
    return points
  }

  // A ring, a disc, or a pin of the services, ore and herbs.
  private paintMark(ctx: CanvasRenderingContext2D, mark: L.CircleMarker, w: number, h: number, ratio: number): void {
    const o = mark.options as Painted,
      s = this.onGround(mark.getLatLng()),
      shows = o.picture ? thinned(s) : s.shows
    if (!shows || s.x < -30 || s.y < -30 || s.x > w + 30 || s.y > h + 30) return
    ctx.globalAlpha = shows
    if (o.picture) {
      paintFixed(ctx, s.x, s.y, { lozenge: o.lozenge === true, fillColor: o.fillColor, picture: o.picture }, ratio)
      this.painted.push({ layer: mark, x: s.x, y: s.y, r: 10 })
      return
    }
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(s.x, s.y, mark.getRadius(), 0, Math.PI * 2)
    if (o.fill !== false) {
      ctx.globalAlpha = s.shows * (o.fillOpacity ?? 0.2)
      ctx.fillStyle = o.fillColor ?? o.color ?? '#3388ff'
      ctx.fill()
    }
    if (o.stroke !== false) {
      ctx.globalAlpha = s.shows * (o.opacity ?? 1)
      ctx.lineWidth = o.weight ?? 3
      ctx.strokeStyle = o.color ?? '#3388ff'
      ctx.stroke()
    }
    if (o.interactive !== false) this.painted.push({ layer: mark, x: s.x, y: s.y, r: mark.getRadius() + 3 })
  }

  private onGround(p: L.LatLng): Spot {
    return this.terrain.spot(p.lng * YARDS_PER_UNIT, -p.lat * YARDS_PER_UNIT)
  }
}
