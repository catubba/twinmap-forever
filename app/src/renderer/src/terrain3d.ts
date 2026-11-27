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
import type { Compass } from './compass'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { pinOn, standsOn, type Floors } from '../../shared/floors'
import { solidAt, type Piece } from '../../shared/inside'
import { BLOCK_ZOOM, HOLE, unpackLevels, type Levels } from '../../shared/levels'
import { pictureOfBlock } from '../../shared/pixels'
import { STANDS_FILE, type Stands } from '../../shared/stands'
import { DRY, TAR } from '../../shared/water'
import { BLOCKS, BLOCK_YARDS } from '../../shared/world'
import { Buildings, DUNGEON_CUT } from './buildings3d'
import { Ground } from './ground3d'
import { Props } from './props3d'
import type { Density } from '../../shared/props'
import { ROOF_STEP } from './inside3d'
import { inApp, TILES } from './web'

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
const KEPT = inApp ? 200 : 60 // a phone on the home network has less room on its graphics card
const LOADING = 6
const SKY = 0x7f97ab
/** Yards between the floor the character stood on and the one under it now from which it is another floor, not the same one rising or falling, and the milliseconds it must last to be taken. */
const FLOOR_STEP = 4
const FLOOR_SETTLE = 500
/** Round a dungeon with no ground of its own: the dark of the window (--stone-950). */
const VOID = 0x0c0a08
/** The dark of a hole in the ground: chosen by the user on 18 November 2026 over leaving it open to the sky. */
const PIT = 0x14110d
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
/** The ground over a room it is the roof of: how much of it stays (ui.md, "Interni e grotte in 3D"). */
const ROOF_KEPT = 0.05
/** Yards past a room's roof, along the look, that the ground still opens for it. */
const ROOF_MARGIN = 60
/** How much of a room shows through a mountain that is not its roof. */
const ROOF_GHOST = 0.1

/** What lies inside the ground (inside3d.ts), as the view asks it. */
export interface Under {
  roofOver(x0: number, z0: number, x1: number, z1: number): ((x: number, z: number) => number) | null
  floorAt(x: number, z: number): { y: number; open: number } | null
  step(camera: THREE.Vector3, dt: number): boolean
  seenPass(on: boolean): void
  /** Whether its pictures are left out of the view, the buildings being drawn whole (buildings3d.ts): they still open the ground. */
  hidePictures(on: boolean): void
  readonly any: boolean
}

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
export const inflated = (url: string): Promise<Uint8Array<ArrayBuffer> | null> =>
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
  /** A dungeon is on show, with a ground of its own or all buildings: no sea where it has no ground, and what stands in it stands on its buildings' floors, or on its ground. */
  bare = false
  /** In a dungeon: the pictures of its rooms, and of the character in it the level it is on and whether it is in the open, as the minimap tells them (Map.svelte): they tell the floor it stands on (shared/floors.ts). */
  rooms: { pieces: Piece[]; level?: number; open?: boolean } | null = null
  private solids = new Map<number, Uint8Array | null | undefined>() // the pictures of the rooms asked about, by file: undefined while one is read
  private stood: number | null = null // the height the character last stood at in the dungeon on show
  private other: { y: number; since: number } | null = null // another floor under it, and since when
  private turning: ((now: number) => void) | null = null
  private materials: {
    ground: THREE.MeshLambertMaterial
    pit: THREE.MeshBasicMaterial
    // the same dark where the ground over a room opens: a building's floor that the cut of a city inside the ground (buildings3d.ts) shows
    openPit: THREE.MeshLambertMaterial
    liquids: THREE.Material[]
  }
  private observer: ResizeObserver
  readonly s3tc: boolean
  // What is inside the ground is drawn before it, from a scene of its own; and first of all alone, on a
  // picture (seen) the ground asks pixel by pixel: is a room behind me, how much ground has it over it,
  // how far is it. The ground that is its roof goes see-through; a mountain far in front of it stays.
  private below = new THREE.Scene()
  private sunk = new THREE.Group()
  private inside: Under | null = null
  // The buildings of the continent (buildings3d.ts), in the scene with the ground.
  private buildings: Buildings
  // The trees and objects (props3d.ts), the same way.
  private props: Props
  /** The ground's own textures near the camera (ground3d.ts). */
  private ground: Ground
  // Where things stand over the game's ground, while the buildings are on show (shared/stands.ts): of each block that
  // has any (its column times BLOCKS plus its row), the height of each of its cells, NaN where it is the ground.
  private stands: { cells: number; blocks: Map<number, Float32Array> } | null = null
  private standsAsked = -Infinity // in seconds
  private streets = true
  private seen = new THREE.WebGLRenderTarget(2, 2, { depthTexture: new THREE.DepthTexture(2, 2) })
  private seenClear = false // not yet: a picture never drawn on reads as solid
  private roofs = {
    uSeen: { value: this.seen.texture },
    uSeenDepth: { value: this.seen.depthTexture },
    uSize: { value: new THREE.Vector2(2, 2) },
    uNear: { value: 1 },
    uFar: { value: 2 },
    uDown: { value: 1 },
  }
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
    private compass: Compass,
  ) {
    // Drawn by the processor (hardware acceleration off, or no GPU Chromium takes): no antialias, three times the
    // frames for the same CPU (design/gpu/frames-trial.js). The browser says so by refusing a context that needs the GPU.
    const software = !document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    this.renderer = new THREE.WebGLRenderer({
      antialias: !software,
      powerPreference: 'high-performance',
    })
    // On a phone two points of the view a point of the page are enough: three are nine times the work of one.
    this.renderer.setPixelRatio(inApp ? devicePixelRatio : Math.min(devicePixelRatio, 2))
    host.append(this.renderer.domElement)
    this.s3tc = this.renderer.extensions.has('WEBGL_compressed_texture_s3tc')
    this.scene.fog = new THREE.Fog(SKY, 1, 2)
    this.renderer.autoClear = false // a frame is the inside, then the ground over it (draw)
    this.below.add(this.sunk)
    // Half of the light from all round, half from a sun fixed to the north-west, 45 degrees up: level ground as bright as the minimap.
    const sun = new THREE.DirectionalLight(0xffffff, (Math.PI * 0.5) / Math.sin(Math.PI / 4))
    sun.position.set(-Math.SQRT1_2, 1, -Math.SQRT1_2)
    this.scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.5), sun)
    this.materials = {
      ground: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
      pit: new THREE.MeshBasicMaterial({ color: PIT }),
      openPit: Object.assign(new THREE.MeshLambertMaterial({ color: 0x000000, emissive: PIT, transparent: true }), { onBeforeCompile: (shader: THREE.WebGLProgramParametersWithUniforms) => this.opening(shader) }),
      // Water, lava, fel, tar: in the order water.ts numbers them, from 1; then the open sea.
      liquids: [
        // Its colour a vertex, by how deep it is (meshes). The sun shines on shallow water only: deep water is the open sea, which has no shine.
        Object.assign(new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x8899aa, shininess: 60, transparent: true, depthWrite: false }), {
          onBeforeCompile: (shader: { fragmentShader: string }) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.directSpecular *= 2.0 * (1.0 - vColor.a);`)
          },
        }),
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
    this.buildings = new Buildings(this.renderer)
    this.scene.add(this.buildings.group)
    this.props = new Props(this.renderer, (x, z) => this.buildings.cutAt(x, z))
    this.scene.add(this.props.group)
    this.ground = new Ground(this.renderer, this.s3tc)
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
    // Two fingers turned round each other turn the view with them, as a map on a phone does. MapControls alone turns
    // it only as far as both fingers slide sideways: while two fingers are down the turn is set from here.
    const fingers = new Map<number, { x: number; y: number }>()
    let twist: { from: number; azimuth: number } | null = null
    const slant = (): number => {
      const [a, b] = [...fingers.values()]
      return Math.atan2(b!.y - a!.y, b!.x - a!.x)
    }
    const lifted = (e: PointerEvent): void => {
      fingers.delete(e.pointerId)
      if (!twist) return
      twist = null
      this.controls.minAzimuthAngle = -Infinity
      this.controls.maxAzimuthAngle = Infinity
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (fingers.size === 2 && this.controls.enableRotate) twist = { from: slant(), azimuth: this.controls.getAzimuthalAngle() }
    })
    canvas.addEventListener('pointermove', (e) => {
      if (!fingers.has(e.pointerId)) return
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (!twist || fingers.size !== 2) return
      const to = twist.azimuth + (slant() - twist.from)
      this.controls.minAzimuthAngle = this.controls.maxAzimuthAngle = Math.atan2(Math.sin(to), Math.cos(to))
      this.dirty = true
    })
    canvas.addEventListener('pointerup', lifted)
    canvas.addEventListener('pointercancel', lifted)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
  }

  /** The continent shown, by its folder, or a dungeon (bare: no sea; its ground, where it has one, is drawn as a continent's); the tiles of another one go. */
  show(folder: string, bare = false): void {
    if (folder === this.folder) return
    this.drop()
    this.folder = folder
    this.bare = bare
    this.stood = null
    this.other = null
    ;(this.scene.fog as THREE.Fog).color.set(bare ? VOID : SKY)
    this.buildings.show(folder, bare)
    this.props.show(folder)
    this.ground.show(folder)
    this.stands = null
    this.standsAsked = -Infinity
    this.dirty = true
  }

  // Where things stand over the ground of the continent, asked for until it is there: the app makes it after the buildings.
  private askStands(): void {
    const now = performance.now() / 1000
    if (this.stands || !this.folder || now - this.standsAsked < 30) return
    this.standsAsked = now
    const folder = this.folder
    void fetch(`${TILES}/${folder}/${STANDS_FILE}`)
      .then((a) => (a.status === 200 ? (a.json() as Promise<Stands>) : null))
      .catch(() => null)
      .then((s) => {
        if (!s || folder !== this.folder) return
        const blocks = new Map<number, Float32Array>()
        for (const [key, list] of Object.entries(s.blocks)) {
          const [c, r] = key.split('-').map(Number) as [number, number], cells = new Float32Array(s.cells * s.cells).fill(NaN)
          for (let k = 0; k < list.length; k += 2) cells[list[k]!] = list[k + 1]! / 4
          blocks.set(c * BLOCKS + r, cells)
        }
        this.stands = { cells: s.cells, blocks }
        this.dirty = true
      })
  }

  /**
   * The height of where one walks at a place when that is not the game's ground (the streets of a city, which are its
   * building's), while the buildings are on show; null where things stand on the ground.
   */
  streetAt(x: number, z: number): number | null {
    const s = this.streets ? this.stands : null,
      c = Math.floor(x / BLOCK_YARDS),
      r = Math.floor(z / BLOCK_YARDS),
      cells = s?.blocks.get(c * BLOCKS + r)
    if (!cells) return null
    const size = BLOCK_YARDS / s!.cells,
      high = cells[Math.floor((z - r * BLOCK_YARDS) / size) * s!.cells + Math.floor((x - c * BLOCK_YARDS) / size)]!
    return Number.isNaN(high) ? null : high
  }

  /** Whether the buildings are drawn (Settings > Graphics). */
  showBuildings(on: boolean): void {
    this.buildings.turn(on)
    this.streets = on
    this.dirty = true
  }

  /** Which trees and objects are drawn (Settings > Graphics). */
  showProps(trees: boolean, density: Density, objects: boolean): void {
    this.props.turn(trees, density, objects)
    this.dirty = true
  }

  /** Whether the ground has its own textures up close (Settings > Graphics). */
  showGround(on: boolean): void {
    this.ground.turn(on)
    this.dirty = true
  }

  /** Whether the wheel zooms on the point under the pointer, or on the point looked at (a character followed). */
  zoomAtCursor(on: boolean): void {
    this.controls.zoomToCursor = on
  }

  /** Called when the camera is taken by hand. */
  onGrab: () => void = () => {}

  /** Called before a frame is drawn: what is in the scene and moves by itself (arrow3d.ts) takes its place. True when the view must be drawn again for it. */
  onBefore: () => boolean = () => false

  /** Something of the scene that is not the ground: the character's arrow. */
  add(object: THREE.Object3D): void {
    this.scene.add(object)
  }

  /** What is inside the ground: its rooms, and what tells of them. */
  under(rooms: THREE.Object3D, inside: Under): void {
    this.below.add(rooms)
    this.inside = inside
  }

  /** Something of the scene that is in a room under the ground, or out of it again: drawn with the rooms, before the ground. */
  sink(object: THREE.Object3D, on: boolean): void {
    if ((object.parent === this.sunk) !== on) (on ? this.sunk : this.scene).add(object)
  }

  /** The floor of an open room over a place, and how open it is; null where there is none. */
  floorAt(x: number, z: number): { y: number; open: number } | null {
    return this.inside?.floorAt(x, z) ?? null
  }

  /** Whether something this high is on the ground over an open room there, and not on the room's floor. */
  overRoom(x: number, z: number, high: number): boolean {
    const floor = this.inside?.floorAt(x, z),
      ground = this.groundAt(x, z)
    return !!floor && Number.isFinite(ground) && Math.abs(high - ground) < Math.abs(high - floor.y)
  }

  /**
   * The height the character stands at in the dungeon on show, at a place: the floor under it nearest to the one it
   * stood on when last asked. undefined before the dungeon's building is in, or while a room's picture is read.
   */
  floorIn(x: number, z: number): number | undefined {
    const floors = this.bare ? this.floors() : null
    if (!floors) return undefined
    const on = standsOn(floors, this.rooms?.pieces ?? [], x, z, this.rooms?.level, this.stood, this.solid, this.rooms?.open)
    if (on === undefined) return undefined
    // Another floor than the one it stood on is taken once it has been the one for a while: the arrow glides between
    // two places read (glide.ts) over whatever lies between them, a pit as well, and would be left at its bottom.
    if (on !== null && this.stood !== null && Math.abs(on - this.stood) > FLOOR_STEP) {
      const now = performance.now()
      if (!this.other || Math.abs(this.other.y - on) > FLOOR_STEP) this.other = { y: on, since: now }
      if (now - this.other.since < FLOOR_SETTLE) return this.stood
    }
    this.other = null
    // no floor near: where it stood, or the dungeon's main floor
    if (on !== null) this.stood = on
    return on ?? this.stood ?? this.buildings.dungeonFloor ?? undefined
  }

  // Whether a room's picture is solid at a place: undefined while it is read, which draws the view again once it is in.
  private solid = (p: Piece, u: number, v: number): boolean | undefined => {
    if (!this.solids.has(p.file)) {
      this.solids.set(p.file, undefined)
      void inflated(`${TILES}/rooms/${p.file}.dxt`).then((dxt) => (this.solids.set(p.file, dxt), (this.dirty = true)))
    }
    const dxt = this.solids.get(p.file)
    return dxt === undefined ? undefined : !!dxt && solidAt(p, dxt, u, v)
  }

  /**
   * The height a pin of the dungeon on show lies at: on its own floor, not the character's (shared/floors.ts, pinOn).
   * high: how high what it marks stands, where that is told. undefined out of a dungeon, before its building is in, or
   * while the picture of its room is read.
   */
  pinAt(x: number, z: number, high?: number): number | undefined {
    const floors = this.bare ? this.floors() : null
    if (!floors) return undefined
    const on = pinOn(floors, this.rooms?.pieces ?? [], x, z, high, this.solid)
    // no floor there at all: the dungeon's main floor
    return on === null ? (this.buildings.dungeonFloor ?? 0) : on
  }

  // Every height one stands at in the dungeon on show: the floors of its buildings drawn open and, where it has one,
  // its ground. null while its buildings are being read, or before its ground has answered (its coarsest tiles are
  // in, or there are none): a floor is not chosen among half of them.
  private none = new Float32Array(0)
  private noCells = new Map<number, number[]>()
  private floors(): Floors | null {
    for (let k = 0; k < 4 ** ROOT; k++) {
      const state = this.nodes.get(keyOf(ROOT, k % 2 ** ROOT, k >> ROOT))?.state
      if (state !== 'ready' && state !== 'empty') return null
    }
    if (this.buildings.floorsAt(0, 0) === null) return null
    return {
      triangles: this.none,
      cells: this.noCells,
      also: (x, z) => this.buildings.floorsAt(x, z)!,
      ground: (x, z) => {
        const ground = this.groundAt(x, z)
        return Number.isFinite(ground) ? ground : null
      },
    }
  }

  /** Whether a height of the dungeon is on another floor than the character in it: cut away over it, or as far under it. */
  offFloor(y: number): boolean {
    return this.bare && !!this.arrow && Math.abs(y - this.arrow.y) > DUNGEON_CUT
  }

  // Where what lies on the ground at a place is put: on the ground, on the floor of the room under it as it opens, or
  // on the street over it where the ground of the game is not where one walks.
  private standAt(x: number, z: number): number {
    const ground = this.groundAt(x, z),
      floor = this.inside?.floorAt(x, z)
    // in a dungeon the floor the character stands on everywhere: the view is held at that height. With no character in it, its ground, or its main floor where it has none. Its pins lie each on its own floor (pinAt).
    if (this.bare && this.arrow) return this.arrow.y
    if (!Number.isFinite(ground)) return this.bare ? (this.buildings.dungeonFloor ?? ground) : ground
    return floor ? ground + (floor.y - ground) * floor.open : (this.streetAt(x, z) ?? ground)
  }

  /** The tiles of the ground are made again: what they must know of the inside has changed. */
  reload(): void {
    for (const n of this.nodes.values()) this.unload(n)
    this.dirty = true
  }

  /** Called at every frame while the view runs, once it is drawn: what lies over it follows. */
  onFrame: () => void = () => {}
  /** Where the character stands while it is followed, in yards: a city inside the ground is cut over its floor (buildings3d.ts). */
  character: THREE.Vector3 | null = null
  /** Where the character's arrow stands, followed or not: no leaves round it (props3d.ts). */
  arrow: THREE.Vector3 | null = null
  /** The azimuth the view keeps to by itself (the arrow's, heading up); null: left to the hand. */
  heading: number | null = null

  /**
   * Where a point of the ground is on the view, in pixels from its top left corner; how much of it
   * shows: 1 in plain sight, less in the fog, HIDDEN behind a hill, 0 behind the camera or past the
   * fog; and how far it is from the camera, in distances of the point looked at. lift: yards over
   * the ground, for what is written above its point (names3d.ts); above: over the ground also where a
   * room under it is open, as the name of a city in a mountain is. high: a height of its own, in
   * yards, whatever the ground there (a flight's arc, pins3d.ts; a pin of a dungeon on its floor: under
   * the ground, which is open over the rooms, it is seen through the opening, not hidden by it).
   */
  spot(x: number, z: number, lift = 0, above = false, high?: number): { x: number; y: number; shows: number; away: number } {
    const fog = this.scene.fog as THREE.Fog,
      out = Math.hypot(x - this.camera.position.x, z - this.camera.position.z) >= fog.far, // past the fog: the ground is not looked for
      ground = out || high !== undefined ? NaN : above ? this.groundAt(x, z) : this.standAt(x, z),
      inRoom = !out && high === undefined && !above && (this.inside?.floorAt(x, z)?.open ?? 0) > 0.5,
      p = new THREE.Vector3(x, high ?? (Number.isFinite(ground) ? ground : 0) + lift, z),
      far = out ? Infinity : p.distanceTo(this.camera.position)
    const on = p.clone().project(this.camera),
      at = { x: ((on.x + 1) / 2) * this.width, y: ((1 - on.y) / 2) * this.height }
    const away = far / this.eye.distanceTo(this.controls.target)
    if (on.z > 1 || far >= fog.far) return { ...at, shows: 0, away }
    const clear = Math.min(1, (fog.far - far) / (fog.far - fog.near)),
      off = at.x < -OFF || at.y < -OFF || at.x > this.width + OFF || at.y > this.height + OFF // off the view: no hill looked for
    // a pin of the dungeon on its floor in a room under the ground: the ground is open over the rooms and does not hide it
    const sunk = high !== undefined && this.bare && !off && this.groundAt(x, z) > high + 2
    return { ...at, shows: off || inRoom || sunk || !this.behindHill(p) ? clear : clear * HIDDEN, away }
  }

  /** The height spot() puts a point of the ground at, in yards (0 where there is no ground). */
  heightAt(x: number, z: number, above = false): number {
    const ground = above ? this.groundAt(x, z) : this.standAt(x, z)
    return Number.isFinite(ground) ? ground : 0
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
      return o.y + d.y * t - (Number.isFinite(g) ? (this.streetAt(o.x + d.x * t, o.z + d.z * t) ?? g) : 0)
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

  /** The view's size in pixels, as last measured: reading it off the page at every frame would make the page lay itself out again. */
  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  /** Yards from the camera to the point looked at. */
  get looked(): number {
    return this.eye.distanceTo(this.controls.target)
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
    const ground = this.standAt(at.x, at.z) // where the point looked at is held (hold): a street, the floor of an open room
    this.controls.target.set(at.x, Number.isFinite(ground) ? ground : this.controls.target.y, at.z)
    this.place(at.seen / 2 / Math.tan((FOV * Math.PI) / 360), at.polar, at.azimuth)
    this.dirty = true
  }

  /** Where the camera is. */
  looking(): Look {
    const t = this.controls.target
    // From where the camera is, not from the controls: while turn() runs they still hold the angles it started from.
    const angles = new THREE.Spherical().setFromVector3(this.eye.clone().sub(t))
    return {
      x: t.x,
      z: t.z,
      seen: 2 * this.eye.distanceTo(t) * Math.tan((FOV * Math.PI) / 360),
      polar: angles.phi,
      azimuth: angles.theta,
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
    this.buildings.turn(false)
    this.props.turn(false, 'some', false)
    this.ground.dispose()
    this.controls.dispose()
    this.seen.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private place(distance: number, polar: number, azimuth: number): void {
    this.lifted = false
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSphericalCoords(distance, Math.max(polar, 1e-4), azimuth))
    this.camera.lookAt(this.controls.target)
    this.dirty = true
  }

  // The heading comes already smooth (the arrow's turn): the view keeps to it. Only from far off, as heading up is
  // turned on or the character is followed again, it goes a fifth of the way there at every frame.
  // The angles from where the camera is (looking()), not from the controls: in the frame a turn() ends they still hold
  // the ones it started from, and the view came out flat when it opened with heading up on.
  private steer(): void {
    const { polar, azimuth: a } = this.looking(),
      da = Math.atan2(Math.sin(this.heading! - a), Math.cos(this.heading! - a))
    if (Math.abs(da) < 0.0005) return
    this.place(this.eye.distanceTo(this.controls.target), polar, a + (Math.abs(da) < 0.15 ? da : da * 0.2))
  }

  private resize(): void {
    const w = this.host.clientWidth,
      h = this.host.clientHeight
    if (!w || !h) return
    this.width = w
    this.height = h
    this.renderer.setSize(w, h)
    this.renderer.getDrawingBufferSize(this.roofs.uSize.value)
    this.seen.setSize(this.roofs.uSize.value.x, this.roofs.uSize.value.y)
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
    if (this.onBefore()) this.dirty = true
    // After the arrow is turned for this frame, so the view turns with it in the same frame, not one behind.
    if (this.heading !== null && !this.turning) this.steer()
    if (this.inside?.step(this.camera.position, Math.min(0.1, FRAME_MS / 1000 + 0.004))) this.dirty = true
    // a dungeon is cut over the character in it, followed or not: the view moved by hand stays on its floor
    if (this.buildings.step(this.camera.position, this.controls.target, this.farthest(fog.far), this.height / 2 / Math.tan((FOV * Math.PI) / 360), this.bare ? this.arrow : this.character)) this.dirty = true
    if (this.props.step(this.controls.target, distance, this.arrow)) this.dirty = true
    if (this.ground.step(this.camera.position, this.controls.target.y)) this.dirty = true
    this.askStands()
    this.inside?.hidePictures(this.buildings.under)
    if (this.dirty) {
      this.dirty = false
      this.choose()
      this.draw()
      this.drawnFrom.copy(this.camera.position)
      this.compass.render()
      this.evict()
    }
    this.onFrame()
  }

  // Yards from the point looked at to the farthest ground on the view: where the looks through its four corners meet
  // the ground, taken as level as that point, or the fog; a fifth more for the hills. The same whichever way the view is turned.
  private farthest(fog: number): number {
    const c = this.camera.position,
      t = this.controls.target,
      ahead = this.camera.getWorldDirection(new THREE.Vector3()),
      ray = new THREE.Vector3()
    this.camera.updateMatrixWorld()
    let reach = 0
    for (const [x, y] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
      ray.set(x, y, 0.5).unproject(this.camera).sub(c).normalize()
      const far = Math.min(ray.y < -1e-3 ? (t.y - c.y) / ray.y : Infinity, fog / ray.dot(ahead))
      reach = Math.max(reach, Math.hypot(c.x + ray.x * far - t.x, c.z + ray.z * far - t.z))
    }
    return reach * 1.2
  }

  private draw(): void {
    const r = this.renderer
    if (this.inside?.any) {
      // What is inside, alone: no blending, the numbers as they are.
      this.roofs.uNear.value = this.camera.near
      this.roofs.uFar.value = this.camera.far
      this.roofs.uDown.value = Math.max(0.3, -this.camera.getWorldDirection(new THREE.Vector3()).y)
      this.inside.seenPass(true)
      this.sunk.visible = false
      r.setRenderTarget(this.seen)
      r.setClearColor(0x000000, 0)
      r.clear()
      r.render(this.below, this.camera)
      r.setRenderTarget(null)
      this.inside.seenPass(false)
      this.sunk.visible = true
      this.seenClear = false
    } else if (!this.seenClear) {
      r.setRenderTarget(this.seen)
      r.setClearColor(0x000000, 0)
      r.clear()
      r.setRenderTarget(null)
      this.seenClear = true
    }
    r.setClearColor(this.bare ? VOID : SKY, 1)
    r.clear()
    if (!this.seenClear) r.render(this.below, this.camera)
    r.render(this.scene, this.camera)
  }

  // The point looked at stays on the ground as it rises and falls under it, and the camera never
  // goes into the ground: it is drawn from over hills and mountains (ui.md), the controls left where they were.
  private hold(): void {
    const t = this.controls.target,
      c = this.camera.position
    const under = this.standAt(t.x, t.z)
    if (Number.isFinite(under) && Math.abs(under - t.y) > 0.05) {
      const dy = (under - t.y) * 0.2
      t.y += dy
      c.y += dy
      this.dirty = true
    }
    const below = this.standAt(c.x, c.z),
      clear = Math.max(6, c.distanceTo(t) * 0.04)
    if (Number.isFinite(below) && c.y < below + clear) {
      this.logical.copy(c)
      this.lifted = true
      c.y = below + clear
      this.camera.lookAt(t)
    }
  }

  /** The height of the ground at a point, from the finest node there that is in; NaN where none is. */
  groundAt(x: number, z: number): number {
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
    const index: number[] = [],
      pit: number[] = []
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        if (!ok(i, j) || !ok(i, j + 1) || !ok(i + 1, j) || !ok(i + 1, j + 1)) continue
        const a = i * N + j
        // A hole in the ground, the mouth of a cave or the floor of a building: dark, not the picture of the roof over it.
        ;(g.kinds[i * (N - 1) + j]! & HOLE ? pit : index).push(a, a + N, a + 1, a + 1, a + N, a + N + 1)
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
    // Near a room under the ground: each point told how much it is the roof of one, and a ground that can open.
    const roofed = this.inside?.roofOver(x0, z0, x0 + size, z0 + size)
    if (roofed) {
      const roof = new Float32Array(count)
      for (let k = 0; k < N * N; k++) roof[k] = roofed(pos[k * 3]!, pos[k * 3 + 2]!)
      ring.forEach((v, r) => (roof[N * N + r] = roof[v]!))
      ground.setAttribute('roofed', new THREE.BufferAttribute(roof, 1))
    }
    // At a block and below the picture is the block's own, and so are the ground's textures.
    const material = texture ? this.groundWith(texture, !!roofed, n.z >= BLOCK_ZOOM ? `${n.x >> (n.z - BLOCK_ZOOM)} ${n.y >> (n.z - BLOCK_ZOOM)}` : null) : this.materials.ground
    const group = new THREE.Group(),
      land = new THREE.Mesh(ground, material)
    if (roofed) land.renderOrder = -1 // see-through, yet before everything else that is: the ground is under it all
    group.add(land)
    if (pit.length) {
      const dark = new THREE.BufferGeometry()
      dark.setAttribute('position', ground.getAttribute('position'))
      dark.setIndex(pit)
      const hole = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(dark, this.materials.pit)
      if (roofed) {
        dark.setAttribute('roofed', ground.getAttribute('roofed'))
        hole.material = this.materials.openPit
        hole.renderOrder = -1
      }
      group.add(hole)
    }

    // Liquids: a square a liquid, at the levels of its corners, grouped by kind. In a dungeon, none over a room under
    // the ground: the ground opens over it, and the water left there would hide it (the sea over Deadmines).
    const drained = this.bare && roofed ? (a: number): boolean => [a, a + 1, a + N, a + N + 1].some((c) => roofed(pos[c * 3]!, pos[c * 3 + 2]!) >= 1) : null
    const lpos = new Float32Array(N * N * 3),
      byKind: number[][] = [[], [], [], [], []],
      wet = new Uint8Array(N * N) // the points of the squares of water
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) lpos.set([x0 + j * step, Number.isFinite(g.water[i * N + j]!) ? g.water[i * N + j]! : 0, z0 + i * step], (i * N + j) * 3)
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const kind = g.kinds[i * (N - 1) + j]! & ~HOLE,
          a = i * N + j
        // A square with no ground: open sea, at 0. Not in a dungeon, which ends where its ground does.
        if (!ok(i, j) || !ok(i, j + 1) || !ok(i + 1, j) || !ok(i + 1, j + 1)) {
          if (this.bare) continue
          for (const c of [a, a + 1, a + N, a + N + 1]) lpos[c * 3 + 1] = 0
          ;((low = Math.min(low, 0)), (high = Math.max(high, 0)))
          byKind[4]!.push(a, a + N, a + 1, a + 1, a + N, a + N + 1)
          continue
        }
        if (kind === DRY || kind > TAR || drained?.(a)) continue
        const corners = [a, a + 1, a + N, a + N + 1].map((c) => g.water[c]!)
        if (!corners.every(Number.isFinite)) continue
        high = Math.max(high, ...corners)
        byKind[kind - 1]!.push(a, a + N, a + 1, a + 1, a + N, a + N + 1)
        if (kind === 1) for (const c of [a, a + 1, a + N, a + N + 1]) wet[c] = 1
      }
    }
    // The shore: a dry square beside water, with ground lower than that water, has it too. The water then ends where
    // it meets the ground and not at the side of a square, which from far is a flight of steps along the coast.
    const shore: number[] = []
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const a = i * N + j,
          corners = [a, a + 1, a + N, a + N + 1]
        if ((g.kinds[i * (N - 1) + j]! & ~HOLE) !== DRY || !corners.every((c) => Number.isFinite(h[c]!)) || drained?.(a)) continue
        const level = Math.max(...corners.map((c) => (wet[c] ? lpos[c * 3 + 1]! : -Infinity)))
        if (corners.some((c) => h[c]! < level)) shore.push(a, level)
      }
    }
    for (let s = 0; s < shore.length; s += 2) {
      const a = shore[s]!
      for (const c of [a, a + 1, a + N, a + N + 1]) if (!wet[c]) lpos[c * 3 + 1] = shore[s + 1]!
      high = Math.max(high, shore[s + 1]!)
      byKind[0]!.push(a, a + N, a + 1, a + 1, a + N, a + N + 1)
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
    if (this.bare) return new THREE.Group()
    return new THREE.Group().add(new THREE.Mesh(geo, this.materials.liquids[4]))
  }

  // The ground's material with a picture: one a picture, shared by the nodes that use it; and one more where the ground can open over a room.
  // block: the block the picture is the whole of, which then has its own textures up close (ground3d.ts).
  private withPicture = new WeakMap<THREE.Texture, THREE.MeshLambertMaterial>()
  private withRoof = new WeakMap<THREE.Texture, THREE.MeshLambertMaterial>()
  private groundWith(texture: THREE.Texture, opens: boolean, block: string | null): THREE.MeshLambertMaterial {
    const kept = opens ? this.withRoof : this.withPicture
    let m = kept.get(texture)
    if (!m) {
      kept.set(texture, (m = new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide, transparent: opens })))
      if (opens || block) {
        m.onBeforeCompile = (shader) => {
          if (block) this.ground.into(shader, block)
          if (opens) this.opening(shader)
        }
        // the two say what the program is: the function above reads the same for every material
        m.customProgramCacheKey = () => `${block ? 'ground' : ''} ${opens ? 'opens' : ''}`
      }
    }
    return m
  }

  // The ground that opens over a room: see-through where a room is behind it on the screen and it is that room's
  // roof, which is the ground over the room seen from above (roofed), or no farther before it than the ground the
  // room has over it, seen aslant, and a margin. Any other ground in front lets the room through as a ghost.
  private opening(shader: THREE.WebGLProgramParametersWithUniforms): void {
    Object.assign(shader.uniforms, this.roofs)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float roofed;\nvarying float vRoofed;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoofed = roofed;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uSeen, uSeenDepth;\nuniform vec2 uSize;\nuniform float uNear, uFar, uDown;\nvarying float vRoofed;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        vec2 at = gl_FragCoord.xy / uSize;
        vec4 behind = texture2D(uSeen, at);
        float gap = uNear * uFar / (uFar - texture2D(uSeenDepth, at).x * (uFar - uNear)) - vViewPosition.z;
        float reach = ${ROOF_MARGIN.toFixed(1)} + behind.r * ${(255 * ROOF_STEP).toFixed(1)} / uDown;
        float roof = max(1.0 - smoothstep(reach, reach + ${(ROOF_MARGIN / 2).toFixed(1)}, gap), vRoofed);
        gl_FragColor.a *= 1.0 - behind.a * mix(${ROOF_GHOST.toFixed(2)}, ${(1 - ROOF_KEPT).toFixed(2)}, roof);
        if (gl_FragColor.a < 0.02) discard;`,
      )
  }

  // Past KEPT, the nodes and pictures not on show the longest go from the graphics card.
  private evict(): void {
    const held = [...this.nodes.values()].filter((n) => n.group && n.used < this.frame)
    if (held.length > KEPT) for (const n of held.sort((a, b) => a.used - b.used).slice(0, held.length - KEPT)) this.unload(n)
    const inUse = new Set([...this.nodes.values()].filter((n) => n.group).map((n) => n.picture))
    for (const [key, p] of this.pictures) {
      if (inUse.has(key) || p.used >= this.frame || !p.made) continue
      this.withPicture.get(p.made)?.dispose()
      this.withRoof.get(p.made)?.dispose()
      p.made.dispose()
      this.pictures.delete(key)
    }
    for (const [key, b] of this.blocks) if (this.frame - b.used > 600) this.blocks.delete(key)
  }
}
