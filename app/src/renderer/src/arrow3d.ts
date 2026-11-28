// The character's arrow on the 3D view: a body in the scene, not a drawing over it (M16-F7). Its
// shape and every number here were chosen by the user on the prototype design/terrain3d/arrow.html
// and are written in design/ui.md, section 4: the outline of the 2D arrow as a soft gem, gold over
// and dark under, its true size but never too small to see, laid on the slope of the ground, with
// a soft shadow where it touches, its outline through a hill that hides it, and a stem from afar.
// Its colour and its size are the player's to choose, the same as the 2D arrow's (M21-F1, arrow.svelte.ts).
import * as THREE from 'three'
import { arrow } from './arrow.svelte'
import type { Terrain } from './terrain3d'
import { turnAt, type Turn } from '../../shared/glide'

const LENGTH = 8 // yards from tip to tail, at the size first drawn
const LEAST = 30 // pixels on the screen it never goes under, at that size
const HEIGHT = 0.16 * 1.6 // of its length: the "thickness" of the prototype
const LIFT = 0.175 // of its length, off the ground
const BAND = 0.02 // half the band round its edge
const FLAT = 0.1 // the flat on its top, of its outline
const TIP = 0.55 // how round the tip is, of the other corners
const EASE = 0.25 // seconds the slope takes to follow the ground
const SHADOW = 0.5
const GHOST = 0.4 // its outline through a hill
const FLOOR = 3 // yards over the ground from which the character is on a floor, not on the ground (a bridge)

// The body: rings of the outline, each [how wide, how high], the tip to -z (north) and a length of 1.
function body(): THREE.BufferGeometry {
  const corners = [[0, -0.55, 0.16 * TIP], [0.4, 0.45, 0.2], [0, 0.2, 0.12], [-0.4, 0.45, 0.2]] as const
  const n = 7,
    outline: [number, number][] = []
  corners.forEach((p, i) => {
    // A corner made round: from a little before it to a little after, bent towards it.
    const a = corners[(i + 3) % 4]!,
      b = corners[(i + 1) % 4]!
    const toA = Math.hypot(a[0] - p[0], a[1] - p[1]),
      toB = Math.hypot(b[0] - p[0], b[1] - p[1]),
      ra = Math.min(p[2], toA / 2) / toA,
      rb = Math.min(p[2], toB / 2) / toB
    const from = [p[0] + (a[0] - p[0]) * ra, p[1] + (a[1] - p[1]) * ra] as const,
      to = [p[0] + (b[0] - p[0]) * rb, p[1] + (b[1] - p[1]) * rb] as const
    for (let k = 0; k <= n; k++) {
      const t = k / n,
        u = 1 - t
      outline.push([u * u * from[0] + 2 * u * t * p[0] + t * t * to[0], u * u * from[1] + 2 * u * t * p[1] + t * t * to[1]])
    }
  })
  const girdle = HEIGHT * 0.4,
    top = HEIGHT * 1.2,
    m = outline.length,
    middle = 0.02
  // Each part has its own points, so the light breaks at the band and at the flats and nowhere else.
  const parts: { dark?: boolean; rings: [number, number][] }[] = [
    { dark: true, rings: [[0.12, 0], [0.22, 0.03 * girdle], [0.93, girdle - BAND - 0.25 * (girdle - BAND)], [1, girdle - BAND]] },
    { rings: [[1, girdle - BAND], [1, girdle + BAND]] },
    { rings: [[1, girdle + BAND], [0.93, girdle + BAND + 0.25 * (top - girdle - BAND)], [FLAT + 0.12, top - 0.06 * (top - girdle)], [FLAT, top]] },
  ]
  const pos: number[] = [],
    index: [number[], number[]] = [[], []]
  const ring = ([wide, high]: [number, number]): number => {
    const first = pos.length / 3
    for (const [x, z] of outline) pos.push(x * wide, high, (z - middle) * wide + middle)
    return first
  }
  for (const part of parts) {
    const firsts = part.rings.map(ring),
      into = index[part.dark ? 1 : 0]
    for (let j = 0; j + 1 < firsts.length; j++) {
      for (let k = 0; k < m; k++) {
        const a = firsts[j]! + k,
          b = firsts[j]! + ((k + 1) % m),
          c = firsts[j + 1]! + k,
          d = firsts[j + 1]! + ((k + 1) % m)
        into.push(a, c, b, b, c, d)
      }
    }
  }
  // The flats: under the keel and on the top.
  for (const [wide, high, dark] of [[0.12, 0, true], [FLAT, top, false]] as const) {
    const first = ring([wide, high]),
      centre = pos.length / 3
    pos.push(0, high, middle)
    for (let k = 0; k < m; k++) index[dark ? 1 : 0].push(centre, ...(dark ? [first + k, first + ((k + 1) % m)] : [first + ((k + 1) % m), first + k]))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex([...index[0], ...index[1]])
  geo.addGroup(0, index[0].length, 0)
  geo.addGroup(index[0].length, index[1].length, 1)
  geo.computeVertexNormals()
  return geo
}

const UP = new THREE.Vector3(0, 1, 0)

export class Arrow3d {
  // Lit by the sun of the view as the ground is, with no colour of its own: each face has its light. Over in the
  // colour chosen, under in a dark of it (look()).
  private gold = new THREE.MeshLambertMaterial({ transparent: true, side: THREE.DoubleSide })
  private dark = new THREE.MeshLambertMaterial({ transparent: true, side: THREE.DoubleSide })
  // Drawn only where something is in front of it: the hill that hides the arrow.
  private ghostly = new THREE.MeshBasicMaterial({ transparent: true, depthFunc: THREE.GreaterDepth, depthWrite: false })
  private colour = ''
  private shadowy: THREE.MeshBasicMaterial
  private group = new THREE.Group()
  private shadow: THREE.Mesh
  private sheet: THREE.BufferAttribute
  private flatSheet: Float32Array
  private stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8 }))
  private want: { x: number; z: number; heading: number; opacity: number; floor: number | null } | null = null
  private up = new THREE.Vector3(0, 1, 0)
  private y: number | null = null
  private last = 0
  private drawn = ''
  // The way it points, turned to a new heading in a quarter of a second at an even pace, as the 2D arrow is
  // (turnAt, glide.ts): the game tells the facing a few times a second, and a jump each time reads as a stutter.
  private turn: Turn = { from: 0, to: 0, at: 0 }
  /** Where the arrow points as drawn, in degrees clockwise from north; null while there is none. */
  pointing: number | null = null

  constructor(private terrain: Terrain) {
    const geo = body(),
      ghost = new THREE.Mesh(geo, this.ghostly)
    ghost.renderOrder = 2
    this.group.add(new THREE.Mesh(geo, [this.gold, this.dark]), ghost)
    // The shadow where it touches: a soft dark spot, a small grid with each point put on the ground
    // at every frame (a flat sheet would go under a bump).
    const spot = Object.assign(document.createElement('canvas'), { width: 128, height: 128 }),
      g = spot.getContext('2d')!,
      fade = g.createRadialGradient(64, 64, 6, 64, 64, 64)
    fade.addColorStop(0, '#000f')
    fade.addColorStop(0.55, '#0008')
    fade.addColorStop(1, '#0000')
    g.fillStyle = fade
    g.fillRect(0, 0, 128, 128)
    this.shadowy = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(spot), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 10, 10).rotateX(-Math.PI / 2), this.shadowy)
    this.sheet = this.shadow.geometry.attributes.position as THREE.BufferAttribute
    this.flatSheet = Float32Array.from(this.sheet.array)
    for (const o of [this.group, this.shadow, this.stem]) {
      o.frustumCulled = false
      o.visible = false
      terrain.add(o)
    }
    this.group.children.forEach((c) => (c.frustumCulled = false))
  }

  /**
   * Where the arrow is, in yards, and where it points, in degrees clockwise from north. opacity:
   * as the 2D arrow's (less under a bridge). floor: the height the character stands at where the
   * walking grid tells it, null where it does not.
   */
  set(x: number, z: number, heading: number, opacity: number, floor: number | null): void {
    this.want = { x, z, heading, opacity, floor }
  }

  /** No arrow: the character is not on this map. */
  /** Where the arrow is on the view, in pixels, and how far round it reaches: told when it changes, null when there is none. For what is drawn over the view to leave it in front. */
  onscreen: ((at: { x: number; y: number; r: number } | null) => void) | null = null

  /** Where the arrow stands, in yards, while there is one. */
  at(): THREE.Vector3 | null {
    return this.want && this.y !== null ? new THREE.Vector3(this.want.x, this.y, this.want.z) : null
  }

  hide(): void {
    this.onscreen?.(null)
    this.want = null
  }

  /** Before a frame is drawn: puts the arrow where it is wanted. True when it is not as it was last drawn. */
  step(now: number): boolean {
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000))
    this.last = now
    // In a dungeon that is all buildings there is no ground: the floor of the building the character stands on (M23-F24).
    const w = this.want,
      inside = w && this.terrain.bare ? this.terrain.floorIn(w.x, w.z) : undefined,
      ground = !w ? NaN : this.terrain.bare ? (inside ?? NaN) : this.terrain.groundAt(w.x, w.z)
    if (!w || !Number.isFinite(ground)) {
      this.y = this.pointing = null
      return this.show(false, '')
    }
    if (this.pointing === null) this.turn = { from: w.heading, to: w.heading, at: now }
    else if (w.heading !== this.turn.to) this.turn = { from: this.pointing, to: w.heading, at: now }
    this.pointing = turnAt(this.turn, now)
    // On a floor over the ground (a bridge): at its height and level. Else on the ground, as it slopes.
    // In a room under the ground, as it opens: down on its floor, level, and drawn with the rooms, before the ground.
    // In a city whose streets are its building's, on the street when the floor the character stands on is not known,
    // or is told as the ground of the game, which there lies under the streets and no one stands on.
    const street = this.terrain.streetAt(w.x, w.z),
      floor = inside !== undefined ? inside : street !== null && (w.floor === null || Math.abs(w.floor - ground) <= FLOOR) ? street : w.floor,
      lifted = inside !== undefined || (floor !== null && floor > ground + FLOOR),
      room = !lifted && floor !== null && floor < ground - FLOOR ? this.terrain.floorAt(w.x, w.z) : null,
      y = lifted ? floor! : room ? ground + (floor! - ground) * room.open : ground,
      paved = lifted && (street !== null || inside !== undefined) // its shadow on the street or on the floor, not on the ground under it
    for (const o of [this.group, this.shadow, this.stem]) this.terrain.sink(o, !!room && room.open > 0.5)
    this.look(arrow.colour)
    const camera = this.terrain.camera,
      distance = camera.position.distanceTo(new THREE.Vector3(w.x, y, w.z)),
      least = (LEAST * arrow.size * 2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / this.terrain.size.height,
      size = Math.max(LENGTH * arrow.size, least)
    // The slope: the plane through the ground as far round as the arrow is long.
    const reach = Math.max(2, size / 2),
      at = (dx: number, dz: number): number => {
        const g = this.terrain.groundAt(w.x + dx, w.z + dz)
        return Number.isFinite(g) ? g : ground
      }
    const slope = lifted || room ? UP : new THREE.Vector3(-(at(reach, 0) - at(-reach, 0)) / (2 * reach), 1, -(at(0, reach) - at(0, -reach)) / (2 * reach)).normalize()
    const k = this.y === null ? 1 : 1 - Math.exp(-dt / EASE)
    this.up.lerp(slope, k).normalize()
    this.y = this.y === null ? y : this.y + (y - this.y) * (1 - Math.exp(-dt / (EASE / 2)))
    // Laid on that plane, the tip the way the character faces.
    const a = (this.pointing * Math.PI) / 180,
      facing = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)),
      back = facing.clone().multiplyScalar(-1).addScaledVector(this.up, facing.dot(this.up)).normalize(),
      side = new THREE.Vector3().crossVectors(this.up, back).normalize()
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, this.up, back))
    this.group.position.set(w.x, this.y, w.z).addScaledVector(this.up, LIFT * size)
    this.group.scale.setScalar(size)
    const seen = this.group.position.clone().project(camera), { width, height } = this.terrain.size
    this.onscreen?.({ x: ((seen.x + 1) / 2) * width, y: ((1 - seen.y) / 2) * height, r: (LEAST * arrow.size * size) / least / 2 })
    this.gold.opacity = this.dark.opacity = w.opacity
    this.ghostly.opacity = GHOST * w.opacity
    this.shadowy.opacity = SHADOW * w.opacity * (lifted && !paved ? 0.6 : 1)
    for (let i = 0; i < this.sheet.count; i++) {
      const dx = this.flatSheet[i * 3]! * size * 1.5,
        dz = this.flatSheet[i * 3 + 2]! * size * 1.5
      this.sheet.setXYZ(i, w.x + dx, room || paved ? this.y + 0.05 : at(dx, dz) + 0.05 + (lifted ? 0 : this.y - ground), w.z + dz)
    }
    this.sheet.needsUpdate = true
    // From afar, kept at its least size: a stem over it, to find it by.
    this.stem.visible = least > LENGTH * arrow.size
    this.stem.position.copy(this.group.position)
    this.stem.scale.set(size, size * 3, size)
    const p = this.group.position,
      q = this.group.quaternion
    return this.show(true, [p.x, p.y, p.z, q.x, q.y, q.z, size, w.opacity].map((v) => v.toFixed(3)).join() + this.colour)
  }

  // The colour chosen, on every part of it: the dark under it a sixth of it, as the gold's was (0x2a1c05).
  private look(colour: string): void {
    if (colour === this.colour) return
    this.colour = colour
    const c = new THREE.Color(colour)
    for (const m of [this.gold, this.ghostly, this.stem.material as THREE.MeshBasicMaterial]) m.color.copy(c)
    this.dark.color.copy(c).multiplyScalar(0.16)
    this.dark.emissive.copy(c).multiplyScalar(0.07)
  }

  private show(on: boolean, as: string): boolean {
    this.group.visible = this.shadow.visible = on
    if (!on) this.stem.visible = false
    const changed = as !== this.drawn
    this.drawn = as
    return changed
  }
}
