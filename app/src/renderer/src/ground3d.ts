// The ground's own textures in the 3D view (M23-F8, shared/ground.ts). From far the ground is the minimap picture of
// its block, about a yard a pixel; near the camera the game's own ground textures take its place, laid and mixed as the
// game does, and fade back into it farther away. A continent's textures are one pile on the graphics card (DXT1, some
// 12 MB), read once; a block's layers and mixes (4 MB) are read when the camera comes near it and let go when it has
// left. Both are made by the app the first time they are asked for (main/ground.ts).
import * as THREE from 'three'
import { decodeDxt } from '../../shared/blp'
import { LEVELS, levelBytes, MIX_SIDE, NONE, PIECES, pileLevel, REPEATS, TEXTURE, unpackGround } from '../../shared/ground'
import { BLOCK_YARDS } from '../../shared/world'
import { inflated } from './terrain3d'
import { TILES } from './web'

/** Yards from the camera: nearer than the first the ground is its own textures, past the second the minimap. */
const FROM = 250,
  TO = 400
/** Yards from the camera from which the minimap's light and dark begin to show on the textures: all of it at FROM. */
const LIT = 60
/** Blocks whose mixes are kept at most, the ones near the camera always. */
const HELD = 9
/** Blocks read at a time. */
const LOADING = 2

type Uniforms = { uGroundMix: { value: THREE.Texture | null }; uGroundLayers: { value: THREE.Texture | null }; uGroundHas: { value: number } }

interface Block {
  column: number
  row: number
  state: 'new' | 'loading' | 'in' | 'none'
  uniforms: Uniforms
  used: number
}

export class Ground {
  /** What every block's ground shares: the pile of the continent's textures. */
  readonly shared = { uGround: { value: null as THREE.Texture | null } }
  loading = 0
  private on = false
  private folder = ''
  private blocks = new Map<string, Block>()
  /** The place in the pile of each texture's file, once the pile is read. */
  private slots: Promise<Map<number, number> | null> | null = null
  private ready = false
  private frame = 0
  private changed = false

  constructor(
    private renderer: THREE.WebGLRenderer,
    private s3tc: boolean,
  ) {}

  /** The continent on show: another one's textures and mixes go. */
  show(folder: string): void {
    if (folder === this.folder) return
    this.clear()
    this.folder = folder
  }

  turn(on: boolean): void {
    if (on === this.on) return
    this.on = on
    if (!on) this.clear()
    this.changed = true
  }

  /** The bytes held on the graphics card. */
  get bytes(): number {
    const pile = this.shared.uGround.value?.image as { width: number; depth: number } | undefined
    let mixes = 0
    for (const b of this.blocks.values()) if (b.state === 'in') mixes += MIX_SIDE * MIX_SIDE * 4
    return mixes + (pile ? (this.s3tc ? (pile.depth * pile.width * pile.width * 2) / 3 : (pile.depth * pile.width * pile.width * 16) / 3) : 0)
  }

  /** A block's ground material is told where its own textures are: its picture's coordinates are the block's. */
  into(shader: THREE.WebGLProgramParametersWithUniforms, key: string): void {
    Object.assign(shader.uniforms, this.shared, this.of(key).uniforms)
    const edge = (0.5 / 64).toFixed(6)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nprecision highp sampler2DArray;\nuniform sampler2DArray uGround;\nuniform sampler2D uGroundMix, uGroundLayers;\nuniform float uGroundHas;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec2 inBlock = vMapUv * ${PIECES}.0, laid = inBlock * ${REPEATS}.0, dx = dFdx(laid), dy = dFdy(laid);
          float away = length(vViewPosition), near = uGroundHas * (1.0 - smoothstep(${FROM}.0, ${TO}.0, away));
          if (near > 0.0) {
            // the piece's four layers (the place of each one's texture in the pile, below 0 for none) and the shares of the last three
            vec2 piece = min(floor(inBlock), ${PIECES - 1}.0);
            vec4 ids = texelFetch(uGroundLayers, ivec2(piece), 0);
            vec3 mixes = textureLod(uGroundMix, (piece + clamp(inBlock - piece, ${edge}, 1.0 - ${edge})) / ${PIECES}.0, 0.0).rgb;
            vec4 share = vec4(1.0 - min(1.0, mixes.r + mixes.g + mixes.b), mixes) * step(0.0, ids);
            float whole = share.x + share.y + share.z + share.w;
            if (whole > 0.0) {
              ids = max(ids, 0.0);
              vec3 own = (share.x * textureGrad(uGround, vec3(laid, ids.x), dx, dy).rgb + share.y * textureGrad(uGround, vec3(laid, ids.y), dx, dy).rgb + share.z * textureGrad(uGround, vec3(laid, ids.z), dx, dy).rgb + share.w * textureGrad(uGround, vec3(laid, ids.w), dx, dy).rgb) / whole;
              // Up close they are as the game has them: what the minimap has painted on the ground (roofs, shadows of trees)
              // is gone from under the buildings and trees drawn whole. From farther the minimap's light and dark stay on
              // them, so that hills keep their shade and nothing changes where the textures end (chosen by the user on the
              // preview of M23-F8, over the textures alone and over the minimap's light everywhere).
              float lit = smoothstep(${LIT}.0, ${FROM}.0, away);
              if (lit > 0.0) {
                // the minimap's colour, lighter and darker as each texture is around its own average
                vec3 plain = (share.x * textureLod(uGround, vec3(laid, ids.x), ${LEVELS - 1}.0).rgb + share.y * textureLod(uGround, vec3(laid, ids.y), ${LEVELS - 1}.0).rgb + share.z * textureLod(uGround, vec3(laid, ids.z), ${LEVELS - 1}.0).rgb + share.w * textureLod(uGround, vec3(laid, ids.w), ${LEVELS - 1}.0).rgb) / whole;
                own = mix(own, diffuseColor.rgb * own / max(plain, vec3(0.02)), lit);
              }
              diffuseColor.rgb = mix(diffuseColor.rgb, own, near);
            }
          }
        }`,
      )
  }

  /** Reads what the camera has come near, lets go what it has left. camera: where it is; level: the height of the ground it looks at. True when the view must be drawn again. */
  step(camera: THREE.Vector3, level: number): boolean {
    this.frame++
    if (this.on && this.folder) {
      this.slots ??= this.pile(this.folder)
      const held: Block[] = []
      for (const b of this.blocks.values()) {
        const x0 = b.column * BLOCK_YARDS,
          z0 = b.row * BLOCK_YARDS
        const away = Math.hypot(Math.max(x0 - camera.x, 0, camera.x - x0 - BLOCK_YARDS), camera.y - level, Math.max(z0 - camera.z, 0, camera.z - z0 - BLOCK_YARDS))
        if (away < TO) {
          b.used = this.frame
          if (b.state === 'new' && this.loading < LOADING) void this.load(b, this.folder)
        }
        if (b.state === 'in') held.push(b)
        const has = b.state === 'in' && this.ready ? 1 : 0
        if (b.uniforms.uGroundHas.value !== has) ((b.uniforms.uGroundHas.value = has), (this.changed = true))
      }
      if (held.length > HELD) for (const b of held.sort((p, q) => p.used - q.used).slice(0, held.length - HELD)) if (b.used < this.frame) this.drop(b)
    }
    const changed = this.changed
    this.changed = false
    return changed
  }

  dispose(): void {
    this.clear()
  }

  private of(key: string): Block {
    let b = this.blocks.get(key)
    if (!b) {
      const [column, row] = key.split(' ').map(Number)
      this.blocks.set(key, (b = { column: column!, row: row!, state: 'new', used: 0, uniforms: { uGroundMix: { value: null }, uGroundLayers: { value: null }, uGroundHas: { value: 0 } } }))
    }
    return b
  }

  // The continent's textures: the list of their files, then the pile, every level of every texture one after the other.
  private async pile(folder: string): Promise<Map<number, number> | null> {
    try {
      const list = (await (await fetch(`${TILES}/${folder}/ground.json`)).json()) as { textures: number[] }
      const bytes = await inflated(`${TILES}/${folder}/ground/textures.bin`)
      if (!bytes || folder !== this.folder || !this.on) return null
      // ponytail: a card that takes fewer pictures in a pile than the continent has (the least a card may take is 256, a continent has some 270) leaves the last ones out: those layers show as their piece's first one. Two piles if a card is found that does.
      const gl = this.renderer.getContext() as WebGL2RenderingContext
      const count = Math.min(list.textures.length, gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) as number)
      const all = list.textures.length
      let t: THREE.Texture
      if (this.s3tc) {
        const levels = Array.from({ length: LEVELS }, (_, l) => ({ data: bytes.subarray(pileLevel(all, l), pileLevel(all, l) + levelBytes(l) * count), width: Math.max(1, TEXTURE >> l), height: Math.max(1, TEXTURE >> l) }))
        t = new THREE.CompressedArrayTexture(levels as unknown as ImageData[], TEXTURE, TEXTURE, count, THREE.RGB_S3TC_DXT1_Format)
      } else {
        // A card that does not read DXT (a phone): the pixels of the second level, the smaller ones made by the card.
        const side = TEXTURE / 2,
          data = new Uint8Array(side * side * 4 * count)
        for (let k = 0; k < count; k++) {
          const rgb = decodeDxt(bytes.subarray(pileLevel(all, 1) + k * levelBytes(1), pileLevel(all, 1) + (k + 1) * levelBytes(1)), side, side)
          for (let i = 0, o = k * side * side * 4; i < rgb.length; i += 3, o += 4) data.set([rgb[i]!, rgb[i + 1]!, rgb[i + 2]!, 255], o)
        }
        t = new THREE.DataArrayTexture(data, side, side, count)
        t.generateMipmaps = true
        t.minFilter = THREE.LinearMipmapLinearFilter
        t.magFilter = THREE.LinearFilter
      }
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      t.needsUpdate = true
      this.shared.uGround.value = t
      this.ready = true
      this.changed = true
      return new Map(list.textures.slice(0, count).map((file, k) => [file, k]))
    } catch {
      return null
    }
  }

  private async load(b: Block, folder: string): Promise<void> {
    b.state = 'loading'
    this.loading++
    try {
      const slots = await this.slots,
        bytes = slots && (await inflated(`${TILES}/${folder}/ground/${b.column}/${b.row}.bin`)),
        g = bytes && unpackGround(bytes)
      if (folder !== this.folder || !this.on) return void (b.state = 'new')
      if (!g || !slots) return void (b.state = 'none')
      const ids = new Float32Array(PIECES * PIECES * 4)
      g.layers.forEach((local, i) => (ids[i] = local === NONE ? -1 : (slots.get(g.textures[local] ?? 0) ?? -1)))
      const layers = new THREE.DataTexture(ids, PIECES, PIECES, THREE.RGBAFormat, THREE.FloatType)
      layers.needsUpdate = true
      const mix = new THREE.DataTexture(g.mix, MIX_SIDE, MIX_SIDE)
      mix.magFilter = mix.minFilter = THREE.LinearFilter
      mix.needsUpdate = true
      b.uniforms.uGroundLayers.value = layers
      b.uniforms.uGroundMix.value = mix
      b.state = 'in'
      this.changed = true
    } catch {
      b.state = 'none'
    } finally {
      this.loading--
    }
  }

  private drop(b: Block): void {
    b.uniforms.uGroundMix.value?.dispose()
    b.uniforms.uGroundLayers.value?.dispose()
    b.uniforms.uGroundMix.value = b.uniforms.uGroundLayers.value = null
    b.uniforms.uGroundHas.value = 0
    b.state = 'new'
  }

  // Everything goes from the graphics card; the blocks stay known, their materials hold their uniforms.
  private clear(): void {
    for (const b of this.blocks.values()) this.drop(b)
    this.shared.uGround.value?.dispose()
    this.shared.uGround.value = null
    this.slots = null
    this.ready = false
    this.changed = true
  }
}
