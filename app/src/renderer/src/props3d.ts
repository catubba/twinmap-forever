// The trees and objects of the continent on show in the 3D view (M23-F7), as main/props.ts makes them from the game's
// M2 models: the copies of the blocks near the point looked at are loaded, and each model's copies are drawn together
// (one instanced mesh a piece). Turned on and off in Settings > Graphics (graphics.svelte.ts): trees, with how many of
// them, and objects. The user's choices on the prototype design/props/ (design/ROADMAP.md, M23-F6): trees are scenery,
// never in the way of the ground, the roads or the character, so the woods are thinned (main/props.ts) and no leaves are
// drawn within LEAVES yards of the character. The copies of a building inside the ground (Ironforge, Undercity, a mine:
// M23-F17) are drawn as their building is (buildings3d.ts): before the ground, cut at the height its plane is at, and
// not at all while it is not on show.
import * as THREE from 'three'
import { decodeDxtCutout } from '../../shared/blp'
import { DXT_KIND, type TexKind } from '../../shared/buildings'
import { COPY, KEPT_BITS, type Density, type PropBlocks, type PropHead, type PropPiece } from '../../shared/props'
import { BLOCK_YARDS } from '../../shared/world'
import { inflated } from './terrain3d'
import { TILES } from './web'

/** Yards from the camera to the point looked at past which nothing is shown: from farther a tree is a few pixels. */
const FAR_VIEW = 1600
/** Yards from the point looked at within which a block's copies are loaded: at least NEAR, more as the view widens, at most FAR. */
const NEAR = 700
const FAR = 1200
const LOADING = 4
/** Models kept on the graphics card with no copy on show. */
const KEPT = 150
const RETRY = 30
/** Yards round the character (or the point looked at) without leaves, the trunks kept: the user's choice in M23-F6. */
const LEAVES = 60

const FORMATS = { dxt1: THREE.RGB_S3TC_DXT1_Format, dxt1a: THREE.RGBA_S3TC_DXT1_Format, dxt3: THREE.RGBA_S3TC_DXT3_Format, dxt5: THREE.RGBA_S3TC_DXT5_Format } as const

interface Model {
  state: 'loading' | 'in' | 'none'
  tree?: boolean
  meshes?: THREE.InstancedMesh[]
  matrices?: THREE.InstancedBufferAttribute
  textures?: number[]
  /** Its copies in buildings inside the ground: drawn apart, each cut at its building's height (cut), from where its building stands (at). */
  under?: { meshes: THREE.InstancedMesh[]; matrices: THREE.InstancedBufferAttribute; cut: THREE.InstancedBufferAttribute; at: number[] }
  used: number
}
/** The copies of a block: of each model, COPY floats a copy (main/props.ts). */
type Block = Map<number, Float32Array> | 'loading' | 'none'

export class Props {
  readonly group = new THREE.Group()
  private folder = ''
  private list: Set<string> | null = null
  private asked = -Infinity
  private blocks = new Map<string, Block>()
  private shown = new Set<string>() // the blocks wanted, by "column-row"
  private wanted = new Set<number>() // the models of their copies
  private models = new Map<number, Model>()
  private textures = new Map<number, { texture: Promise<THREE.Texture | null>; users: number }>()
  private loading = 0
  private frame = 0
  private trees = true
  private objects = true
  private density: Density = 'some'
  private dirty = false // the copies drawn must be chosen again
  private changed = false // the view must be drawn again
  private from = new THREE.Vector3(Infinity, 0, 0)
  private readonly center = { value: new THREE.Vector3() }

  /** cutAt: the height a building inside the ground is cut at now, null when it is not on show (Buildings.cutAt). */
  constructor(
    private renderer: THREE.WebGLRenderer,
    private cutAt: (x: number, z: number) => number | null,
  ) {}

  /** The continent shown, by its folder. */
  show(folder: string): void {
    if (folder === this.folder) return
    this.clear()
    this.folder = folder
    this.list = null
    this.asked = -Infinity
  }

  /** What is drawn: trees (and how many of them), objects. */
  turn(trees: boolean, density: Density, objects: boolean): void {
    if (trees === this.trees && density === this.density && objects === this.objects) return
    ;[this.trees, this.density, this.objects] = [trees, density, objects]
    if (!trees && !objects) this.clear()
    this.from.set(Infinity, 0, 0)
    this.dirty = this.changed = true
  }

  /** At each frame: the point looked at, the camera's distance from it, and where the character's arrow stands. True when the view must be drawn again. */
  step(target: THREE.Vector3, distance: number, arrow: THREE.Vector3 | null): boolean {
    this.frame++
    const leaves = arrow ?? target
    if (this.center.value.distanceToSquared(leaves) > 0.25) {
      this.center.value.copy(leaves)
      this.changed = true
    }
    let changed = this.changed
    this.changed = false
    if ((!this.trees && !this.objects) || !this.folder) return changed
    if (!this.list) {
      const now = performance.now() / 1000
      if (now - this.asked > RETRY) {
        this.asked = now
        const folder = this.folder
        void fetch(`${TILES}/${folder}/props.json`)
          .then((a) => (a.status === 200 ? (a.json() as Promise<PropBlocks>) : null))
          .catch(() => null)
          .then((list) => {
            if (folder !== this.folder || !list) return
            this.list = new Set(list.blocks)
            this.from.set(Infinity, 0, 0)
          })
      }
      return changed
    }
    const reach = distance > FAR_VIEW ? 0 : Math.min(FAR, Math.max(NEAR, distance * 1.2))
    if (Math.hypot(this.from.x - target.x, this.from.z - target.z) >= 40 || Math.abs(this.from.y - reach) >= 1) {
      this.from.set(target.x, reach, target.z)
      // the blocks whose square comes within reach of the point looked at
      const wanted = new Set<string>()
      if (reach)
        for (let c = Math.floor((target.x - reach) / BLOCK_YARDS); c <= Math.floor((target.x + reach) / BLOCK_YARDS); c++)
          for (let r = Math.floor((target.z - reach) / BLOCK_YARDS); r <= Math.floor((target.z + reach) / BLOCK_YARDS); r++) {
            const dx = Math.max(c * BLOCK_YARDS - target.x, 0, target.x - (c + 1) * BLOCK_YARDS), dz = Math.max(r * BLOCK_YARDS - target.z, 0, target.z - (r + 1) * BLOCK_YARDS)
            if (Math.hypot(dx, dz) < reach && this.list.has(`${c}-${r}`)) wanted.add(`${c}-${r}`)
          }
      if (wanted.size !== this.shown.size || [...wanted].some((k) => !this.shown.has(k))) {
        this.shown = wanted
        for (const k of this.blocks.keys()) if (!wanted.has(k)) this.blocks.delete(k)
        this.dirty = true
      }
    }
    for (const k of this.shown) if (!this.blocks.has(k)) this.loadBlock(k)
    for (const file of this.wanted) if (!this.models.has(file)) this.want(file)
    if (this.dirty) {
      this.dirty = false
      this.choose()
      changed = true
    }
    return this.cut() || changed
  }

  // The copies inside the ground cut where their buildings are; true when one has moved.
  private cut(): boolean {
    let moved = false
    for (const m of this.models.values()) {
      const u = m.under
      if (!u || !u.meshes[0]!.count) continue
      const a = u.cut.array as Float32Array
      let shown = false
      for (let i = 0; i < u.meshes[0]!.count; i++) {
        const h = this.cutAt(u.at[i * 2]!, u.at[i * 2 + 1]!) ?? -1e9
        shown ||= h > -1e9
        if (Math.abs(a[i]! - h) < 0.05) continue
        a[i] = h
        moved = true
      }
      if (moved) u.cut.needsUpdate = true
      for (const mesh of u.meshes) mesh.visible = shown
    }
    return moved
  }

  // A block's copies, a few at a time.
  private loadBlock(key: string): void {
    if (this.loading >= LOADING) return
    this.blocks.set(key, 'loading')
    this.loading++
    const folder = this.folder
    void inflated(`${TILES}/${folder}/props/${key}.bin`)
      .then((b) => {
        if (folder !== this.folder || this.blocks.get(key) !== 'loading') return
        if (!b) return void this.blocks.set(key, 'none')
        const view = new DataView(b.buffer, b.byteOffset, b.byteLength), byModel = new Map<number, Float32Array>()
        for (let k = 0, at = 4; k < view.getUint32(0, true); k++) {
          const file = view.getUint32(at, true), count = view.getUint32(at + 4, true)
          byModel.set(file, new Float32Array(b.buffer.slice(b.byteOffset + at + 8, b.byteOffset + at + 8 + count * COPY * 4)))
          at += 8 + count * COPY * 4
        }
        this.blocks.set(key, byModel)
      })
      .catch(() => this.blocks.set(key, 'none'))
      .finally(() => {
        this.loading--
        this.dirty = true
      })
  }

  // The copies drawn of each model: those of the blocks in, as trees and objects are turned and trees thinned.
  private choose(): void {
    const bit = KEPT_BITS[this.density], copies = new Map<number, Float32Array[]>()
    for (const k of this.shown) {
      const b = this.blocks.get(k)
      if (b instanceof Map) for (const [file, list] of b) (copies.get(file) ?? copies.set(file, []).get(file)!).push(list)
    }
    this.wanted = new Set(copies.keys())
    for (const [file, m] of this.models) {
      if (m.state !== 'in') continue
      const lists = copies.get(file) ?? []
      const show = m.tree ? this.trees : this.objects
      // in the open, and in buildings inside the ground (their x not a number when not)
      const open: number[] = [], under: number[] = []
      if (show) for (const l of lists) for (let i = 0; i < l.length; i += COPY) if (!m.tree || (l[i + 12]! & bit)) (Number.isNaN(l[i + 13]!) ? open : under).push(i, lists.indexOf(l))
      m.matrices = this.fill(m.meshes!, m.matrices!, lists, open)
      if (under.length) m.under ??= this.underOf(m)
      if (m.under) {
        m.under.matrices = this.fill(m.under.meshes, m.under.matrices, lists, under)
        m.under.at = []
        for (let k = 0; k < under.length; k += 2) m.under.at.push(lists[under[k + 1]!]![under[k]! + 13]!, lists[under[k + 1]!]![under[k]! + 14]!)
        if (m.under.cut.count < under.length / 2) {
          m.under.cut = new THREE.InstancedBufferAttribute(new Float32Array(m.under.matrices.count), 1)
          for (const mesh of m.under.meshes) mesh.geometry.setAttribute('cut', m.under.cut)
        }
        ;(m.under.cut.array as Float32Array).fill(-1e9)
        m.under.cut.needsUpdate = true
      }
      if (open.length || under.length) m.used = this.frame
    }
    this.evict()
  }

  // The copies given (their start and list, two numbers each) into the matrices of the meshes, grown when they do not fit: the matrices then.
  private fill(meshes: THREE.InstancedMesh[], matrices: THREE.InstancedBufferAttribute, lists: Float32Array[], copies: number[]): THREE.InstancedBufferAttribute {
    const n = copies.length / 2
    if (n > matrices.count) {
      matrices = new THREE.InstancedBufferAttribute(new Float32Array(Math.ceil(n * 1.25) * 16), 16)
      for (const mesh of meshes) mesh.instanceMatrix = matrices
    }
    const a = matrices.array as Float32Array
    for (let k = 0; k < n; k++) {
      const l = lists[copies[k * 2 + 1]!]!, i = copies[k * 2]!
      // a 3 x 4 matrix column by column into a 4 x 4 one
      a.set([l[i]!, l[i + 1]!, l[i + 2]!, 0, l[i + 3]!, l[i + 4]!, l[i + 5]!, 0, l[i + 6]!, l[i + 7]!, l[i + 8]!, 0, l[i + 9]!, l[i + 10]!, l[i + 11]!, 1], k * 16)
    }
    matrices.needsUpdate = true
    for (const mesh of meshes) {
      mesh.count = n
      mesh.visible = n > 0
      mesh.boundingSphere = null
      if (n) mesh.computeBoundingSphere()
    }
    return matrices
  }

  // A model's meshes for its copies inside the ground: its geometries with a height to cut at by copy, its materials
  // cutting there, drawn before the ground as the buildings inside it.
  private underOf(m: Model): NonNullable<Model['under']> {
    const matrices = new THREE.InstancedBufferAttribute(new Float32Array(16), 16), cut = new THREE.InstancedBufferAttribute(new Float32Array(1), 1)
    const meshes = m.meshes!.map((mesh) => {
      const g = new THREE.BufferGeometry()
      for (const [name, a] of Object.entries(mesh.geometry.attributes)) g.setAttribute(name, a)
      g.setIndex(mesh.geometry.index)
      g.setAttribute('cut', cut)
      const material = (mesh.material as THREE.Material).clone()
      const before = material.onBeforeCompile
      material.onBeforeCompile = (shader, r) => {
        before.call(material, shader, r)
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float cut;\nvarying float vCut;\nvarying float vHigh;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvCut = cut;\nvHigh = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;')
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vCut;\nvarying float vHigh;')
          .replace('void main() {', 'void main() {\n  if (vHigh > vCut) discard;')
      }
      material.customProgramCacheKey = () => 'cut ' + (m.tree ? 'tree' : '')
      const under = new THREE.InstancedMesh(g, material, 0)
      under.instanceMatrix = matrices
      under.renderOrder = -2
      this.group.add(under)
      return under
    })
    return { meshes, matrices, cut, at: [] }
  }

  // A model wanted: read when it is not, a few at a time.
  private want(file: number): void {
    const m = this.models.get(file)
    if (m) return void (m.used = this.frame)
    if (this.loading >= LOADING) return
    const model: Model = { state: 'loading', used: this.frame }
    this.models.set(file, model)
    this.loading++
    const folder = this.folder
    void this.load(file)
      .then((made) => {
        if (folder !== this.folder || this.models.get(file) !== model) return made && this.dispose(made)
        if (!made) return void (model.state = 'none')
        Object.assign(model, made, { state: 'in' })
        for (const mesh of made.meshes) this.group.add(mesh)
      })
      .catch(() => (model.state = 'none'))
      .finally(() => {
        this.loading--
        this.dirty = true
      })
  }

  // Past KEPT, the models with no copy on show go from the graphics card, those unused the longest first.
  private evict(): void {
    const idle = [...this.models].filter(([, m]) => m.state === 'in' && m.used < this.frame).sort((a, b) => a[1].used - b[1].used)
    for (const [file, m] of idle.slice(0, Math.max(0, idle.length - KEPT))) {
      this.dispose(m as Required<Model>)
      this.models.delete(file)
    }
  }

  private dispose(m: Pick<Required<Model>, 'meshes' | 'textures'> & Pick<Model, 'under'>): void {
    for (const mesh of m.under?.meshes ?? []) {
      this.group.remove(mesh)
      ;(mesh.material as THREE.Material).dispose()
    }
    for (const mesh of m.meshes) {
      this.group.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    for (const id of m.textures) {
      const t = this.textures.get(id)
      if (t && --t.users <= 0) {
        void t.texture.then((x) => x?.dispose())
        this.textures.delete(id)
      }
    }
  }

  private clear(): void {
    for (const m of this.models.values()) if (m.state === 'in') this.dispose(m as Required<Model>)
    this.models.clear()
    this.blocks.clear()
    this.shown.clear()
    this.wanted.clear()
    this.from.set(Infinity, 0, 0)
  }

  // A model's file: a mesh a piece, all sharing the matrices of the copies.
  private async load(file: number): Promise<Pick<Required<Model>, 'tree' | 'meshes' | 'matrices' | 'textures'> | null> {
    const b = await inflated(`${TILES}/buildings/m2/${file}.bin`)
    if (!b) return null
    const length = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(0, true)
    const head = JSON.parse(new TextDecoder().decode(b.subarray(4, 4 + length))) as PropHead
    let at = b.byteOffset + 4 + Math.ceil(length / 4) * 4
    const matrices = new THREE.InstancedBufferAttribute(new Float32Array(16), 16), meshes: THREE.InstancedMesh[] = [], textures: number[] = []
    for (const p of head.pieces) {
      const points = new THREE.InterleavedBuffer(new Float32Array(b.buffer, at, p.points * 8), 8)
      at += p.points * 32
      const index = new Uint16Array(b.buffer, at, p.indices)
      at += Math.ceil(p.indices / 2) * 4
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.InterleavedBufferAttribute(points, 3, 0))
      g.setAttribute('normal', new THREE.InterleavedBufferAttribute(points, 3, 3))
      g.setAttribute('uv', new THREE.InterleavedBufferAttribute(points, 2, 6))
      g.setIndex(new THREE.BufferAttribute(index, 1))
      if (p.texture) textures.push(p.texture)
      const mesh = new THREE.InstancedMesh(g, this.material(p, head.tree, p.texture ? await this.texture(p.texture, p.kind) : null), 0)
      mesh.instanceMatrix = matrices
      if (p.blend >= 2 || p.opacity < 0.99) mesh.renderOrder = 1
      meshes.push(mesh)
    }
    return { tree: head.tree, meshes, matrices, textures }
  }

  // A texture, once for all the models that use it: DXT as the game keeps it where the card reads it, else its pixels; or a PNG.
  private texture(id: number, kind: TexKind): Promise<THREE.Texture | null> {
    const kept = this.textures.get(id)
    if (kept) {
      kept.users++
      return kept.texture
    }
    const texture = (async (): Promise<THREE.Texture | null> => {
      let t: THREE.Texture
      if (kind === 'png') {
        const answer = await fetch(`${TILES}/buildings/tex/${id}.png`)
        if (!answer.ok) return null
        t = new THREE.Texture(await createImageBitmap(await answer.blob()))
        t.flipY = false
        t.generateMipmaps = true
      } else {
        const b = await inflated(`${TILES}/buildings/tex/${id}.bin`)
        if (!b || !(kind in FORMATS)) return null
        const view = new DataView(b.buffer, b.byteOffset, b.byteLength), levels: { width: number; height: number; data: Uint8Array }[] = []
        for (let k = 0, at = 4; k < view.getUint32(0, true); k++) {
          const width = view.getUint32(at, true), height = view.getUint32(at + 4, true), size = view.getUint32(at + 8, true)
          levels.push({ width, height, data: b.subarray(at + 12, at + 12 + size) })
          at += 12 + size
        }
        const { width, height } = levels[0]!, k = kind as keyof typeof FORMATS
        if (this.renderer.extensions.has('WEBGL_compressed_texture_s3tc')) t = new THREE.CompressedTexture(levels as unknown as ImageData[], width, height, FORMATS[k])
        else {
          // a card that does not read DXT (a phone): the first level's pixels, the smaller ones made by the card
          t = new THREE.DataTexture(decodeDxtCutout(levels[0]!.data, width, height, DXT_KIND[k]!, k === 'dxt1a'), width, height)
          t.generateMipmaps = true
          t.minFilter = THREE.LinearMipmapLinearFilter
        }
      }
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      t.needsUpdate = true
      return t
    })().catch(() => null)
    this.textures.set(id, { texture, users: 1 })
    return texture
  }

  // A piece's material, lit by the sun of the view or by itself, blended as the game says; a tree's leaves open round the character.
  private material(p: PropPiece, tree: boolean, t: THREE.Texture | null): THREE.Material {
    const added = p.blend === 3 || p.blend === 4 || p.blend === 7, blended = p.blend === 2 || p.blend === 5 || p.blend === 6
    const o: THREE.MeshLambertMaterialParameters = {
      color: t ? 0xffffff : 0x8a8070,
      map: t,
      side: p.flags & 4 ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: p.blend === 1 ? 0.5 : 0,
      opacity: p.opacity,
      transparent: added || blended || p.opacity < 0.99,
      depthWrite: p.blend <= 1,
      blending: added ? THREE.AdditiveBlending : THREE.NormalBlending,
    }
    const m = p.flags & 1 ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o)
    if (tree && p.blend === 1) {
      // no leaves within LEAVES yards of the character, flat, above its feet
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uLeaves = this.center
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;')
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;\nuniform vec3 uLeaves;')
          .replace('void main() {', `void main() {\n  if (distance(vWorld.xz, uLeaves.xz) < ${LEAVES.toFixed(1)} && vWorld.y > uLeaves.y + 2.0) discard;`)
      }
      m.customProgramCacheKey = () => 'leaves'
    }
    return m
  }
}
