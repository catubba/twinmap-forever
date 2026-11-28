// The light of the 3D view by the hour of the game's day (M23-F10): the view's light of today is noon's, and every other
// hour is that light times the colour of the hour against noon's, from the game's tables where the camera looks
// (shared/light.ts). The sun goes round with the hour, the moon at night; the sky and the haze far off take the colour
// of the hour; the sea is darkened as the ground; the windows of the buildings light up at night (buildings3d.ts).
// Off, or before the game tells its hour, the light is today's.
import * as THREE from 'three'
import { LIGHT_FILE, lightAt, nightAt, sunAt, type LightFacts } from '../../shared/light'
import { TILES } from './web'

/** How lit the windows are, 0 by day and 1 at night: the uniform of every material that glows. */
export const night = { value: 0 }

const B = 1600 / 3 // yards a block: the view's x and z are 32 blocks from the middle of the world

export class Daylight {
  /** The game's lights, once the window has them (light.json, made after the map: asked again every 30 seconds until then). */
  private facts: LightFacts | null = null
  private asked = -Infinity
  /** Switched on in Settings > Graphics. */
  on = true
  /** The hour the game told, in minutes since midnight, and when it was told (Date.now()). */
  private told: { minutes: number; at: number } | null = null
  /** The hour the player set on the ring, or null for the game's. */
  private held: number | null = null
  private last = ''
  private readonly sea: THREE.Color

  constructor(
    private ambient: THREE.AmbientLight,
    private sun: THREE.DirectionalLight,
    private fog: THREE.Fog,
    private seaMaterial: THREE.MeshBasicMaterial,
    private skyToday: number,
  ) {
    this.sea = seaMaterial.color.clone()
  }

  /** The colour of the sky now. */
  readonly sky = new THREE.Color()

  /** The game's hour, as the addon sends it. */
  tell(minutes: number, at: number): void {
    this.told = { minutes, at }
  }

  /** The hour the player chose, or null to follow the game again. */
  hold(minutes: number | null): void {
    this.held = minutes
  }

  /** The hour the view shows, in minutes since midnight; null before the game has told one. */
  get minutes(): number | null {
    if (this.held !== null) return this.held
    return this.told ? (this.told.minutes + (Date.now() - this.told.at) / 60000) % 1440 : null
  }

  /** Whether the player holds the hour away from the game's. */
  get holding(): boolean {
    return this.held !== null
  }

  private ask(): void {
    if (performance.now() - this.asked < 30000) return
    this.asked = performance.now()
    void fetch(`${TILES}/${LIGHT_FILE}`)
      .then((a) => (a.status === 200 ? (a.json() as Promise<LightFacts>) : null))
      .catch(() => null)
      .then((facts) => {
        if (!facts?.lights) return
        this.facts = facts
        this.last = ''
      })
  }

  /** Worked out again at the next step: the sky was set to another colour. */
  again(): void {
    this.last = ''
  }

  /** The light for the place looked at, on the map given (null: a dungeon, lit as today, its sky its own); true when it changed. */
  step(target: THREE.Vector3, map: number | null): boolean {
    const minutes = this.on && map !== null ? this.minutes : null
    if (minutes !== null && !this.facts) this.ask()
    // a change of a minute, or of 20 yards, is seen; less is not worth a frame
    const key = map === null ? 'dungeon' : minutes === null || !this.facts ? 'today' : `${Math.floor(minutes)} ${map} ${Math.round(target.x / 20)} ${Math.round(target.z / 20)}`
    if (key === this.last) return false
    this.last = key
    const light = minutes === null || !this.facts ? null : lightAt(this.facts, map!, 32 * B - target.z, 32 * B - target.x, minutes)
    if (!light) {
      this.ambient.color.set(0xffffff)
      this.sun.color.set(0xffffff)
      this.sun.position.set(-Math.SQRT1_2, 1, -Math.SQRT1_2)
      this.sky.set(this.skyToday)
      this.seaMaterial.color.copy(this.sea)
      night.value = 0
    } else {
      const { light: l, fog } = light, [x, y, z] = sunAt(minutes!)
      // the light of the hour on both, as strong as today's: a lower sun lights level ground less, as at dawn
      this.ambient.color.setRGB(l[0]!, l[1]!, l[2]!, THREE.SRGBColorSpace)
      this.sun.color.copy(this.ambient.color)
      this.sun.position.set(x, y, z)
      this.sky.set(this.skyToday).multiply(new THREE.Color().setRGB(fog[0]!, fog[1]!, fog[2]!, THREE.SRGBColorSpace))
      // the sea is drawn unlit: darkened as level ground is
      this.seaMaterial.color.copy(this.sea).multiply(this.ambient.color)
      night.value = nightAt(minutes!)
    }
    if (map !== null) this.fog.color.copy(this.sky)
    return true
  }
}
