// The buildings of the continent on show in the 3D view (M23-F2), as main/buildings.ts makes them from the game's
// files: each file read once and drawn at every place it stands, with the game's own textures. Turned on and off in
// Settings > Graphics (graphics.svelte.ts).
//
// Which are on show (M23-F3, shared/buildings.ts): those on the ground the view shows, round the point looked at, whose
// radius is at least SHOW_PX pixels on the view, the widest first, under a roof of memory. So near the ground every
// house is in, and from where the whole continent is seen only cities, castles and towers: a smaller one is by then
// its own picture on the ground, where the game's minimap has it painted. One that comes or goes rises from the ground
// or sinks into it, never at once. Counted on the whole of Eastern Kingdoms (design/buildings/far-measure.js): all of
// them at full detail are 8.7 million triangles, 6,500 draws and 628 MB. The poorer version of a building far away is
// its own shape with smaller textures: a file is read with its textures at most SMALL wide, and they are read again
// whole when one of its buildings is FINE_PX wide on the view.
//
// A building inside the ground (Ironforge, Undercity, a mine; M23-F16) is drawn before the ground, which is see-through
// where it is the roof of the rooms inside3d.ts opens: it is drawn without the ceilings of its rooms, and as the camera
// comes near, a level plane cuts away all of it higher than CUT yards over its main floor, or over the character's floor
// while the character is in it and followed (the user's choice on the prototype design/underground/, ROADMAP.md M23-F15
// and F16: the plane opens the cities, the ceilings left out open the mines, whose tunnels go up and down).
//
// A building of a dungeon or a raid (M23-F23, main/dungeons.ts) is drawn the same way without its ceilings, and whole:
// its floors lie hundreds of yards over one another, and no one height opens them all. With the character in it, the
// plane cuts away all of it higher than DUNGEON_CUT yards over the floor the character stands on (M23-F24), which is
// looked for among the building's own floors (shared/floors.ts).
//
// A dungeon that has a ground (M23-F26) has many buildings: those with rooms on the 2D map are drawn as above, the
// others as on a continent. Of the first, what looks down is left out in the rooms in the open too: the vault over a
// cave the game marks as open air (the bay of Deadmines) would hide all that is under it.
import * as THREE from 'three'
import { decodeDxtCutout } from '../../shared/blp'
import { DUNGEON, DXT_KIND, onShow, type BuildingHead, type Draw, type Placed } from '../../shared/buildings'
import { floorsAt, floorsOf, walkedOn, type Floors } from '../../shared/floors'
import { inflated } from './terrain3d'
import { inApp, TILES } from './web'

/** Bytes of buildings on the graphics card at most: past it the smallest on the view are left out. A phone on the home network has less room. */
// ponytail: a file read whole stays so while a building of it is on show; make it small again if the roof is felt after flying low over many places.
const ROOF = (inApp ? 400 : 128) * 2 ** 20
/** Milliseconds a building takes to rise from the ground, or to sink into it. */
const RISE = 400
/** Of the roof, how much the files of no building on show may take: a view that widens and narrows again reads nothing twice. */
const KEPT = 0.75
const LOADING = 2
/** Pixels of a building's radius on the view from which its textures are read whole, and how wide they are at most before. */
const FINE_PX = 100
const SMALL = 128
/** A building with no texture, or one not read: the stone of the prototype's walls. */
const STONE = 0x9a8f80
/** A building's own liquids, by kind (shared/water.ts: water, lava, fel, tar), as terrain3d.ts draws those of the ground: colour, and how much of what is under shows through. */
const LIQUIDS: Record<number, [number, number]> = { 1: [0x2b5f86, 0.75], 2: [0xff5a14, 0.9], 3: [0x59c832, 0.8], 4: [0x15110e, 0.9] }
/** Seconds before the list of a continent is asked again, while the app is still making it. */
const RETRY = 30
/** Yards over the floor a building inside the ground is cut at. */
const CUT = 30
/** Yards from the camera to a building inside the ground within which it is cut, as inside3d.ts opens its rooms; the cut comes down over a quarter more. */
const OPEN = 700
/** Yards over the character's floor a dungeon is cut at: lower than a city, its floors lie closer over one another (the user's choice on the prototype, design/dungeons3d). */
export const DUNGEON_CUT = 12

const FORMATS = { dxt1: THREE.RGB_S3TC_DXT1_Format, dxt1a: THREE.RGBA_S3TC_DXT1_Format, dxt3: THREE.RGBA_S3TC_DXT3_Format, dxt5: THREE.RGBA_S3TC_DXT5_Format } as const

interface File {
  state: 'loading' | 'in' | 'none'
  geometry?: THREE.BufferGeometry
  materials?: THREE.Material[]
  textures?: THREE.Texture[] // the ones that are not arrays
  layers?: ({ value: THREE.Texture } | null)[] // of each draw, its array of textures, as its materials read it
  draws?: Draw[]
  fine?: boolean // its textures whole, or being read so
  floor?: number
  walked?: Float32Array // of a dungeon's: its triangles one walks on (shared/floors.ts)
  bytes?: number // on the graphics card
  used: number
}

// A building on show: how much of it is out of the ground (0 to 1), and whether it is rising or sinking.
interface Standing {
  mesh: THREE.Mesh
  scale: number
  grown: number
  up: boolean
}

// A building inside the ground as it stands: its plane, its own materials that the plane cuts, where it is, its main floor and its top.
interface Cut {
  plane: THREE.Plane
  materials: THREE.Material[]
  x: number
  z: number
  reach: number
  floor: number
  top: number
  /** Of a dungeon: cut only over the character in it. */
  dungeon: boolean
  /** Of a dungeon: its floors where it stands. */
  floors?: Floors
}

export class Buildings {
  readonly group = new THREE.Group()
  private folder = ''
  private dungeon = false
  private list: Placed | null = null
  private asked = -Infinity // when the list was last asked for, in seconds
  private files = new Map<string, File>() // by its name in the folder (shared/buildings.ts)
  private shown = new Map<number, Standing>() // by the building's place in the list
  private wanted: number[] = [] // the ones chosen, the widest on the view first
  private sizes = new Map<string, number>() // the bytes of each file ever read: the choice counts them before it is read again
  private perRadian = 0
  private stepped = 0
  private cuts = new Map<number, Cut>() // the ones inside the ground, the same way
  private loading = 0
  private frame = 0
  private on = true
  private changed = false
  private from = new THREE.Vector3(Infinity, 0, 0) // where the camera was when the choice was last made

  constructor(private renderer: THREE.WebGLRenderer) {
    renderer.localClippingEnabled = true
  }

  /** Whether a building inside the ground is on show: its rooms are drawn whole, not as the pictures of inside3d.ts. */
  get under(): boolean {
    return this.cuts.size > 0
  }

  /** The main floor of the dungeon on show, in yards; null before its building is in. */
  get dungeonFloor(): number | null {
    for (const c of this.cuts.values()) if (c.dungeon) return c.floor
    return null
  }

  /**
   * The height a building inside the ground standing at x, z (as buildings.json has it, to the yard) is cut at now, or
   * null when it is not on show: its trees and objects are cut the same way (props3d.ts).
   */
  cutAt(x: number, z: number): number | null {
    for (const c of this.cuts.values()) if (Math.abs(c.x - x) < 1 && Math.abs(c.z - z) < 1) return c.plane.constant
    return null
  }

  /**
   * The heights of the floors under a place in the buildings of the dungeon on show, the ones drawn open; null while
   * its list or one of those chosen is still being read: a floor taken before they are all in would be kept after.
   */
  floorsAt(x: number, z: number): number[] | null {
    if (!this.list) return null
    for (const i of this.wanted) if (this.list.placed[i]![6] === DUNGEON && !this.shown.has(i) && this.files.get(this.list.placed[i]![0])?.state !== 'none') return null
    const found: number[] = []
    for (const c of this.cuts.values()) if (c.floors && Math.hypot(x - c.x, z - c.z) < c.reach) found.push(...floorsAt(c.floors, x, z))
    return found
  }

  /** The continent shown, by its folder; dungeon: a dungeon's folder, whose buildings keep their floors. */
  show(folder: string, dungeon = false): void {
    if (folder === this.folder) return
    this.clear()
    this.folder = folder
    this.dungeon = dungeon
    this.list = null
    this.asked = -Infinity
  }

  /** Whether they are drawn at all. */
  turn(on: boolean): void {
    if (on === this.on) return
    this.on = on
    if (!on) this.clear()
    this.from.set(Infinity, 0, 0)
    this.changed = true
  }

  /**
   * At each frame, with the camera, the point looked at, the yards from it to the farthest ground on the view, the
   * pixels a radian of the view, and where the character stands while it is followed (in a dungeon: while it is in it): true when the view must be drawn again.
   */
  step(camera: THREE.Vector3, target: THREE.Vector3, reach: number, perRadian: number, character: THREE.Vector3 | null): boolean {
    this.frame++
    const now = performance.now(), dt = Math.min(100, now - this.stepped)
    this.stepped = now
    const changed = this.changed
    this.changed = false
    if (!this.on || !this.folder) return changed
    if (!this.list) {
      const now = performance.now() / 1000
      if (now - this.asked > RETRY) {
        this.asked = now
        const folder = this.folder
        void fetch(`${TILES}/${folder}/buildings.json`)
          .then((a) => (a.status === 200 ? (a.json() as Promise<Placed>) : null))
          .catch(() => null)
          .then((list) => {
            if (folder !== this.folder || !list) return
            this.list = list
            this.from.set(Infinity, 0, 0)
          })
      }
      return changed
    }
    // chosen again once the camera has moved a little
    if (this.from.distanceTo(camera) > Math.max(10, reach * 0.01) || perRadian !== this.perRadian) {
      this.from.copy(camera)
      this.perRadian = perRadian
      const chosen = onShow(this.list, camera, target, reach, perRadian, (i) => !!this.shown.get(i)?.up, (file) => this.sizes.get(file) ?? 0, ROOF)
      this.wanted = chosen.map(([i]) => i)
      const wanted = new Set(this.wanted), fine = new Set(chosen.filter(([, px]) => px >= FINE_PX).map(([i]) => this.list!.placed[i]![0]))
      for (const [i, s] of this.shown) s.up = wanted.has(i)
      for (const i of this.wanted) this.want(this.list.placed[i]![0], fine)
      this.evict()
      this.place()
    }
    const risen = this.rise(dt)
    return this.cut(camera, character) || risen || changed
  }

  // Each building a step further out of the ground, or into it; one all in goes. True when one has moved.
  private rise(dt: number): boolean {
    let moved = false
    for (const [i, s] of this.shown) {
      if (s.up && s.grown === 1) continue
      moved = true
      s.grown = Math.min(1, Math.max(0, s.grown + (s.up ? dt : -dt) / RISE))
      if (!s.up && s.grown === 0) {
        this.remove(i)
        continue
      }
      s.mesh.scale.y = s.scale * Math.max(0.001, s.grown * s.grown * (3 - 2 * s.grown))
      s.mesh.updateMatrix()
    }
    return moved
  }

  private remove(i: number): void {
    this.group.remove(this.shown.get(i)!.mesh)
    this.shown.delete(i)
    for (const m of this.cuts.get(i)?.materials ?? []) m.dispose()
    this.cuts.delete(i)
  }

  // Each building inside the ground cut as the camera is near it: from over its top, far, down to CUT over its main
  // floor, or over the character's while it is in there. A dungeon is whole from anywhere, and cut DUNGEON_CUT over
  // the character in it. True when a plane has moved.
  private cut(camera: THREE.Vector3, character: THREE.Vector3 | null): boolean {
    let moved = false
    for (const c of this.cuts.values()) {
      const far = Math.max(0, Math.hypot(camera.x - c.x, camera.z - c.z) - c.reach),
        open = 1 - Math.min(1, Math.max(0, (far - OPEN) / (OPEN * 0.25))),
        inside = character && Math.hypot(character.x - c.x, character.z - c.z) < c.reach && character.y < c.top,
        to = c.dungeon ? (character ? character.y + DUNGEON_CUT : 1e6) : c.top + ((inside ? character.y : c.floor) + CUT - c.top) * open
      if (Math.abs(c.plane.constant - to) < 0.05) continue
      c.plane.constant = to
      moved = true
    }
    return moved
  }

  private clear(): void {
    for (const i of [...this.shown.keys()]) this.remove(i)
    for (const [id, f] of this.files) if (f.state === 'in') this.drop(id, f)
    this.files.clear()
    this.wanted = []
    this.from.set(Infinity, 0, 0)
  }

  // A file wanted: read when it is not, a few at a time; its textures whole if it is one of the fine, also once it is in with small ones.
  private want(id: string, fine: Set<string>): void {
    const f = this.files.get(id)
    if (f) {
      f.used = this.frame
      if (f.state === 'in' && !f.fine && fine.has(id)) this.refine(id, f)
      return
    }
    if (this.loading >= LOADING) return
    const file: File = { state: 'loading', used: this.frame, fine: fine.has(id) }
    this.files.set(id, file)
    this.loading++
    const folder = this.folder
    void this.load(id, !!file.fine)
      .then((made) => {
        if (folder !== this.folder || this.files.get(id) !== file) return made?.dispose()
        if (!made) return void (file.state = 'none')
        Object.assign(file, made.parts, { state: 'in' })
        this.sizes.set(id, made.parts.bytes!)
      })
      .catch(() => (file.state = 'none'))
      .finally(() => {
        this.loading--
        // the ones waiting for it are put in place, and the next one waiting is read: also after a file of the folder
        // shown before, or a dungeon opened while two of them were being read was never asked for until the camera moved
        this.from.set(Infinity, 0, 0)
        this.changed = true
      })
  }

  // The arrays of textures of a file in, read again whole, each put in place of the small one.
  private refine(id: string, f: File): void {
    if (this.loading >= LOADING) return
    f.fine = true
    this.loading++
    const folder = this.folder
    void Promise.all(f.draws!.map((d, k) => (f.layers![k] ? this.texture(d, true).catch(() => null) : null)))
      .then((made) => {
        const here = folder === this.folder && this.files.get(id) === f
        made.forEach((t, k) => {
          if (!t || !here) return void t?.dispose()
          const u = f.layers![k]!
          f.bytes! += weight(t) - weight(u.value)
          u.value.dispose()
          u.value = t
        })
        if (here) this.sizes.set(id, f.bytes!)
      })
      .finally(() => {
        this.loading--
        this.from.set(Infinity, 0, 0) // the next one waiting
        this.changed = true
      })
  }

  // Every wanted building whose file is in, put where it stands, all in the ground yet.
  private place(): void {
    for (const i of this.wanted) {
      const [id, x, y, z, turn, scale, buried] = this.list!.placed[i]!
      const f = this.files.get(id)
      if (f?.state !== 'in' || this.shown.has(i)) continue
      let materials = f.materials!
      if (buried) {
        // its own materials, for its own plane; drawn before the ground, which may be see-through over it
        const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6),
          reach = (this.list!.radius[id] ?? 0) * scale
        materials = materials.map((m, k) => Object.assign(m.clone(), { clippingPlanes: [plane], visible: !f.draws![k]!.ceiling, onBeforeCompile: m.onBeforeCompile, customProgramCacheKey: m.customProgramCacheKey }))
        if (buried === DUNGEON) materials.forEach(openTop)
        this.cuts.set(i, { plane, materials, x, z, reach, floor: y + (f.floor ?? 0) * scale, top: y + reach + 10, dungeon: buried === DUNGEON, ...(buried === DUNGEON && f.walked ? { floors: floorsOf(f.walked, x, y, z, turn, scale) } : {}) })
      }
      const mesh = new THREE.Mesh(f.geometry, materials)
      if (buried) mesh.renderOrder = -2
      mesh.position.set(x, y, z)
      mesh.rotation.y = turn
      mesh.scale.set(scale, scale * 0.001, scale)
      mesh.updateMatrix()
      mesh.matrixAutoUpdate = false
      this.group.add(mesh)
      this.shown.set(i, { mesh, scale, grown: 0, up: true })
    }
  }

  // Past KEPT of the roof, the files of no building on show go from the graphics card, those unused the longest first.
  private evict(): void {
    const inUse = new Set([...this.shown.values()].map((s) => s.mesh.geometry))
    const idle = [...this.files].filter(([, f]) => f.state === 'in' && !inUse.has(f.geometry!)).sort((a, b) => a[1].used - b[1].used)
    let held = 0
    for (const f of this.files.values()) held += f.bytes ?? 0
    for (let k = 0; k < idle.length && held > ROOF * KEPT; k++) {
      held -= idle[k]![1].bytes ?? 0
      this.drop(...idle[k]!)
    }
  }

  private drop(id: string, f: File): void {
    f.geometry?.dispose()
    for (const m of f.materials ?? []) m.dispose()
    for (const t of f.textures ?? []) t.dispose()
    for (const u of f.layers ?? []) u?.value.dispose()
    this.files.delete(id)
  }

  // A building's file: its geometry, a material a draw, and the textures they use, whole or small.
  private async load(id: string, fine: boolean): Promise<{ parts: Pick<File, 'geometry' | 'materials' | 'textures' | 'layers' | 'draws' | 'floor' | 'walked' | 'bytes'>; dispose: () => void } | null> {
    const b = await inflated(`${TILES}/buildings/${id}.bin`)
    if (!b) return null
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength), length = view.getUint32(0, true)
    const head = JSON.parse(new TextDecoder().decode(b.subarray(4, 4 + length))) as BuildingHead
    let at = 4 + Math.ceil(length / 4) * 4
    const n = head.vertices,
      take = <T>(make: (o: number, count: number) => T, count: number, bytes: number): T => {
        const out = make(b.byteOffset + at, count)
        at += Math.ceil((count * bytes) / 4) * 4
        return out
      }
    const position = take((o, c) => new Float32Array(b.buffer, o, c), n * 3, 4),
      uv = take((o, c) => new Float32Array(b.buffer, o, c), n * 2, 4),
      normal = take((o, c) => new Float32Array(b.buffer, o, c), n * 3, 4),
      layer = take((o, c) => new Uint8Array(b.buffer, o, c), n, 1),
      index = n < 65536 ? take((o, c) => new Uint16Array(b.buffer, o, c), head.indices, 2) : take((o, c) => new Uint32Array(b.buffer, o, c), head.indices, 4)
    // a dungeon's floors, before its points go to the graphics card and are let go here
    const walked = this.dungeon ? walkedOn(position, normal, index, head.draws) : undefined
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    // a byte a number is enough for where a wall looks: a quarter less of a building on the graphics card
    const packed = new Int8Array(n * 3)
    for (let k = 0; k < packed.length; k++) packed[k] = Math.round(normal[k]! * 127)
    geometry.setAttribute('normal', new THREE.BufferAttribute(packed, 3, true))
    geometry.setAttribute('layer', new THREE.BufferAttribute(layer, 1))
    geometry.setIndex(new THREE.BufferAttribute(index, 1))
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), head.radius) // as the file has it: from its origin
    const materials: THREE.Material[] = [],
      textures: THREE.Texture[] = [],
      layers: ({ value: THREE.Texture } | null)[] = []
    let bytes = position.byteLength + uv.byteLength + packed.byteLength + layer.byteLength + index.byteLength
    for (const d of head.draws) {
      geometry.addGroup(d.start, d.count, materials.length)
      const t = await this.texture(d, fine).catch(() => null),
        array = t instanceof THREE.CompressedArrayTexture || t instanceof THREE.DataArrayTexture
      if (t) bytes += weight(t)
      if (t && !array) textures.push(t)
      layers.push(t && array ? { value: t } : null)
      materials.push(this.material(d, t, layers.at(-1)!))
    }
    // Once on the graphics card, the window keeps no copy.
    for (const a of [...Object.values(geometry.attributes), geometry.index])
      (a as THREE.BufferAttribute).onUpload(function (this: THREE.BufferAttribute) {
        ;(this as { array: unknown }).array = null
      })
    return {
      parts: { geometry, materials, textures, layers, draws: head.draws, floor: head.floor, walked, bytes },
      dispose: () => {
        geometry.dispose()
        for (const m of materials) m.dispose()
        for (const t of textures) t.dispose()
        for (const u of layers) u?.value.dispose()
      },
    }
  }

  // A draw's textures as one array texture (a layer each), DXT as the game keeps it where the card reads it, else its
  // pixels; or the one PNG it has; null when it has none. fine: whole, else from the level at most SMALL wide.
  private async texture(d: Draw, fine: boolean): Promise<THREE.Texture | null> {
    if (d.kind === 'none' || !d.textures.length) return null
    if (d.kind === 'png') {
      const answer = await fetch(`${TILES}/buildings/tex/${d.textures[0]}.png`)
      if (!answer.ok) return null
      const t = new THREE.Texture(await createImageBitmap(await answer.blob()))
      t.flipY = false
      t.generateMipmaps = true
      return this.finish(t)
    }
    const chains = await Promise.all(
      d.textures.map(async (id) => {
        const b = await inflated(`${TILES}/buildings/tex/${id}.bin`)
        if (!b) throw new Error(`no texture ${id}`)
        const view = new DataView(b.buffer, b.byteOffset, b.byteLength),
          levels: { width: number; height: number; data: Uint8Array }[] = []
        for (let k = 0, at = 4; k < view.getUint32(0, true); k++) {
          const width = view.getUint32(at, true),
            height = view.getUint32(at + 4, true),
            size = view.getUint32(at + 8, true)
          levels.push({ width, height, data: b.subarray(at + 12, at + 12 + size) })
          at += 12 + size
        }
        return levels
      }),
    )
    const count = Math.min(...chains.map((c) => c.length)),
      small = chains[0]!.findIndex((l) => Math.max(l.width, l.height) <= SMALL),
      first = fine ? 0 : small < 0 || small >= count ? count - 1 : small,
      { width, height } = chains[0]![first]!
    if (this.renderer.extensions.has('WEBGL_compressed_texture_s3tc')) {
      const mipmaps = []
      for (let l = first; l < count; l++) {
        const size = chains[0]![l]!.data.length,
          data = new Uint8Array(size * chains.length)
        chains.forEach((c, k) => data.set(c[l]!.data, k * size))
        mipmaps.push({ width: chains[0]![l]!.width, height: chains[0]![l]!.height, data })
      }
      return this.finish(new THREE.CompressedArrayTexture(mipmaps as unknown as ImageData[], width, height, chains.length, FORMATS[d.kind]))
    }
    // A card that does not read DXT (a phone): the first level's pixels, the smaller ones made by the card.
    const data = new Uint8Array(width * height * 4 * chains.length)
    chains.forEach((c, k) => data.set(decodeDxtCutout(c[first]!.data, width, height, DXT_KIND[d.kind]!, d.kind === 'dxt1a'), k * width * height * 4))
    const t = new THREE.DataArrayTexture(data, width, height, chains.length)
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    return this.finish(t)
  }

  private finish(t: THREE.Texture): THREE.Texture {
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    t.needsUpdate = true
    return t
  }

  // A draw's material, lit by the sun of the view or by itself: as the prototype (design/terrain3d/city.html).
  private material(d: Draw, t: THREE.Texture | null, layers: { value: THREE.Texture } | null): THREE.Material {
    if (d.liquid) {
      // level and see-through, written over nothing: water shines a little, lava and fel glow by themselves
      const [color, opacity] = LIQUIDS[d.liquid] ?? LIQUIDS[1]!, o = { color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide }
      return d.unlit ? new THREE.MeshBasicMaterial(o) : new THREE.MeshPhongMaterial({ ...o, specular: 0x445566, shininess: 60 })
    }
    // an array is sampled where the map is: the map a white pixel, for the texture coordinates the shader then has
    const o = { color: t ? 0xffffff : STONE, map: layers ? WHITE : t, side: THREE.DoubleSide, alphaTest: d.blend === 1 ? 0.5 : 0, transparent: d.blend === 2, depthWrite: d.blend < 2 }
    const m = d.unlit ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o)
    if (!layers) return m
    // the layers of the array, by the layer of each point
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uLayers = layers
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float layer;\nvarying float vLayer;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvLayer = layer;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray uLayers;\nvarying float vLayer;')
        .replace('#include <map_fragment>', 'diffuseColor *= texture(uLayers, vec3(vMapUv, vLayer));')
    }
    m.customProgramCacheKey = () => 'layers'
    return m
  }
}

// A material of a dungeon's building, made to leave out what looks down: the ceilings its file does not tell apart,
// those of the rooms in the open (main/buildings.ts tells only the ones under a roof). As steep as a ceiling is there.
function openTop(m: THREE.Material): void {
  const before = m.onBeforeCompile, key = m.customProgramCacheKey()
  m.onBeforeCompile = (shader, renderer) => {
    before.call(m, shader, renderer)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vDown;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDown = normal.y;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDown;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vDown < -0.25) discard;')
  }
  m.customProgramCacheKey = () => `${key} open`
}

// The bytes of a texture on the graphics card: its blocks as they are, or its pixels and their smaller copies.
const weight = (t: THREE.Texture): number => {
  if (t instanceof THREE.CompressedArrayTexture) return t.mipmaps.reduce((n, m) => n + m.data.length, 0)
  const i = t.image as { width: number; height: number; depth?: number }
  return (i.width * i.height * (i.depth ?? 1) * 16) / 3
}

/** The map of a material that samples an array instead. */
const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
WHITE.needsUpdate = true
