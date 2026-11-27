// What lies inside the ground on the 3D view (M16-F13): the rooms of the caves, the mines and the
// cities dug into a mountain, as pictures laid at the height of their floors, with a low wall of
// earth round them. As the camera comes near a building its rooms are read and it opens: the ground
// that is its roof goes see-through (terrain3d.ts), and what stands in there is put on its floor.
// Away from it they go again. How it looks and every number here were chosen by the user on the
// prototype design/terrain3d/inside.html and are written in design/ui.md, section 4.
import * as THREE from 'three'
import { roomPixels, type Piece, type UnderRoom } from '../../shared/inside'
import { inflated, type Terrain } from './terrain3d'
import { TILES } from './web'

/** Yards from the camera to the nearest point of a building within which it is open; it shuts over a quarter more. */
const NEAR = 700
/** Yards the walls rise over their floor, and how light their earth is at the foot and at the top. */
const CAP = 10
const DEEP = 0.4
const RIM = 0.15
const EARTH = [0.42, 0.36, 0.29] as const // as the screen shows it
/** Yards round a room within which the ground counts as its roof, fading. */
const ROOF_EDGE = 12
/** Yards round a room within which the ground can open at all: its roof seen aslant. */
export const ROOF_REACH = 400
/** Yards between two rooms of a building that lie over one another at one height: else their pictures flicker. */
const APART = 0.3
/** Yards a floor must be over the one beside it for a wall between them: less is one hall in two pictures, each with its own height. */
const STEP = 5
/** The earth under the rooms, for the camera that has gone down among them: its colour, how far round a building it lies, the side of its squares. */
const UNDER = 0x241e18
const UNDER_ROUND = 152
const UNDER_SQUARE = 8
/** The roof of a room is told to the ground in a byte: this many yards a step. */
export const ROOF_STEP = 4

interface Room {
  piece: Piece
  floor: number
  roof: number
  y: number
}

interface Building {
  rooms: Room[]
  // Its box, in yards: x east, z south, y up.
  x0: number
  z0: number
  x1: number
  z1: number
  low: number
  high: number
  open: number
  state: 'out' | 'loading' | 'in'
  group?: THREE.Group
  // Where it has a floor and how high, a yard a cell from x0, z0; NaN where it has none.
  floors?: Float32Array
  nx?: number
  shown?: THREE.Material[]
  seen?: THREE.ShaderMaterial[]
  earth?: THREE.Mesh | null // null: looked for, and there is none
}

const reach = (p: Piece): number => Math.hypot(p.width, p.height) / 2

// A room on the picture the ground asks (terrain3d.ts): no colour, the ground over it and how open its building is.
const seenRoom = (map: THREE.Texture | null, roof: number): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, roof: { value: Math.min(1, roof / ROOF_STEP / 255) }, open: { value: 0 } },
    vertexShader: 'attribute float over; varying vec2 vUv; varying float vOver; void main() { vUv = uv; vOver = over; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float roof, open; varying vec2 vUv; varying float vOver;
      void main() {
        if (open < 0.02) discard;
        #ifdef PICTURE
        if (texture2D(map, vUv).a < 0.4) discard;
        gl_FragColor = vec4(roof, 0.0, 0.0, open);
        #else
        gl_FragColor = vec4(vOver, 0.0, 0.0, open);
        #endif
      }`,
    defines: map ? { PICTURE: 1 } : {},
    side: map ? THREE.DoubleSide : THREE.FrontSide,
  })

export class Inside3d {
  private buildings: Building[] = []
  // The ones open now: floorAt is asked for every point of every pin and line at every frame, and most of the time none is.
  private opened: Building[] = []
  private group = new THREE.Group()
  private s3tc: boolean
  private shown = ''
  private hidden = false
  private always = false

  constructor(private terrain: Terrain) {
    this.s3tc = terrain.s3tc
    terrain.under(this.group, this)
  }

  /**
   * The rooms inside the ground of the continent on show: its pieces, and which of them with their floor and roof
   * (under.json). always: of a dungeon (M23-F26), which is open from any distance: its rooms are what the view is of.
   */
  set(pieces: Piece[], under: UnderRoom[], always = false): void {
    this.always = always
    for (const b of this.buildings) this.unload(b)
    this.opened = []
    const by = new Map<number, Room[]>()
    for (const [index, floor, roof] of under) {
      const piece = pieces[index]
      if (piece) (by.get(piece.building) ?? by.set(piece.building, []).get(piece.building)!).push({ piece, floor, roof, y: floor })
    }
    this.buildings = [...by.values()].map((rooms) => {
      // Lowest first, the larger first: one over another at the same height is a little over it.
      rooms.sort((a, b) => a.floor - b.floor || b.piece.width * b.piece.height - a.piece.width * a.piece.height)
      rooms.forEach((r, i) => {
        for (const q of rooms.slice(0, i)) if (Math.abs(r.piece.u - q.piece.u) < (r.piece.width + q.piece.width) / 2 && Math.abs(r.piece.v - q.piece.v) < (r.piece.height + q.piece.height) / 2) r.y = Math.max(r.y, q.y + APART)
      })
      return {
        rooms,
        x0: Math.floor(Math.min(...rooms.map((r) => r.piece.u - reach(r.piece)))) - 1,
        z0: Math.floor(Math.min(...rooms.map((r) => r.piece.v - reach(r.piece)))) - 1,
        x1: Math.ceil(Math.max(...rooms.map((r) => r.piece.u + reach(r.piece)))) + 1,
        z1: Math.ceil(Math.max(...rooms.map((r) => r.piece.v + reach(r.piece)))) + 1,
        low: Math.min(...rooms.map((r) => r.floor)),
        high: Math.max(...rooms.map((r) => r.floor)) + 5,
        open: 0,
        state: 'out' as const,
      }
    })
    this.terrain.reload()
  }

  /**
   * For a tile of the ground from x0, z0 to x1, z1: null when no room is near enough for its ground
   * to open, else how much each of its points is the roof of a room, 1 over one, fading to 0 round it.
   */
  roofOver(x0: number, z0: number, x1: number, z1: number): ((x: number, z: number) => number) | null {
    const near = this.buildings.filter((b) => b.x0 - ROOF_REACH < x1 && b.x1 + ROOF_REACH > x0 && b.z0 - ROOF_REACH < z1 && b.z1 + ROOF_REACH > z0)
    if (!near.length) return null
    const rooms = near.flatMap((b) => b.rooms.map((r) => r.piece)).filter((p) => p.u + reach(p) + ROOF_EDGE > x0 && p.u - reach(p) - ROOF_EDGE < x1 && p.v + reach(p) + ROOF_EDGE > z0 && p.v - reach(p) - ROOF_EDGE < z1)
    const turned = rooms.map((p) => ({ p, cos: Math.cos(p.angle), sin: Math.sin(p.angle) }))
    return (x, z) => {
      let least = ROOF_EDGE
      for (const { p, cos, sin } of turned) {
        const du = x - p.u,
          dv = z - p.v
        least = Math.min(least, Math.hypot(Math.max(0, Math.abs(du * cos - dv * sin) - p.width / 2), Math.max(0, Math.abs(du * sin + dv * cos) - p.height / 2)))
        if (least === 0) return 1
      }
      return 1 - least / ROOF_EDGE
    }
  }

  /** The floor of an open room over a place, and how open its building is; null where there is none. The highest, where rooms lie over one another. */
  floorAt(x: number, z: number): { y: number; open: number } | null {
    let found: { y: number; open: number } | null = null
    for (const b of this.opened) {
      if (!b.floors || x < b.x0 || z < b.z0 || x >= b.x1 || z >= b.z1) continue
      const y = b.floors[Math.floor(z - b.z0) * b.nx! + Math.floor(x - b.x0)]!
      if (!Number.isNaN(y) && (!found || y > found.y)) found = { y, open: b.open }
    }
    return found
  }

  /** Before a frame: the buildings near the camera open, the far ones shut and go. True when the view is not as it was. */
  step(camera: THREE.Vector3, dt: number): boolean {
    let as = ''
    this.opened = []
    for (const b of this.buildings) {
      const far = Math.hypot(Math.max(b.x0 - camera.x, 0, camera.x - b.x1), Math.max(b.low - camera.y, 0, camera.y - b.high), Math.max(b.z0 - camera.z, 0, camera.z - b.z1))
      const want = this.always ? 1 : 1 - Math.min(1, Math.max(0, (far - NEAR) / (NEAR * 0.25)))
      if (want > 0 && b.state === 'out') void this.load(b)
      if (b.state !== 'in') continue
      b.open += (want - b.open) * Math.min(1, dt * 6)
      if (Math.abs(want - b.open) < 0.005) b.open = want
      if (b.open === 0 && far > NEAR * 2) {
        this.unload(b)
        continue
      }
      b.group!.visible = b.open > 0.02
      // Made once it is open: by then the ground round it is read, and tells where it is over the earth.
      if (b.open > 0.5 && b.earth === undefined) b.earth = this.earthUnder(b)
      if (b.earth) b.earth.visible = b.open > 0.5
      for (const m of b.shown!) m.opacity = b.open
      for (const m of b.seen!) m.uniforms.open!.value = b.open
      if (b.open > 0) (this.opened.push(b), (as += b.open.toFixed(3)))
    }
    const changed = as !== this.shown
    this.shown = as
    return changed
  }

  /** Whether anything of the inside is on show. */
  get any(): boolean {
    return this.shown !== ''
  }

  /** For the picture the ground asks, and back: each room and wall tells its roof instead of showing itself. */
  seenPass(on: boolean): void {
    for (const b of this.buildings) b.group?.children.forEach((c, i) => ((c as THREE.Mesh).material = (on ? b.seen! : b.shown!)[i]!))
    // the pictures left out of the view still tell the ground where to open; the walls of earth round them stay
    for (const b of this.buildings) b.group?.children.forEach((c) => c.userData.picture && (c.visible = on || !this.hidden))
  }

  /** Whether the pictures are left out of the view: the buildings are drawn whole (buildings3d.ts). */
  hidePictures(on: boolean): void {
    this.hidden = on
  }

  private async load(b: Building): Promise<void> {
    b.state = 'loading'
    const pictures = await Promise.all(b.rooms.map((r) => inflated(`${TILES}/rooms/${r.piece.file}.dxt`)))
    if (b.state !== 'loading') return
    const nx = b.x1 - b.x0,
      nz = b.z1 - b.z0,
      floors = new Float32Array(nx * nz).fill(NaN),
      group = new THREE.Group(),
      shown: THREE.Material[] = [],
      seen: THREE.ShaderMaterial[] = []
    b.rooms.forEach((r, i) => {
      const dxt = pictures[i],
        p = r.piece,
        w = p.width * 2,
        h = p.height * 2
      if (!dxt || dxt.length !== (w * h) / 2) return
      const pixels = roomPixels(dxt, w, h),
        cos = Math.cos(p.angle),
        sin = Math.sin(p.angle),
        far = reach(p)
      // Where it has a floor: the solid points of its picture.
      for (let cz = Math.floor(p.v - far - b.z0); cz <= Math.ceil(p.v + far - b.z0); cz++) {
        for (let cx = Math.floor(p.u - far - b.x0); cx <= Math.ceil(p.u + far - b.x0); cx++) {
          if (cx < 0 || cz < 0 || cx >= nx || cz >= nz) continue
          const du = b.x0 + cx + 0.5 - p.u,
            dv = b.z0 + cz + 0.5 - p.v,
            px = Math.floor((du * cos - dv * sin + p.width / 2) * 2),
            py = Math.floor((du * sin + dv * cos + p.height / 2) * 2)
          if (px >= 0 && py >= 0 && px < w && py < h && pixels[(py * w + px) * 4 + 3]! > 127) floors[cz * nx + cx] = r.floor
        }
      }
      // Its picture: as the card takes it, its shape cut out by the picture itself.
      const map = this.s3tc ? new THREE.CompressedTexture([{ data: dxt, width: w, height: h }] as unknown as ImageData[], w, h, THREE.RGBA_S3TC_DXT1_Format) : new THREE.DataTexture(new Uint8Array(pixels.buffer), w, h)
      map.colorSpace = THREE.SRGBColorSpace
      map.minFilter = map.magFilter = THREE.LinearFilter
      map.needsUpdate = true
      // Flat at its floor, its top to the north before it is turned.
      const geo = new THREE.BufferGeometry(),
        x = p.width / 2,
        z = p.height / 2
      geo.setAttribute('position', new THREE.Float32BufferAttribute([-x, 0, -z, x, 0, -z, -x, 0, z, x, 0, z], 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2))
      geo.setIndex([0, 2, 1, 1, 2, 3])
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, fog: false, opacity: 0 }))
      mesh.position.set(p.u, r.y + 0.2, p.v)
      mesh.userData.picture = true
      mesh.rotation.y = p.angle
      group.add(mesh)
      shown.push(mesh.material)
      seen.push(seenRoom(map, r.roof))
    })
    // A point with no floor and floor on three sides or four is a speck of the picture, not a pillar; one with floor on
    // two sides across is the seam between two pictures of one hall, not a wall through it: it takes the floor beside it.
    for (let cz = 1; cz < nz - 1; cz++) {
      for (let cx = 1; cx < nx - 1; cx++) {
        if (!Number.isNaN(floors[cz * nx + cx]!)) continue
        const sides = [floors[cz * nx + cx - 1]!, floors[cz * nx + cx + 1]!, floors[(cz - 1) * nx + cx]!, floors[(cz + 1) * nx + cx]!],
          round = sides.filter((f) => !Number.isNaN(f))
        if (round.length >= 3 || (round.length === 2 && Number.isNaN(sides[0]!) === Number.isNaN(sides[1]!))) floors[cz * nx + cx] = Math.min(...round)
      }
    }
    // The walls: wherever the floor ends under the ground, and from a floor to a higher one beside it. Each is
    // turned so that its front looks into the room: only those are drawn, as in a doll's house, the near ones would hide it.
    const pos: number[] = [],
      colour: number[] = [],
      over: number[] = []
    const shade = new THREE.Color()
    for (let cz = 0; cz < nz; cz++) {
      for (let cx = 0; cx < nx; cx++) {
        const f = floors[cz * nx + cx]!
        if (Number.isNaN(f)) continue
        const wx = b.x0 + cx,
          wz = b.z0 + cz
        for (const [dx, dz, ax, az, bx, bz] of [[1, 0, 1, 0, 1, 1], [-1, 0, 0, 1, 0, 0], [0, 1, 1, 1, 0, 1], [0, -1, 0, 0, 1, 0]] as const) {
          const tx = cx + dx,
            tz = cz + dz,
            next = tx < 0 || tz < 0 || tx >= nx || tz >= nz ? NaN : floors[tz * nx + tx]!
          // Past the edge of the floor: up to the ground there (taken as over it where it is not read yet). Beside a higher floor: up to it.
          const ground = Number.isNaN(next) ? this.terrain.groundAt(wx + (ax + bx) / 2, wz + (az + bz) / 2) : next,
            to = Math.min(f + CAP, Number.isNaN(ground) ? Infinity : ground)
          if (to <= f + (Number.isNaN(next) ? 0.75 : STEP)) continue
          const top = (to - f) / CAP,
            light = DEEP + (RIM - DEEP) * top * top,
            roof = Math.min(1, Math.max(0, (Number.isNaN(ground) ? CAP : ground - f) / ROOF_STEP / 255))
          pos.push(wx + ax, f, wz + az, wx + bx, f, wz + bz, wx + ax, to, wz + az, wx + ax, to, wz + az, wx + bx, f, wz + bz, wx + bx, to, wz + bz)
          for (const l of [DEEP, DEEP, light, light, DEEP, light]) colour.push(...shade.setRGB(EARTH[0] * l, EARTH[1] * l, EARTH[2] * l, THREE.SRGBColorSpace).toArray())
          for (let k = 0; k < 6; k++) over.push(roof)
        }
      }
    }
    if (pos.length) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3))
      geo.setAttribute('over', new THREE.Float32BufferAttribute(over, 1))
      const walls = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, fog: false, opacity: 0 }))
      group.add(walls)
      shown.push(walls.material)
      seen.push(seenRoom(null, 0))
    }
    group.visible = false
    this.group.add(group)
    Object.assign(b, { group, floors, nx, shown, seen, state: 'in' })
  }

  private earthUnder(b: Building): THREE.Mesh | null {
    // The earth under it: seen from in there, between one room and the next, where the sky under the ground would
    // show. Under the lowest floor of the buildings round it (under its own it would lie over the rooms of a deeper
    // one beside it), and only where the ground is over it. With the ground, not with the rooms: from outside the
    // ground hides it.
    const y = Math.min(...this.buildings.filter((o) => o.x0 - UNDER_ROUND < b.x1 && o.x1 + UNDER_ROUND > b.x0 && o.z0 - UNDER_ROUND < b.z1 && o.z1 + UNDER_ROUND > b.z0).map((o) => o.low)) - 0.6
    const under: number[] = [],
      S = UNDER_SQUARE,
      buried = (x: number, z: number): boolean => this.terrain.groundAt(x, z) > y + 2 // not where it is not read yet
    for (let z = b.z0 - UNDER_ROUND; z < b.z1 + UNDER_ROUND; z += S) {
      for (let x = b.x0 - UNDER_ROUND; x < b.x1 + UNDER_ROUND; x += S) {
        if (buried(x, z) && buried(x + S, z) && buried(x, z + S) && buried(x + S, z + S)) under.push(x, y, z, x, y, z + S, x + S, y, z, x + S, y, z, x, y, z + S, x + S, y, z + S)
      }
    }
    if (!under.length) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(under, 3))
    const earth = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: UNDER, side: THREE.DoubleSide, fog: false }))
    earth.visible = false
    this.terrain.add(earth)
    return earth
  }

  private unload(b: Building): void {
    b.state = 'out'
    b.open = 0
    b.group?.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    for (const m of b.shown ?? []) ((m as THREE.MeshBasicMaterial).map?.dispose(), m.dispose())
    for (const m of b.seen ?? []) m.dispose()
    if (b.group) this.group.remove(b.group)
    b.earth?.removeFromParent()
    b.earth?.geometry.dispose()
    ;(b.earth?.material as THREE.Material | undefined)?.dispose()
    b.group = b.floors = b.shown = b.seen = b.earth = undefined
  }
}
