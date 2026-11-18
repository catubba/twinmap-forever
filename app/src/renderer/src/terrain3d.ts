// The 3D view of a continent (M16-F6; how it looks and is driven: design/ui.md, section 4). The
// ground is a tree of tiles as the map's own: each node is a tile with a grid of 65 x 65 heights
// (shared/levels.ts) and the map's picture of the same tile laid over it. Near the camera a node
// gives way to its four children, down to a quarter of a block, where the grid has the game's own
// detail (4.17 yards); far away a node covers up to 16 x 16 blocks. A node is drawn until all its
// children are in, so the ground is never missing while it sharpens. The edges of nodes of
// different detail are hidden by skirts, strips that hang down from every edge.
//
// Coordinates: yards from the north-west corner of the world's grid of 64 x 64 blocks, x to the
// east, z to the south (Yards u and v in shared/inside.ts), y up.
import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { BLOCK_ZOOM, HOLE, unpackLevels, type Levels } from '../../shared/levels'
import { pictureOfBlock } from '../../shared/pixels'
import { DRY, TAR } from '../../shared/water'
import { BLOCK_YARDS } from '../../shared/world'
import { TILES } from './web'

/** Yards a side of the world's grid. */
const WORLD = 64 * BLOCK_YARDS
/** The finest node: a quarter of a block. */
const FINEST = BLOCK_ZOOM + 1
/** The nodes the tree starts from: 16 x 16 blocks each. */
const ROOT = 2
/** Vertices a side of every node. */
const N = 65
/** Vertical field of view, in degrees. */
export const FOV = 45
/** How far the view tilts from straight down. */
export const MAX_TILT = (70 * Math.PI) / 180
/** A node splits when a pixel of its picture (a square of its grid, a quarter of it at a block) would be wider than this many pixels on screen. */
const SHARPNESS = 1.5
/** Nodes and pictures kept on the graphics card beyond the ones on show. */
const KEPT = 200
const LOADING = 6
const SKY = 0x7f97ab
/** The open sea, where the world has no blocks: as the ocean looks over its bed. */
const SEA = 0x1f4b6e
/** Water over its bed, as ui.md has it: this colour at half see-through where it is shallow, turning to the open sea where it is deep. */
const WATER_COLOUR = 0x2b5f86
const SHALLOW = 2
const DEEP = 30
/** How much shows of what lies behind a hill (pins3d.ts). */
const HIDDEN = 0.35
/** Steps from the camera to a point, to see whether a hill lies between. */
const LOOKS = 8
/**
 * Milliseconds at least between two frames of the view: about 60 a second, 72 on a screen of 144.
 * The graphics card is shared with the game, which then lost frames to a view drawn 144 times a second.
 */
const FRAME_MS = 1000 / 60 - 4
/** Pixels past the edge of the view where what lies on the ground still counts as on it. */
const OFF = 60

/** A node's key: a number, as groundAt asks for thousands a frame (no node is wider than 2 ** 8 a side). */
const keyOf = (z: number, x: number, y: number): number => (z << 16) | (y << 8) | x

interface Grid {
  heights: Float32Array // N x N
  water: Float32Array // N x N
  kinds: Uint8Array // (N - 1) x (N - 1)
}

interface Node {
  z: number
  x: number
  y: number
  state: 'new' | 'loading' | 'ready' | 'empty'
  grid?: Grid
  box?: THREE.Box3
  group?: THREE.Group
  picture?: string // the key of its picture in pictures
  used: number
}

// A file of the map as the converter keeps it, deflated; null where there is none.
const inflated = (url: string): Promise<Uint8Array<ArrayBuffer> | null> =>
  fetch(url)
    .then(async (answer) => (answer.ok && answer.body && answer.status !== 204 ? new Uint8Array(await new Response(answer.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()) : null))
    .catch(() => null)

/** The grid of a node from its tile's levels: as it is below a block, every other vertex at a block, a quarter of it below. */
function gridOf(l: Levels, z: number, x: number, y: number): Grid {
  if (l.side === N) return { heights: l.heights, water: l.water, kinds: l.kinds }
  const step = z === BLOCK_ZOOM ? 2 : 1,
    r0 = z === BLOCK_ZOOM ? 0 : (y & 1) * 64,
    c0 = z === BLOCK_ZOOM ? 0 : (x & 1) * 64
  const g: Grid = {
    heights: new Float32Array(N * N),
    water: new Float32Array(N * N),
    kinds: new Uint8Array((N - 1) * (N - 1)),
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const from = (r0 + i * step) * l.side + c0 + j * step
      g.heights[i * N + j] = l.heights[from]!
      g.water[i * N + j] = l.water[from]!
      if (i === N - 1 || j === N - 1) continue
      // A square's liquid is its first square's; a hole only where every square under it is one.
      const under = (di: number, dj: number): number => l.kinds[(r0 + i * step + di) * (l.side - 1) + c0 + j * step + dj]!
      let hole = HOLE
      for (let di = 0; di < step; di++) for (let dj = 0; dj < step; dj++) hole &= under(di, dj)
      g.kinds[i * (N - 1) + j] = (under(0, 0) & ~HOLE) | hole
    }
  }
  return g
}

export interface Look {
  /** The point looked at, in yards. */
  x: number
  z: number
  /** Yards of ground from the top of the view to its foot, as it would be straight down: what the 2D map's zoom tells. */
  seen: number
  /** From straight down, in radians. */
  polar: number
  /** 0 with north up, as OrbitControls counts it. */
  azimuth: number
}

export class Terrain {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 1, 100000)
  private controls: MapControls
  private nodes = new Map<number, Node>() // by keyOf
  private pictures = new Map<
    string,
    {
      texture: Promise<THREE.Texture | null>
      used: number
      made?: THREE.Texture | null
    }
  >()
  private blocks = new Map<string, { levels: Promise<Levels | null>; used: number }>()
  private queue: Node[] = []
  private loading = 0
  private frame = 0
  private dirty = true
  private folder = ''
  private turning: ((now: number) => void) | null = null
  private compass: Compass
  private materials: {
    ground: THREE.MeshLambertMaterial
    liquids: THREE.Material[]
  }
  private observer: ResizeObserver
  private s3tc: boolean
  private width = 1
  private height = 1
  // Where the controls put the camera, while it is lifted over the ground to be drawn (hold): what
  // the player chose stays as it was, and the camera comes back down once the ground lets it.
  private logical = new THREE.Vector3()
  private lifted = false
  private drawnFrom = new THREE.Vector3()
  private get eye(): THREE.Vector3 {
    return this.lifted ? this.logical : this.camera.position
  }

  constructor(
    private host: HTMLElement,
    compassHost: HTMLElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(devicePixelRatio)
    host.append(this.renderer.domElement)
    this.s3tc = this.renderer.extensions.has('WEBGL_compressed_texture_s3tc')
    this.scene.background = new THREE.Color(SKY)
    this.scene.fog = new THREE.Fog(SKY, 1, 2)
    // Half of the light from all round, half from a sun fixed to the north-west, 45 degrees up: level ground as bright as the minimap.
    const sun = new THREE.DirectionalLight(0xffffff, (Math.PI * 0.5) / Math.sin(Math.PI / 4))
    sun.position.set(-Math.SQRT1_2, 1, -Math.SQRT1_2)
    this.scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.5), sun)
    this.materials = {
      ground: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
      // Water, lava, fel, tar: in the order water.ts numbers them, from 1; then the open sea.
      liquids: [
        // Its colour a vertex, by how deep it is (meshes).
        new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x8899aa, shininess: 60, transparent: true, depthWrite: false }),
        new THREE.MeshBasicMaterial({
          color: 0xff5a14,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
        new THREE.MeshBasicMaterial({
          color: 0x59c832,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
        new THREE.MeshLambertMaterial({
          color: 0x15110e,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
        new THREE.MeshBasicMaterial({ color: SEA }),
      ],
    }
    // The open sea goes on past the world's grid, to the fog: four wide strips round it.
    const far = WORLD * 8
    for (const [x, z, w, d] of [
      [-far, -far, WORLD + 2 * far, far],
      [-far, WORLD, WORLD + 2 * far, far],
      [-far, 0, far, WORLD],
      [WORLD, 0, far, WORLD],
    ] as const) {
      this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x + w / 2, 0, z + d / 2), this.materials.liquids[4]))
    }
    this.controls = new MapControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.zoomToCursor = true
    this.controls.minDistance = 30
    this.controls.maxDistance = WORLD / 2
    this.controls.maxPolarAngle = MAX_TILT
    this.controls.addEventListener('change', () => (this.dirty = true))
    // Taken by hand: a drag, not a click (on a pin) nor the wheel, which zooms on the character while it is followed.
    let down: { x: number; y: number } | null = null
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }))
    canvas.addEventListener('pointerup', () => (down = null))
    canvas.addEventListener('pointermove', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 3) return
      down = null
      this.onGrab()
    })
    this.compass = new Compass(compassHost)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
  }

  /** The continent shown, by its folder; the tiles of another one go. */
  show(folder: string): void {
    if (folder === this.folder) return
    this.drop()
    this.folder = folder
    this.dirty = true
  }

  /** Whether the wheel zooms on the point under the pointer, or on the point looked at (a character followed). */
  zoomAtCursor(on: boolean): void {
    this.controls.zoomToCursor = on
  }

  /** Called when the camera is taken by hand. */
  onGrab: () => void = () => {}

  /** Called at every frame while the view runs, once it is drawn: what lies over it follows. */
  onFrame: () => void = () => {}

  /**
   * Where a point of the ground is on the view, in pixels from its top left corner; how much of it
   * shows: 1 in plain sight, less in the fog, HIDDEN behind a hill, 0 behind the camera or past the
   * fog; and how far it is from the camera, in distances of the point looked at.
   */
  spot(x: number, z: number): { x: number; y: number; shows: number; away: number } {
    const fog = this.scene.fog as THREE.Fog,
      out = Math.hypot(x - this.camera.position.x, z - this.camera.position.z) >= fog.far, // past the fog: the ground is not looked for
      ground = out ? NaN : this.groundAt(x, z),
      p = new THREE.Vector3(x, Number.isFinite(ground) ? ground : 0, z),
      far = out ? Infinity : p.distanceTo(this.camera.position)
    const on = p.clone().project(this.camera),
      at = { x: ((on.x + 1) / 2) * this.width, y: ((1 - on.y) / 2) * this.height }
    const away = far / this.eye.distanceTo(this.controls.target)
    if (on.z > 1 || far >= fog.far) return { ...at, shows: 0, away }
    const clear = Math.min(1, (fog.far - far) / (fog.far - fog.near)),
      off = at.x < -OFF || at.y < -OFF || at.x > this.width + OFF || at.y > this.height + OFF // off the view: no hill looked for
    return { ...at, shows: off || !this.behindHill(p) ? clear : clear * HIDDEN, away }
  }

  /** The point of the ground under a pixel of the view, in yards; null where the ray meets none before the fog. The sea is at 0. */
  pick(px: number, py: number): { x: number; z: number } | null {
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2((px / this.width) * 2 - 1, 1 - (py / this.height) * 2), this.camera)
    const o = ray.ray.origin,
      d = ray.ray.direction,
      reach = (this.scene.fog as THREE.Fog).far,
      step = Math.max(1, reach / 2000)
    const over = (t: number): number => {
      const g = this.groundAt(o.x + d.x * t, o.z + d.z * t)
      return o.y + d.y * t - (Number.isFinite(g) ? g : 0)
    }
    // Along the ray in steps until it is under the ground, then halved down to where it meets it.
    for (let t = step; t <= reach; t += step) {
      if (over(t) > 0) continue
      let a = t - step,
        b = t
      for (let i = 0; i < 20; i++) {
        const m = (a + b) / 2
        if (over(m) > 0) a = m
        else b = m
      }
      return { x: o.x + d.x * b, z: o.z + d.z * b }
    }
    return null
  }

  /** The angle on the view, clockwise from up, of a heading on the ground at a point, in degrees clockwise from north. */
  angleOf(x: number, z: number, degrees: number): number {
    const ground = this.groundAt(x, z),
      y = Number.isFinite(ground) ? ground : 0,
      a = (degrees * Math.PI) / 180,
      from = new THREE.Vector3(x, y, z).project(this.camera),
      to = new THREE.Vector3(x + Math.sin(a), y, z - Math.cos(a)).project(this.camera)
    return (Math.atan2((to.x - from.x) * this.width, (to.y - from.y) * this.height) * 180) / Math.PI
  }

  /** The view's size in pixels, as last measured: reading it off the page at every frame would make the page lay itself out again. */
  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  /** Yards from the camera to where the fog hides everything. */
  get reach(): number {
    return (this.scene.fog as THREE.Fog).far
  }

  // Whether the ground rises between the camera and a point a little over the ground: looked at in
  // steps on the way. A point is looked at again only every few frames, not all of them in the same
  // one: the camera moves little from one to the next, and a thousand pins asked at every frame.
  private hills = new Map<number, number>() // by point: the frame it was looked at, twice, plus 1 behind a hill
  private behindHill(p: THREE.Vector3): boolean {
    const key = Math.round(p.x) * 65536 + Math.round(p.z),
      seen = this.hills.get(key)
    if (seen !== undefined && this.frame - (seen >> 1) < 3 + (key % 4)) return (seen & 1) === 1
    const c = this.camera.position
    let behind = false
    for (let i = 1; i < LOOKS && !behind; i++) {
      const t = i / LOOKS
      behind = this.groundAt(c.x + (p.x - c.x) * t, c.z + (p.z - c.z) * t) > c.y + (p.y + 2 - c.y) * t
    }
    if (this.hills.size > 50000) this.hills.clear()
    this.hills.set(key, this.frame * 2 + (behind ? 1 : 0))
    return behind
  }

  /** Puts the camera there at once. */
  look(at: Look): void {
    const ground = this.groundAt(at.x, at.z)
    this.controls.target.set(at.x, Number.isFinite(ground) ? ground : this.controls.target.y, at.z)
    this.place(at.seen / 2 / Math.tan((FOV * Math.PI) / 360), at.polar, at.azimuth)
    this.dirty = true
  }

  /** Where the camera is. */
  looking(): Look {
    const t = this.controls.target
    return {
      x: t.x,
      z: t.z,
      seen: 2 * this.eye.distanceTo(t) * Math.tan((FOV * Math.PI) / 360),
      polar: this.controls.getPolarAngle(),
      azimuth: this.controls.getAzimuthalAngle(),
    }
  }

  /** Turns the camera round the point looked at, in this many milliseconds, keeping its distance. Rotation is off while it is straight down (2D). */
  turn(polar: number, azimuth: number, ms = 450): Promise<void> {
    const p0 = this.controls.getPolarAngle(),
      a0 = this.controls.getAzimuthalAngle(),
      t0 = performance.now()
    let da = azimuth - a0
    da = Math.atan2(Math.sin(da), Math.cos(da))
    this.controls.enabled = false
    return new Promise((done) => {
      this.turning = (now) => {
        const t = Math.min(1, (now - t0) / ms),
          e = t * t * (3 - 2 * t)
        this.place(this.camera.position.distanceTo(this.controls.target), p0 + (polar - p0) * e, a0 + da * e)
        if (t < 1) return
        this.turning = null
        this.controls.enabled = true
        this.controls.enableRotate = polar > 0.01
        done()
      }
    })
  }

  /** The north up, tilt kept. */
  north(): Promise<void> {
    return this.turn(this.controls.getPolarAngle(), 0)
  }

  start(): void {
    this.dirty = true
    this.renderer.setAnimationLoop((now) => this.tick(now))
  }

  stop(): void {
    this.renderer.setAnimationLoop(null)
  }

  /** Graphics memory in use: what renderer.info counts. */
  info(): { geometries: number; textures: number; nodes: number } {
    return {
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      nodes: [...this.nodes.values()].filter((n) => n.group).length,
    }
  }

  dispose(): void {
    this.stop()
    this.observer.disconnect()
    this.drop()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.compass.dispose()
  }

  private place(distance: number, polar: number, azimuth: number): void {
    this.lifted = false
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSphericalCoords(distance, Math.max(polar, 1e-4), azimuth))
    this.camera.lookAt(this.controls.target)
    this.dirty = true
  }

  private resize(): void {
    const w = this.host.clientWidth,
      h = this.host.clientHeight
    if (!w || !h) return
    this.width = w
    this.height = h
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  private drop(): void {
    for (const n of this.nodes.values()) this.unload(n)
    this.nodes.clear()
    this.finest = null
    for (const p of this.pictures.values()) p.made?.dispose()
    this.pictures.clear()
    this.blocks.clear()
    this.queue = []
  }

  private unload(n: Node): void {
    if (!n.group) return
    this.finest = null
    if (n.state === 'empty') {
      n.group.children.forEach((c) => (c as THREE.Mesh).geometry.dispose())
      this.scene.remove(n.group)
      n.group = undefined
      n.state = 'new'
      return
    }
    for (const child of n.group.children) (child as THREE.Mesh).geometry.dispose()
    this.scene.remove(n.group)
    n.group = undefined
    n.state = 'new'
    n.grid = undefined
  }

  private node(z: number, x: number, y: number): Node {
    const key = keyOf(z, x, y)
    let n = this.nodes.get(key)
    if (!n) this.nodes.set(key, (n = { z, x, y, state: 'new', used: 0 }))
    return n
  }

  private drawnAt = 0
  private tick(now: number): void {
    if (now - this.drawnAt < FRAME_MS) return
    this.drawnAt = now
    this.frame++
    if (this.lifted) this.camera.position.copy(this.logical)
    this.lifted = false
    if (this.turning) this.turning(now)
    else if (this.controls.update()) this.dirty = true
    this.hold()
    if (!this.camera.position.equals(this.drawnFrom)) this.dirty = true
    const distance = this.eye.distanceTo(this.controls.target)
    // Fog from the point looked at outwards: 40% of the prototype's scale (ui.md).
    const fog = this.scene.fog as THREE.Fog
    fog.near = distance * 1.56
    fog.far = distance * 3.6
    this.camera.near = Math.max(1, distance / 200)
    this.camera.far = distance * 4 + 2000
    this.camera.updateProjectionMatrix()
    this.compass.turn(this.controls.getPolarAngle() / 2, this.controls.getAzimuthalAngle())
    if (this.dirty) {
      this.dirty = false
      this.choose()
      this.renderer.render(this.scene, this.camera)
      this.drawnFrom.copy(this.camera.position)
      this.compass.render()
      this.evict()
    }
    this.onFrame()
  }

  // The point looked at stays on the ground as it rises and falls under it, and the camera never
  // goes into the ground: it is drawn from over hills and mountains (ui.md), the controls left where they were.
  private hold(): void {
    const t = this.controls.target,
      c = this.camera.position
    const under = this.groundAt(t.x, t.z)
    if (Number.isFinite(under) && Math.abs(under - t.y) > 0.05) {
      const dy = (under - t.y) * 0.2
      t.y += dy
      c.y += dy
      this.dirty = true
    }
    const below = this.groundAt(c.x, c.z),
      clear = Math.max(6, c.distanceTo(t) * 0.04)
    if (Number.isFinite(below) && c.y < below + clear) {
      this.logical.copy(c)
      this.lifted = true
      c.y = below + clear
      this.camera.lookAt(t)
    }
  }

  /** The height of the ground at a point, from the finest node there that is in; NaN where none is. */
  private groundAt(x: number, z: number): number {
    if (!(x >= 0 && z >= 0 && x < WORLD && z < WORLD)) return NaN
    this.finest ??= this.indexFinest()
    const cells = 2 ** FINEST,
      found = this.finest[Math.floor((z / WORLD) * cells) * cells + Math.floor((x / WORLD) * cells)]
    if (!found?.grid) return NaN
    const size = WORLD / 2 ** found.z,
      step = size / (N - 1)
    const fx = Math.min(N - 1.001, Math.max(0, (x - found.x * size) / step)),
      fz = Math.min(N - 1.001, Math.max(0, (z - found.y * size) / step))
    const j = Math.floor(fx),
      i = Math.floor(fz),
      a = fx - j,
      b = fz - i,
      h = found.grid.heights
    const v = (h[i * N + j]! * (1 - a) + h[i * N + j + 1]! * a) * (1 - b) + (h[(i + 1) * N + j]! * (1 - a) + h[(i + 1) * N + j + 1]! * a) * b
    return v
  }

  // The finest node that is in, at each place, as one array: groundAt is asked thousands of times a
  // frame (pins3d.ts). From the roots down: a node counts where its parent does.
  private finest: (Node | undefined)[] | null = null
  private indexFinest(): (Node | undefined)[] {
    const cells = 2 ** FINEST,
      index: (Node | undefined)[] = new Array(cells * cells)
    const ready = [...this.nodes.values()].filter((n) => n.state === 'ready').sort((a, b) => a.z - b.z)
    for (const n of ready) {
      const span = 2 ** (FINEST - n.z),
        first = n.y * span * cells + n.x * span
      if (n.z > ROOT && index[first]?.z !== n.z - 1) continue // its parent is not in
      for (let r = 0; r < span; r++) index.fill(n, first + r * cells, first + r * cells + span)
    }
    return index
  }

  // Which nodes are on show this frame: from the roots down, as long as a node's picture would be
  // blurred on screen and its four children are all in.
  private choose(): void {
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse))
    const perRadian = this.renderer.domElement.height / 2 / Math.tan((FOV * Math.PI) / 360) / this.renderer.getPixelRatio()
    const wanted: Node[] = []
    for (const n of this.nodes.values()) if (n.group) n.group.visible = false
    const visit = (n: Node): void => {
      n.used = this.frame
      if (n.state === 'new') return void wanted.push(n)
      if (n.state === 'empty' && n.group && n.box && frustum.intersectsBox(n.box)) return void (n.group.visible = true)
      if (n.state !== 'ready' || !n.box || !frustum.intersectsBox(n.box)) return
      const size = WORLD / 2 ** n.z,
        detail = n.z < BLOCK_ZOOM ? size / 256 : size / (N - 1) / 4
      const far = Math.max(1, n.box.distanceToPoint(this.camera.position))
      if (n.z < FINEST && (detail / far) * perRadian > SHARPNESS) {
        const kids = [0, 1, 2, 3].map((k) => this.node(n.z + 1, n.x * 2 + (k & 1), n.y * 2 + (k >> 1)))
        for (const k of kids) {
          k.used = this.frame
          if (k.state === 'new') wanted.push(k)
        }
        if (kids.every((k) => k.state === 'ready' || k.state === 'empty')) return void kids.forEach(visit)
      }
      n.group!.visible = true
      if (n.picture) this.pictures.get(n.picture)!.used = this.frame
    }
    const roots = 2 ** ROOT
    for (let y = 0; y < roots; y++) for (let x = 0; x < roots; x++) visit(this.node(ROOT, x, y))
    // The coarse first, then the nearest.
    const to = (n: Node): number => n.z * 1e7 + Math.hypot((n.x + 0.5) * (WORLD / 2 ** n.z) - this.controls.target.x, (n.y + 0.5) * (WORLD / 2 ** n.z) - this.controls.target.z)
    this.queue = wanted.sort((a, b) => to(a) - to(b))
    while (this.loading < LOADING && this.queue.length) void this.load(this.queue.shift()!)
  }

  private async load(n: Node): Promise<void> {
    n.state = 'loading'
    this.loading++
    const folder = this.folder
    try {
      const block = n.z >= BLOCK_ZOOM ? `${n.x >> (n.z - BLOCK_ZOOM)} ${n.y >> (n.z - BLOCK_ZOOM)}` : null
      const levels = block ? await this.blockLevels(block) : await inflated(`${TILES}/${folder}/levels/${n.z}/${n.x}/${n.y}.bin`).then((b) => b && unpackLevels(b))
      if (folder !== this.folder) return
      if (!levels) {
        // No ground in this tile: open sea.
        n.group = this.sea(n)
        this.scene.add(n.group)
        n.state = 'empty'
        return
      }
      const key = block ?? `${n.z} ${n.x} ${n.y}`
      const texture = await this.picture(key, n)
      if (folder !== this.folder) return
      n.picture = key
      n.grid = gridOf(levels, n.z, n.x, n.y)
      n.group = this.meshes(n, n.grid, texture)
      // Once on the graphics card, the window keeps no copy of a node's meshes: what it needs of the ground is in its grid.
      n.group.traverse((o) => {
        const geo = (o as THREE.Mesh).geometry
        if (!geo) return
        geo.computeBoundingSphere()
        for (const a of [...Object.values(geo.attributes), geo.index])
          (a as THREE.BufferAttribute | null)?.onUpload(function (this: THREE.BufferAttribute) {
            ;(this as { array: unknown }).array = null
          })
      })
      this.scene.add(n.group)
      n.state = 'ready'
      this.finest = null
    } catch {
      n.state = 'empty'
    } finally {
      this.loading--
      this.dirty = true
    }
  }

  private blockLevels(key: string): Promise<Levels | null> {
    let b = this.blocks.get(key)
    if (!b) {
      const [c, r] = key.split(' ')
      this.blocks.set(
        key,
        (b = {
          levels: inflated(`${TILES}/${this.folder}/levels/${BLOCK_ZOOM}/${c}/${r}.bin`).then((x) => x && unpackLevels(x)),
          used: this.frame,
        }),
      )
    }
    b.used = this.frame
    return b.levels
  }

  // A node's picture: the map's tile below a block, the game's own block (DXT1, as the card takes it) at a block and below.
  private picture(key: string, n: Node): Promise<THREE.Texture | null> {
    let p = this.pictures.get(key)
    if (!p) {
      const made = n.z < BLOCK_ZOOM ? this.tilePicture(`${TILES}/${this.folder}/${n.z}/${n.x}/${n.y}.png`) : this.blockPicture(key)
      p = { texture: made, used: this.frame }
      const kept = p
      void made.then((t) => (kept.made = t))
      this.pictures.set(key, p)
    }
    return p.texture
  }

  private async tilePicture(url: string): Promise<THREE.Texture | null> {
    const answer = await fetch(url).catch(() => null)
    if (!answer?.ok) return null
    const bitmap = await createImageBitmap(await answer.blob())
    const t = new THREE.Texture(bitmap)
    t.flipY = false
    return this.finish(t)
  }

  private async blockPicture(key: string): Promise<THREE.Texture | null> {
    const [c, r] = key.split(' ')
    const dxt = await inflated(`${TILES}/${this.folder}/blocks/${c}/${r}.dxt`)
    if (!dxt) return this.tilePicture(`${TILES}/${this.folder}/${BLOCK_ZOOM}/${c}/${r}.png`)
    const size = Math.sqrt(dxt.length * 2)
    if (this.s3tc) {
      // ponytail: no smaller copies (mipmaps) of a block's picture: it is only on show near the camera. Make them if far blocks shimmer.
      const t = new THREE.CompressedTexture([{ data: dxt, width: size, height: size }] as unknown as ImageData[], size, size, THREE.RGB_S3TC_DXT1_Format)
      t.minFilter = THREE.LinearFilter
      return this.finish(t)
    }
    const rgb = pictureOfBlock(dxt),
      rgba = new Uint8Array(size * size * 4)
    for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) rgba.set([rgb[i]!, rgb[i + 1]!, rgb[i + 2]!, 255], o)
    return this.finish(new THREE.DataTexture(rgba, size, size))
  }

  private finish(t: THREE.Texture): THREE.Texture {
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    if (!(t instanceof THREE.CompressedTexture)) t.generateMipmaps = true
    t.needsUpdate = true
    return t
  }

  // A node's ground and liquids.
  private meshes(n: Node, g: Grid, texture: THREE.Texture | null): THREE.Group {
    const size = WORLD / 2 ** n.z,
      step = size / (N - 1),
      x0 = n.x * size,
      z0 = n.y * size
    // The part of the picture this node covers: a quarter of its block's below a block.
    const quarter = n.z > BLOCK_ZOOM,
      u0 = quarter ? (n.x & 1) / 2 : 0,
      v0 = quarter ? (n.y & 1) / 2 : 0,
      span = quarter ? 0.5 : 1
    const skirt = Math.max(20, step * 3)
    const count = N * N + 4 * (N - 1)
    const pos = new Float32Array(count * 3),
      uv = new Float32Array(count * 2),
      normal = new Float32Array(count * 3)
    const h = g.heights,
      ok = (i: number, j: number): boolean => Number.isFinite(h[i * N + j]!)
    const at = (i: number, j: number): number => {
      const v = h[Math.min(N - 1, Math.max(0, i)) * N + Math.min(N - 1, Math.max(0, j))]!
      return Number.isFinite(v) ? v : h[i * N + j]!
    }
    let low = Infinity,
      high = -Infinity
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const k = i * N + j,
          y = ok(i, j) ? h[k]! : 0
        if (ok(i, j)) ((low = Math.min(low, y)), (high = Math.max(high, y)))
        pos.set([x0 + j * step, y, z0 + i * step], k * 3)
        uv.set([u0 + (j / (N - 1)) * span, v0 + (i / (N - 1)) * span], k * 2)
        const ex = (at(i, j + 1) - at(i, j - 1)) / (2 * step),
          ez = (at(i + 1, j) - at(i - 1, j)) / (2 * step)
        const len = Math.hypot(ex, 1, ez) || 1
        normal.set(Number.isFinite(ex + ez) ? [-ex / len, 1 / len, -ez / len] : [0, 1, 0], k * 3)
      }
    }
    const index: number[] = []
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        // No ground, or a hole in it: the mouth of a cave, left open.
        if (!ok(i, j) || !ok(i, j + 1) || !ok(i + 1, j) || !ok(i + 1, j + 1) || g.kinds[i * (N - 1) + j]! & HOLE) continue
        const a = i * N + j
        index.push(a, a + N, a + 1, a + 1, a + N, a + N + 1)
      }
    }
    // The skirt: the ring of edge vertices again, lower, joined to the edge.
    const ring: number[] = []
    for (let j = 0; j < N - 1; j++) ring.push(j)
    for (let i = 0; i < N - 1; i++) ring.push(i * N + N - 1)
    for (let j = N - 1; j > 0; j--) ring.push((N - 1) * N + j)
    for (let i = N - 1; i > 0; i--) ring.push(i * N)
    ring.forEach((v, r) => {
      const k = N * N + r
      pos.set([pos[v * 3]!, pos[v * 3 + 1]! - skirt, pos[v * 3 + 2]!], k * 3)
      uv.set([uv[v * 2]!, uv[v * 2 + 1]!], k * 2)
      normal.set([normal[v * 3]!, normal[v * 3 + 1]!, normal[v * 3 + 2]!], k * 3)
    })
    ring.forEach((v, r) => {
      const w = ring[(r + 1) % ring.length]!
      if (!Number.isFinite(h[v]!) || !Number.isFinite(h[w]!)) return
      const sv = N * N + r,
        sw = N * N + ((r + 1) % ring.length)
      index.push(v, sv, w, w, sv, sw)
    })
    const ground = new THREE.BufferGeometry()
    ground.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    ground.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    ground.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
    ground.setIndex(index)
    const material = texture ? this.groundWith(texture) : this.materials.ground
    const group = new THREE.Group()
    group.add(new THREE.Mesh(ground, material))

    // Liquids: a square a liquid, at the levels of its corners, grouped by kind.
    const lpos = new Float32Array(N * N * 3),
      byKind: number[][] = [[], [], [], [], []]
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) lpos.set([x0 + j * step, Number.isFinite(g.water[i * N + j]!) ? g.water[i * N + j]! : 0, z0 + i * step], (i * N + j) * 3)
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const kind = g.kinds[i * (N - 1) + j]! & ~HOLE,
          a = i * N + j
        // A square with no ground: open sea, at 0.
        if (!ok(i, j) || !ok(i, j + 1) || !ok(i + 1, j) || !ok(i + 1, j + 1)) {
          for (const c of [a, a + 1, a + N, a + N + 1]) lpos[c * 3 + 1] = 0
          ;((low = Math.min(low, 0)), (high = Math.max(high, 0)))
          byKind[4]!.push(a, a + N, a + 1, a + 1, a + N, a + N + 1)
          continue
        }
        if (kind === DRY || kind > TAR) continue
        const corners = [a, a + 1, a + N, a + N + 1].map((c) => g.water[c]!)
        if (!corners.every(Number.isFinite)) continue
        high = Math.max(high, ...corners)
        byKind[kind - 1]!.push(a, a + N, a + 1, a + 1, a + N, a + N + 1)
      }
    }
    if (byKind.some((list) => list.length)) {
      const liquid = new THREE.BufferGeometry()
      liquid.setAttribute('position', new THREE.BufferAttribute(lpos, 3))
      // Deep water as the open sea: else its bed far under it shows through, faded by the fog to the sky's colour.
      const colours = new Float32Array(N * N * 4),
        shallow = new THREE.Color(WATER_COLOUR),
        sea = new THREE.Color(SEA),
        c = new THREE.Color()
      for (let v = 0; v < N * N; v++) {
        const depth = lpos[v * 3 + 1]! - h[v]!,
          t = Number.isFinite(depth) ? Math.min(1, Math.max(0, (depth - SHALLOW) / (DEEP - SHALLOW))) : 1
        c.copy(shallow)
          .lerp(sea, t)
          .toArray(colours, v * 4)
        colours[v * 4 + 3] = 0.5 + 0.5 * t
      }
      liquid.setAttribute('color', new THREE.BufferAttribute(colours, 4))
      liquid.setAttribute(
        'normal',
        new THREE.BufferAttribute(
          new Float32Array(N * N * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)),
          3,
        ),
      )
      const all: number[] = []
      byKind.forEach((list, k) => {
        if (list.length) liquid.addGroup(all.length, list.length, k)
        all.push(...list)
      })
      liquid.setIndex(all)
      const mesh = new THREE.Mesh(liquid, this.materials.liquids)
      mesh.renderOrder = 1
      group.add(mesh)
    }
    if (!Number.isFinite(low)) low = high = 0
    n.box = new THREE.Box3(new THREE.Vector3(x0, low - skirt, z0), new THREE.Vector3(x0 + size, high, z0 + size))
    return group
  }

  // A tile with no ground: one square of open sea.
  private sea(n: Node): THREE.Group {
    const size = WORLD / 2 ** n.z,
      geo = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate((n.x + 0.5) * size, 0, (n.y + 0.5) * size)
    n.box = new THREE.Box3(new THREE.Vector3(n.x * size, 0, n.y * size), new THREE.Vector3((n.x + 1) * size, 0, (n.y + 1) * size))
    return new THREE.Group().add(new THREE.Mesh(geo, this.materials.liquids[4]))
  }

  // The ground's material with a picture: one a picture, shared by the nodes that use it.
  private withPicture = new WeakMap<THREE.Texture, THREE.MeshLambertMaterial>()
  private groundWith(texture: THREE.Texture): THREE.MeshLambertMaterial {
    let m = this.withPicture.get(texture)
    if (!m)
      this.withPicture.set(
        texture,
        (m = new THREE.MeshLambertMaterial({
          map: texture,
          side: THREE.DoubleSide,
        })),
      )
    return m
  }

  // Past KEPT, the nodes and pictures not on show the longest go from the graphics card.
  private evict(): void {
    const held = [...this.nodes.values()].filter((n) => n.group && n.used < this.frame)
    if (held.length > KEPT) for (const n of held.sort((a, b) => a.used - b.used).slice(0, held.length - KEPT)) this.unload(n)
    const inUse = new Set([...this.nodes.values()].filter((n) => n.group).map((n) => n.picture))
    for (const [key, p] of this.pictures) {
      if (inUse.has(key) || p.used >= this.frame || !p.made) continue
      if (this.withPicture.get(p.made)) this.withPicture.get(p.made)!.dispose()
      p.made.dispose()
      this.pictures.delete(key)
    }
    for (const [key, b] of this.blocks) if (this.frame - b.used > 600) this.blocks.delete(key)
  }
}

/**
 * The compass: a small bronze object of its own, on its own canvas, lying on the ground as the view
 * does at half its tilt. No light on it: each part keeps its colour; a light from the north-west
 * only casts the shadows of the needle and the N on the face (ui.md).
 */
class Compass {
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-55, 55, 55, -55, 1, 1000)

  constructor(host: HTMLElement) {
    const r = this.renderer
    r.setPixelRatio(devicePixelRatio)
    r.setSize(110, 110)
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFShadowMap
    host.append(r.domElement)
    const flat = (color: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color })
    const bronze = flat(0xa37e4f),
      darkBronze = flat(0x583e2a),
      ivory = flat(0xeacba4)
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0, shadow = true): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat)
      m.position.y = y
      m.castShadow = shadow
      m.receiveShadow = true
      this.scene.add(m)
      return m
    }
    // Bezel: a raised bronze lip round a face sunk into it, its light painted on: dark at the foot,
    // pale on the lip, the inner slope darker, brighter on the north-west side.
    const bezel = new THREE.LatheGeometry(
      [
        [40, 0],
        [47, 0],
        [47.5, 4.5],
        [46, 7],
        [42.5, 7.2],
        [40.5, 5.5],
        [40, 3.5],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      96,
    )
    const p = bezel.attributes.position!,
      colors = new Float32Array(p.count * 3),
      dark = new THREE.Color(0x583e2a),
      pale = new THREE.Color(0xcfb08a),
      c = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        r = Math.hypot(x, z) || 1
      c.copy(dark)
        .lerp(pale, Math.min(1, y / 7.2))
        .multiplyScalar((r < 42.6 ? 0.8 : 1) * (0.8 + 0.25 * ((-x - z) / (r * Math.SQRT2))))
      c.toArray(colors, i * 3)
    }
    bezel.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    add(bezel, new THREE.MeshBasicMaterial({ vertexColors: true }))
    add(new THREE.CylinderGeometry(40.2, 40.2, 4, 96), flat(0x382e25), 1.5, false)
    add(new THREE.CircleGeometry(40.2, 96).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.8 }), 3.55, false)
    // Ticks: long at north, east, south and west, short between.
    for (let i = 0; i < 8; i++) {
      const long = i % 2 === 0,
        t = add(new THREE.BoxGeometry(1.8, 1.2, long ? 6 : 3.5), long ? bronze : darkBronze, 4)
      const a = (i * Math.PI) / 4,
        r = long ? 35 : 36
      t.position.x = Math.sin(a) * r
      t.position.z = -Math.cos(a) * r
      t.rotation.y = -a
    }
    // A flat shape lifted off the face, drawn with +y to the north, thick by depth.
    const raised = (points: number[][], depth: number, mat: THREE.Material, y: number): THREE.Mesh => {
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z))), {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.4,
        bevelSize: 0.4,
        bevelSegments: 2,
      })
      geo.rotateX(-Math.PI / 2)
      return add(geo, mat, y)
    }
    const n = raised(
      [
        [-4, -5.5],
        [-2.3, -5.5],
        [-2.3, 2],
        [2.5, -5.5],
        [4, -5.5],
        [4, 5.5],
        [2.3, 5.5],
        [2.3, -2],
        [-2.5, 5.5],
        [-4, 5.5],
      ],
      1.4,
      ivory,
      6,
    )
    n.position.z = -22
    // The needle on its pin, higher still: red to the north, ivory to the south.
    raised(
      [
        [0, 17],
        [5.5, 0],
        [-5.5, 0],
      ],
      1.6,
      flat(0xb3261a),
      9.5,
    )
    raised(
      [
        [0, -13],
        [5.5, 0],
        [-5.5, 0],
      ],
      1.6,
      ivory,
      9.5,
    )
    add(new THREE.CylinderGeometry(1.6, 2.2, 7, 24), darkBronze, 6.5)
    add(new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), bronze, 11.5)
    const sun = new THREE.DirectionalLight(0xffffff, 1)
    sun.position.set(-60, 110, -60)
    sun.castShadow = true
    Object.assign(sun.shadow.camera, {
      left: -55,
      right: 55,
      top: 55,
      bottom: -55,
      near: 1,
      far: 400,
    })
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.bias = -0.002
    this.scene.add(sun)
  }

  turn(polar: number, azimuth: number): void {
    this.camera.position.setFromSphericalCoords(300, Math.max(polar, 1e-3), azimuth)
    this.camera.lookAt(0, 0, 0)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
