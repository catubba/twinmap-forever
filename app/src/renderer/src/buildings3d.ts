// The buildings of the continent on show in the 3D view (M23-F2), as main/buildings.ts makes them from the game's
// files: each file read once and drawn at every place it stands, with the game's own textures. Those near the point
// looked at are loaded, the others go. Turned on and off in Settings > Graphics (graphics.svelte.ts).
import * as THREE from 'three'
import { decodeDxtCutout } from '../../shared/blp'
import { DXT_KIND, type BuildingHead, type Draw, type Placed } from '../../shared/buildings'
import { inflated } from './terrain3d'
import { TILES } from './web'

/** Yards from the camera to the point looked at past which no building is shown. */
// ponytail: near only, all of them or none; F3 loads them by blocks with a poorer version far away.
const FAR_VIEW = 2500
/** Yards from the point looked at to the nearest of a building within which it is loaded: at least this, more as the view widens. */
const NEAR = 700
const LOADING = 2
/** Building files kept on the graphics card with no building on show. */
const KEPT = 40
/** A building with no texture, or one not read: the stone of the prototype's walls. */
const STONE = 0x9a8f80
/** Seconds before the list of a continent is asked again, while the app is still making it. */
const RETRY = 30

const FORMATS = { dxt1: THREE.RGB_S3TC_DXT1_Format, dxt1a: THREE.RGBA_S3TC_DXT1_Format, dxt3: THREE.RGBA_S3TC_DXT3_Format, dxt5: THREE.RGBA_S3TC_DXT5_Format } as const

interface File {
  state: 'loading' | 'in' | 'none'
  geometry?: THREE.BufferGeometry
  materials?: THREE.Material[]
  textures?: THREE.Texture[]
  used: number
}

export class Buildings {
  readonly group = new THREE.Group()
  private folder = ''
  private list: Placed | null = null
  private asked = 0 // when the list was last asked for, in seconds
  private files = new Map<number, File>()
  private shown = new Map<number, THREE.Mesh>() // by the building's place in the list
  private loading = 0
  private frame = 0
  private on = true
  private changed = false
  private from = new THREE.Vector3(Infinity, 0, 0) // where the choice was last made

  constructor(private renderer: THREE.WebGLRenderer) {}

  /** The continent shown, by its folder. */
  show(folder: string): void {
    if (folder === this.folder) return
    this.clear()
    this.folder = folder
    this.list = null
    this.asked = 0
  }

  /** Whether they are drawn at all. */
  turn(on: boolean): void {
    if (on === this.on) return
    this.on = on
    if (!on) this.clear()
    this.from.set(Infinity, 0, 0)
    this.changed = true
  }

  /** At each frame, with the point looked at and the camera's distance from it: true when the view must be drawn again. */
  step(target: THREE.Vector3, distance: number): boolean {
    this.frame++
    const changed = this.changed
    this.changed = false
    if (!this.on || !this.folder) return changed
    if (!this.list) {
      const now = performance.now() / 1000
      if (now - this.asked > RETRY) {
        this.asked = now
        const folder = this.folder
        void fetch(`${TILES}/${folder}/buildings.json`)
          .then((a) => (a.ok ? (a.json() as Promise<Placed>) : null))
          .catch(() => null)
          .then((list) => {
            if (folder !== this.folder || !list) return
            this.list = list
            this.from.set(Infinity, 0, 0)
          })
      }
      return changed
    }
    // chosen again once the point looked at has moved a little, or the view has widened
    const reach = distance > FAR_VIEW ? 0 : Math.max(NEAR, distance * 1.5)
    if (Math.hypot(this.from.x - target.x, this.from.z - target.z) < 40 && Math.abs(this.from.y - reach) < 1) return changed
    this.from.set(target.x, reach, target.z)
    const wanted = new Set<number>()
    if (reach)
      this.list.placed.forEach(([file, x, , z, , scale], i) => {
        if (Math.hypot(x - target.x, z - target.z) - (this.list!.radius[file] ?? 0) * scale < reach) wanted.add(i)
      })
    let gone = false
    for (const [i, mesh] of this.shown)
      if (!wanted.has(i)) {
        this.group.remove(mesh)
        this.shown.delete(i)
        gone = true
      }
    for (const i of wanted) if (!this.shown.has(i)) this.want(this.list.placed[i]![0])
    this.evict()
    return this.place() || gone || changed
  }

  private clear(): void {
    for (const mesh of this.shown.values()) this.group.remove(mesh)
    this.shown.clear()
    for (const [id, f] of this.files) if (f.state === 'in') this.drop(id, f)
    this.files.clear()
    this.from.set(Infinity, 0, 0)
  }

  // A file wanted: read when it is not, a few at a time.
  private want(id: number): void {
    const f = this.files.get(id)
    if (f) return void (f.used = this.frame)
    if (this.loading >= LOADING) return
    const file: File = { state: 'loading', used: this.frame }
    this.files.set(id, file)
    this.loading++
    const folder = this.folder
    void this.load(id)
      .then((made) => {
        if (folder !== this.folder || this.files.get(id) !== file) return made?.dispose()
        if (!made) return void (file.state = 'none')
        Object.assign(file, made.parts, { state: 'in' })
        this.from.set(Infinity, 0, 0) // and the ones waiting for it are put in place
      })
      .catch(() => (file.state = 'none'))
      .finally(() => {
        this.loading--
        this.changed = true
      })
  }

  // Every wanted building whose file is in, put where it stands.
  private place(): boolean {
    if (!this.list) return false
    let added = false
    const target = this.from
    if (!Number.isFinite(target.x)) return false
    this.list.placed.forEach(([id, x, y, z, turn, scale], i) => {
      if (this.shown.has(i) || !(Math.hypot(x - target.x, z - target.z) - (this.list!.radius[id] ?? 0) * scale < target.y)) return
      const f = this.files.get(id)
      if (f?.state !== 'in') return
      f.used = this.frame
      const mesh = new THREE.Mesh(f.geometry, f.materials)
      mesh.position.set(x, y, z)
      mesh.rotation.y = turn
      mesh.scale.setScalar(scale)
      mesh.updateMatrix()
      mesh.matrixAutoUpdate = false
      this.group.add(mesh)
      this.shown.set(i, mesh)
      added = true
    })
    return added
  }

  // Past KEPT, the files of no building on show go from the graphics card, those unused the longest first.
  private evict(): void {
    const inUse = new Set([...this.shown.values()].map((m) => m.geometry))
    const idle = [...this.files].filter(([, f]) => f.state === 'in' && !inUse.has(f.geometry!)).sort((a, b) => a[1].used - b[1].used)
    for (const [id, f] of idle.slice(0, Math.max(0, idle.length - KEPT))) this.drop(id, f)
  }

  private drop(id: number, f: File): void {
    f.geometry?.dispose()
    for (const m of f.materials ?? []) m.dispose()
    for (const t of f.textures ?? []) t.dispose()
    this.files.delete(id)
  }

  // A building's file: its geometry, a material a draw, and the textures they use.
  private async load(id: number): Promise<{ parts: Pick<File, 'geometry' | 'materials' | 'textures'>; dispose: () => void } | null> {
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
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
    geometry.setAttribute('layer', new THREE.BufferAttribute(layer, 1))
    geometry.setIndex(new THREE.BufferAttribute(index, 1))
    geometry.computeBoundingSphere()
    const materials: THREE.Material[] = [],
      textures: THREE.Texture[] = []
    for (const d of head.draws) {
      geometry.addGroup(d.start, d.count, materials.length)
      const t = await this.texture(d).catch(() => null)
      if (t) textures.push(t)
      materials.push(this.material(d, t))
    }
    // Once on the graphics card, the window keeps no copy.
    for (const a of [...Object.values(geometry.attributes), geometry.index])
      (a as THREE.BufferAttribute).onUpload(function (this: THREE.BufferAttribute) {
        ;(this as { array: unknown }).array = null
      })
    return {
      parts: { geometry, materials, textures },
      dispose: () => {
        geometry.dispose()
        for (const m of materials) m.dispose()
        for (const t of textures) t.dispose()
      },
    }
  }

  // A draw's textures as one array texture (a layer each), DXT as the game keeps it where the card reads it, else its
  // pixels; or the one PNG it has; null when it has none.
  private async texture(d: Draw): Promise<THREE.Texture | null> {
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
      { width, height } = chains[0]![0]!
    if (this.renderer.extensions.has('WEBGL_compressed_texture_s3tc')) {
      const mipmaps = []
      for (let l = 0; l < count; l++) {
        const size = chains[0]![l]!.data.length,
          data = new Uint8Array(size * chains.length)
        chains.forEach((c, k) => data.set(c[l]!.data, k * size))
        mipmaps.push({ width: chains[0]![l]!.width, height: chains[0]![l]!.height, data })
      }
      return this.finish(new THREE.CompressedArrayTexture(mipmaps as unknown as ImageData[], width, height, chains.length, FORMATS[d.kind]))
    }
    // A card that does not read DXT (a phone): the first level's pixels, the smaller ones made by the card.
    const data = new Uint8Array(width * height * 4 * chains.length)
    chains.forEach((c, k) => data.set(decodeDxtCutout(c[0]!.data, width, height, DXT_KIND[d.kind]!, d.kind === 'dxt1a'), k * width * height * 4))
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
  private material(d: Draw, t: THREE.Texture | null): THREE.Material {
    const array = t instanceof THREE.CompressedArrayTexture || t instanceof THREE.DataArrayTexture
    // an array is sampled where the map is: the map a white pixel, for the texture coordinates the shader then has
    const o = { color: t ? 0xffffff : STONE, map: array ? WHITE : t, side: THREE.DoubleSide, alphaTest: d.blend === 1 ? 0.5 : 0, transparent: d.blend === 2, depthWrite: d.blend < 2 }
    const m = d.unlit ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o)
    if (!array) return m
    // the layers of the array, by the layer of each point
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uLayers = { value: t }
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float layer;\nvarying float vLayer;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvLayer = layer;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray uLayers;\nvarying float vLayer;')
        .replace('#include <map_fragment>', 'diffuseColor *= texture(uLayers, vec3(vMapUv, vLayer));')
    }
    m.customProgramCacheKey = () => 'layers'
    return m
  }
}

/** The map of a material that samples an array instead. */
const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
WHITE.needsUpdate = true
